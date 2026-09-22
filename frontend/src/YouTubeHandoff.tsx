import {useState} from 'react';
import {Download,Sparkles,Check,Loader2} from 'lucide-react';
import {Section,Button,CopyButton,Modal,Badge} from './components';
import {api,downloadText} from './api';
import type {Row} from './api';
import {tr} from './i18n';

export function YouTubeHandoff({project:p,form,onApply,act}:{project:Row,form:Row,onApply:(fields:Row)=>void,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
  const artifact=p.artifacts.youtube_metadata,result=artifact?.content;
  const active=p.jobs.some((j:Row)=>['queued','running','waiting_user'].includes(j.status));
  const generate=async()=>{
    setBusy(true);setError('');
    try{await act(()=>api('/jobs','POST',{kind:'youtube_metadata',project_id:p.id,payload:{auto_continue:false}}),'YouTube metadata queued in ChatGPT')}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  };
  const apply=()=>{onApply({title:result.title,description:result.description,tags:result.tags.join(', ')});setConfirm(false)};
  return <Section title={tr('YouTube upload package')} caption={tr('ChatGPT prepares titles, description and focused tags from this story and channel.')} action={<Button primary disabled={active||busy||!p.locked||!p.draft} onClick={()=>void generate()}>{busy?<Loader2 size={16} className="spin"/>:<Sparkles size={16}/>} {tr(result?'Regenerate with ChatGPT':'Generate with ChatGPT')}</Button>}>
    {!p.locked&&<p className="muted">{tr('Lock a finished story before generating YouTube metadata')}</p>}
    {active&&<a className="text-link" href={'#/jobs/'+p.id}>{tr('Follow the active task in Activity & jobs')}</a>}
    <p className="muted">{tr('Uses the channel language. Metadata is a suggestion; review the final video before uploading. No automatic upload or guarantee of ranking or approval.')}</p>
    {error&&<p role="alert" className="error-text">{error}</p>}
    {result&&<>
      <div className="inline wrap"><Badge tone={artifact.provider?.startsWith('mock')?'amber':'blue'}>{artifact.provider}</Badge><span className="muted">{tr('Version ')}{artifact.story_version} · {new Date(artifact.created_at).toLocaleString()}</span></div>
      {!p.youtube_metadata_current&&<p className="notice error">{tr('The story, media plan or channel changed. Regenerate metadata before uploading.')}</p>}
      <h3>{tr('YouTube title')}</h3><p className="readable-value">{result.title}</p><CopyButton text={result.title}/>
      <h3>{tr('Description')}</h3><p style={{whiteSpace:'pre-wrap'}}>{result.description}</p><CopyButton text={result.description}/>
      <h3>{tr('YouTube tags')}</h3><p>{result.tags.join(', ')}</p><CopyButton text={result.tags.join(', ')}/>
      {!!result.hashtags?.length&&<><h3>Hashtags</h3><p>{result.hashtags.join(' ')}</p><CopyButton text={result.hashtags.join(' ')}/></>}
      {!!result.alternative_titles?.length&&<details><summary>{tr('Alternative titles')}</summary><ul>{result.alternative_titles.map((title:string)=><li key={title}>{title}</li>)}</ul></details>}
      <details><summary>{tr('SEO and upload review notes')}</summary><p>{result.seo_notes}</p><ul>{result.review_notes?.map((note:string)=><li key={note}>{note}</li>)}</ul></details>
      <div className="inline wrap" style={{marginTop:20}}><a className="button" href={'/api/projects/'+p.id+'/download/youtube_metadata.txt'}><Download size={16}/>{tr('Download ChatGPT TXT')}</a><Button disabled={!p.youtube_metadata_current} onClick={()=>setConfirm(true)}><Check size={16}/>{tr('Use in publishing form')}</Button></div>
    </>}
    <div className="inline wrap" style={{marginTop:16}}><Button small disabled={!form.title||!form.description} onClick={()=>downloadText('youtube_upload.txt',`VIDEO TITLE\n${form.title}\n\nDESCRIPTION\n${form.description}\n\nTAGS\n${form.tags||''}\n`)}><Download size={15}/>{tr('Export current form as TXT')}</Button></div>
    {confirm&&<Modal title={tr('Apply ChatGPT metadata?')} onClose={()=>setConfirm(false)}><p>{tr('This replaces the title, description and tags in the form below. Other publishing settings remain. Review and save the form when ready.')}</p><div className="modal-actions"><Button onClick={()=>setConfirm(false)}>{tr('Cancel')}</Button><Button primary onClick={apply}>{tr('Apply')}</Button></div></Modal>}
  </Section>;
}
