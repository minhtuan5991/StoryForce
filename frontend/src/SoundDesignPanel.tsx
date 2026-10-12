import {useEffect,useState} from 'react';
import {AudioLines} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Section} from './components';
import {tr} from './i18n';
import {resourcesCleaned} from './ResourceCleanup';

export function SoundDesignPanel({project:p,active,act}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [plan,setPlan]=useState<Row|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let live=true;api('/projects/'+p.id+'/sound-design').then(v=>{if(live){setPlan(v);setError('')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[p.id,p.updated_at]);
  const disabled=active||busy||!p.locked||resourcesCleaned(p);
  const update=async(body:Row)=>{setBusy(true);try{const result=await act(()=>api('/projects/'+p.id+'/sound-design','POST',body),'Sound effects prepared');if(result)setPlan(result)}finally{setBusy(false)}};
  const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const unique=(plan?.cues||[]).filter((cue:Row,i:number,all:Row[])=>all.findIndex(c=>c.kind===cue.kind)===i);
  return <Section title={tr('Story sound effects')} caption={tr('30-second opening layer · accents tied to narrated events')}>
    <p className="muted">{tr('Shared sound textures are prepared locally and reused. No extra AI task is added for each scene. Background music keeps its fixed level.')}</p>
    {error&&<p role="alert" className="error-text">{error}</p>}
    {plan&&<>
      <label className="check-field"><input type="checkbox" checked={plan.enabled} disabled={disabled} onChange={e=>update({enabled:e.target.checked})}/>{tr('Add story sound effects')}</label>
      {plan.enabled&&<>
        <p>{tr('Opening layer')}: {plan.opening_seconds.toFixed(1)} {tr('seconds')} · {plan.cues.length} {tr('sound cues')} · {tr(plan.timing==='actual'?'Timing follows measured narration':'Estimated timing; updated after narration is attached')}</p>
        <Button disabled={disabled} onClick={()=>update({})}><AudioLines size={16} aria-hidden="true"/>{tr(busy?'Preparing sound effects…':'Prepare shared sound effects')}</Button>
        <details><summary>{tr('Sound cue timeline')}</summary>
          <div style={{overflowX:'auto'}}><table><thead><tr><th>{tr('Time')}</th><th>{tr('Sound effect')}</th><th>{tr('Narration anchor')}</th></tr></thead><tbody>
            {plan.cues.map((cue:Row)=><tr key={cue.id}><td>{time(cue.offset)}</td><td>{tr(cue.label)}</td><td>{cue.anchor_text||tr('Opening musical accent')}</td></tr>)}
          </tbody></table></div>
        </details>
        {plan.prepared&&<details><summary>{tr('Listen to shared sound effects')}</summary>{unique.map((cue:Row)=><div key={cue.kind}><p>{tr(cue.label)}</p><audio controls preload="none" aria-label={tr(cue.label)} src={'/api/projects/'+p.id+'/sound-design/effects/'+cue.kind}/></div>)}</details>}
        <p className="muted">{tr('Effects are mixed automatically when you render. Existing final videos need a new render to include them.')}</p>
      </>}
    </>}
  </Section>;
}
