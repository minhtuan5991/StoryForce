import {useEffect,useState} from 'react';
import {BookOpen,Check,Loader2,RefreshCw,Sparkles} from 'lucide-react';
import {api,pretty} from './api';
import type {Row} from './api';
import {Badge,Button,JsonEditor,Readable,Section} from './components';
import {tr} from './i18n';
import './channel-guidance.css';

const groups:Record<string,string>={ideas:'Ideas and direction',bible:'Story Bible',outline:'Outline',draft:'Draft',review:'Quality review',packaging:'Visuals and YouTube packaging'};
const statuses:Record<string,string>={active:'Applied',draft:'Awaiting Apply',researching:'Research in progress',archived:'Previous guidance',obsolete:'Outdated research'};

export function ChannelDNA({channel,onChanged}:{channel:Row,onChanged:()=>void}){
  const state=channel.creative_guidance||{items:[],legacy:true};
  const items:Row[]=state.items||[];
  const [selectedId,setSelectedId]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const selected=items.find(x=>x.id===selectedId)||items[0];
  const active=items.find(x=>x.id===state.active_id);
  const pending=items.find(x=>x.status==='researching'&&!x.stale);
  const working=pending?.jobs?.some((j:Row)=>['queued','running','waiting_user'].includes(j.status));
  useEffect(()=>{setSelectedId('');setError('');setMessage('')},[channel.id]);

  async function run(path:string,body:Row={},success=''){
    setBusy(true);setError('');setMessage('');
    try{
      const result=await api(path,'POST',body);
      if(result.guidance_id)setSelectedId(result.guidance_id);
      setMessage(tr(result.cached?'Saved research is ready for preview.':success));
      onChanged();
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  async function saveDNA(dna:Row){
    await api('/channels/'+channel.id+'/dna','POST',{dna,note:'Manual edit from Channel DNA'});
    setMessage(tr('Channel DNA version saved'));onChanged();
  }
  const canApply=selected&&!selected.stale&&['draft','archived'].includes(selected.status)&&!!selected.content?.step_rules;

  return <>
    <Section title={tr('The voice behind every story')} caption={tr('Save DNA, research the creative directions, preview them, then Apply.')}>
      <JsonEditor value={channel.dna} title={tr('Channel DNA')} onSave={saveDNA} onDirtyChange={setDirty}/>
      {!channel.dna.creative_brief&&state.criteria_template&&<div className="guidance-criteria">
        <p>{tr('Add creative criteria to describe the promise, voice, conflict, hook, twist, ending and fiction boundaries.')}</p>
        <Button disabled={busy||dirty} onClick={async()=>{
          setBusy(true);setError('');
          try{await saveDNA({...channel.dna,creative_brief:state.criteria_template})}
          catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
        }}><BookOpen size={16} aria-hidden="true"/>{tr('Add creative criteria')}</Button>
      </div>}
      <div className="guidance-actions">
        <Button primary disabled={busy||dirty||working} onClick={()=>run('/channels/'+channel.id+'/research-dna',{regenerate:true},'Channel research queued in ChatGPT.')}>
          {busy?<Loader2 className="spin" size={16} aria-hidden="true"/>:<Sparkles size={16} aria-hidden="true"/>}{tr('Research channel DNA')}
        </Button>
        <a className="text-link" href="#/jobs">{tr('Open research jobs')}</a>
      </div>
      {dirty&&<p className="muted">{tr('Save your DNA edits before researching or applying directions.')}</p>}
      <div role="status" aria-live="polite" aria-atomic="true">
        {message&&<p className="notice compact">{message}</p>}
        {working&&pending&&<p className="notice compact">{tr('Research sections: {p0}/{p1}. The active guidance remains in use.',{p0:pending.completed_parts,p1:pending.total_parts})}</p>}
      </div>
      {error&&<p role="alert" className="error-text">{error}</p>}
    </Section>

    <Section title={tr('Channel creative directions')} caption={tr('Only new projects use newly applied directions. Existing projects keep their saved version.')}>
      {state.legacy&&<p className="notice compact">{channel.name.toLowerCase()==='the midnight log'
        ?tr('The Midnight Log keeps its current prompts and settings until you explicitly Apply a different guidance version.')
        :tr('This channel currently uses the shared prompts. Research and Apply directions before starting projects that need a distinct identity.')}</p>}
      {state.active_stale&&<p className="notice compact">{tr('DNA changed after the active guidance was created. The approved guidance stays active; research again to update it.')}</p>}
      {!items.length&&<p className="muted">{tr('No creative guidance yet. Research returns a preview and never applies it automatically.')}</p>}
      {!!items.length&&<>
        <label className="field"><span>{tr('Guidance version')}</span>
          <select value={selected?.id||''} onChange={e=>setSelectedId(e.target.value)}>
            {items.map(item=><option key={item.id} value={item.id}>{tr('Version ')}{item.version} · {tr(statuses[item.status]||item.status)}{item.stale?' · '+tr('DNA changed'):''}</option>)}
          </select>
        </label>
        {selected&&<div className="guidance-preview">
          <div className="inline between wrap"><div className="inline wrap"><Badge tone={selected.status==='active'?'green':'amber'}>{tr(statuses[selected.status]||selected.status)}</Badge>
            <span className="muted">{selected.origin==='approved_baseline'?tr('Approved starting identity'):tr('Created with ChatGPT')}</span></div>
            <Button primary disabled={busy||dirty||!canApply} onClick={()=>run('/channels/'+channel.id+'/guidance/'+selected.id+'/apply',{},'Guidance applied to new projects.')}>
              <Check size={16} aria-hidden="true"/>{tr(selected.status==='archived'?'Restore this guidance':'Apply guidance')}
            </Button>
          </div>
          {selected.stale&&<p className="notice compact">{tr('This result belongs to an older DNA version. Research again or restore its exact DNA before applying.')}</p>}
          {selected.status==='researching'&&<>
            <p>{tr('Research sections: {p0}/{p1}. The active guidance remains in use.',{p0:selected.completed_parts,p1:selected.total_parts})}</p>
            {selected.jobs?.map((job:Row)=><div key={job.id} className="guidance-job"><span>{tr(job.step||job.status)}</span>{job.error&&<p className="error-text">{job.error}</p>}</div>)}
            <Button disabled={busy||selected.stale||selected.jobs?.some((j:Row)=>['queued','running','waiting_user'].includes(j.status)&&j.step!=='Interrupted by restart. Resume this job.')}
              onClick={()=>run('/channels/'+channel.id+'/guidance/'+selected.id+'/resume',{},'Incomplete research resumed.')}><RefreshCw size={16} aria-hidden="true"/>{tr('Resume incomplete research')}</Button>
            {!!selected.completed_parts&&<details><summary>{tr('Saved research sections')}</summary><pre>{pretty(selected.parts)}</pre></details>}
          </>}
          {selected.content?.identity&&<>
            <Readable value={selected.content.identity}/>
            <details open><summary>{tr('Core creative rules')}</summary><Readable value={{rules:selected.content.global_rules,avoid:selected.content.avoid,hook_examples:selected.content.hook_examples}}/></details>
            {Object.entries(selected.content.step_rules||{}).map(([key,value])=><details key={key}><summary>{tr(groups[key]||key)}</summary><Readable value={value}/></details>)}
            <details><summary>{tr('Research sources and limits')}</summary>
              <p>{selected.content.research?.mode==='web_references'?tr('Reference links supplied; verify factual claims before using them in a story.'):tr('Compiled from DNA; no live web research is claimed.')}</p>
              <p>{selected.content.research?.notes}</p>
              <ul>{selected.content.research?.sources?.map((source:Row)=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{source.insight}</p></li>)}</ul>
            </details>
            {active&&active.id!==selected.id&&<details><summary>{tr('Compare with active guidance')}</summary><div className="guidance-comparison"><div><h3>{tr('Current guidance')}</h3><pre>{pretty(active.content)}</pre></div><div><h3>{tr('Selected guidance')}</h3><pre>{pretty(selected.content)}</pre></div></div></details>}
          </>}
        </div>}
      </>}
    </Section>
  </>;
}
