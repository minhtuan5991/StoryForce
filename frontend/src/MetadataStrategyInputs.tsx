import {useEffect,useState} from 'react';
import {Plus,Trash2,Loader2} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Field} from './components';
import {tr} from './i18n';

export const evidenceLabels:Record<string,string>={youtube_analytics:'YouTube Analytics (supplied)',trend_research:'Search research (supplied)',observed_niche_phrase:'Observed niche phrase',story_semantic:'Story semantics',editorial_inference:'Editorial inference'};
const defaults={traffic_profile:{suggested_percent:null,browse_percent:null,search_percent:null},fiction_disclosure_enabled:true,
  fiction_disclosure_text:'This is a fictional story created for entertainment.',keyword_evidence:[]};
function initial(p:Row){const saved=p.settings?.youtube_metadata;return {channel_preferences:{...defaults,...p.channel?.settings?.youtube_metadata},thumbnail_text:saved?.thumbnail_story_version!==undefined&&saved.thumbnail_story_version!==p.story_version?'':saved?.thumbnail_text||''}}

export function MetadataStrategyInputs({project:p,act,onDirty}:{project:Row,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,onDirty:(value:boolean)=>void}){
  const [form,setForm]=useState<Row>(()=>initial(p)),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setForm(initial(p));setDirty(false);setSaved(false);setError('');onDirty(false)},[p.id]);
  const prefs=form.channel_preferences;
  const update=(patch:Row)=>{setForm({...form,...patch});setDirty(true);setSaved(false);onDirty(true)};
  const preference=(key:string,value:any)=>update({channel_preferences:{...prefs,[key]:value}});
  const keyword=(index:number,key:string,value:string)=>preference('keyword_evidence',prefs.keyword_evidence.map((r:Row,i:number)=>i===index?{...r,[key]:value}:r));
  return <details className="metadata-inputs"><summary>{tr('Metadata strategy inputs (optional)')}</summary>
    <p className="muted">{tr('Save channel traffic and keyword evidence once; future projects reuse them. Leave unavailable percentages blank. Thumbnail text applies only to this project.')}</p>
    <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{
      const result=await act(()=>api('/projects/'+p.id+'/metadata-settings','PATCH',form),'Metadata strategy inputs saved');
      if(result){setForm(result);setDirty(false);setSaved(true);onDirty(false)}
      else setError(tr('Could not save inputs. Review the traffic percentages and keyword sources.'));
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>
      <div className="form-grid">
        <Field label="Actual thumbnail text"><input maxLength={200} value={form.thumbnail_text} onChange={e=>update({thumbnail_text:e.target.value})}/></Field>
        {(['suggested_percent','browse_percent','search_percent'] as const).map((key,index)=><Field key={key} label={['Suggested traffic (%)','Browse traffic (%)','Search traffic (%)'][index]}>
          <input type="number" min="0" max="100" step="0.01" value={prefs.traffic_profile?.[key]??''} onChange={e=>preference('traffic_profile',{...prefs.traffic_profile,[key]:e.target.value===''?null:Number(e.target.value)})}/>
        </Field>)}
      </div>
      <label className="check-row"><input type="checkbox" checked={prefs.fiction_disclosure_enabled} onChange={e=>preference('fiction_disclosure_enabled',e.target.checked)}/>{tr('Include fiction disclosure in descriptions')}</label>
      <Field label="Fiction disclosure text"><input maxLength={300} required disabled={!prefs.fiction_disclosure_enabled} value={prefs.fiction_disclosure_text} onChange={e=>preference('fiction_disclosure_text',e.target.value)}/></Field>
      <details><summary>{tr('Optional keyword evidence')}</summary><p className="muted">{tr('Use a real source or Analytics reference for observed phrases. Without supplied evidence, generated keywords remain editorial inferences.')}</p>
        {prefs.keyword_evidence.map((row:Row,index:number)=><div className="metadata-evidence-row" key={index}><div className="form-grid">
          <Field label={tr('Keyword phrase {number}',{number:index+1})}><input required maxLength={100} value={row.phrase} onChange={e=>keyword(index,'phrase',e.target.value)}/></Field>
          <Field label={tr('Evidence type {number}',{number:index+1})}><select value={row.evidence_type} onChange={e=>keyword(index,'evidence_type',e.target.value)}>{Object.entries(evidenceLabels).map(([key,label])=><option key={key} value={key}>{tr(label)}</option>)}</select></Field>
          <Field label={tr('Evidence source {number}',{number:index+1})}><input required={['youtube_analytics','trend_research','observed_niche_phrase'].includes(row.evidence_type)} maxLength={500} value={row.source} onChange={e=>keyword(index,'source',e.target.value)}/></Field>
          <Field label={tr('Evidence note {number}',{number:index+1})}><input maxLength={1000} value={row.notes} onChange={e=>keyword(index,'notes',e.target.value)}/></Field>
        </div><Button type="button" small onClick={()=>preference('keyword_evidence',prefs.keyword_evidence.filter((_:Row,i:number)=>i!==index))}><Trash2 size={14}/>{tr('Remove phrase {number}',{number:index+1})}</Button></div>)}
        <Button small type="button" disabled={prefs.keyword_evidence.length>=12} onClick={()=>preference('keyword_evidence',[...prefs.keyword_evidence,{phrase:'',evidence_type:'editorial_inference',source:'',notes:''}])}><Plus size={14}/>{tr('Add keyword evidence')}</Button>
      </details>
      {error&&<p role="alert" className="error-text">{error}</p>}
      {dirty&&<p className="muted">{tr('Save these inputs before generating metadata.')}</p>}
      {saved&&<p role="status" className="muted">{tr('Metadata strategy inputs saved')}</p>}
      <Button type="submit" small disabled={busy||!dirty}>{busy&&<Loader2 className="spin" size={14}/>} {tr('Save metadata strategy inputs')}</Button>
    </form>
  </details>;
}
