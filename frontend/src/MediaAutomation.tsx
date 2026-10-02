import {useState} from 'react';
import {Download,AudioLines,Image,Square} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Modal,Progress,Section} from './components';
import {tr} from './i18n';

export function MediaAutomation({project:p,kind,active,act}:{project:Row,kind:'tts'|'visuals',active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [busy,setBusy]=useState(false),[preview,setPreview]=useState<Row|null>(null),[regenerate,setRegenerate]=useState(false);
  const batch=p.settings?.media_automation;
  const show=batch?.kind===kind;
  const running=show&&batch.phase==='running'&&p.jobs.some((j:Row)=>j.id===batch.current_job_id&&['queued','running','waiting_user'].includes(j.status));
  async function start(body:Row){
    setBusy(true);
    try{const result=await act(()=>api('/projects/'+p.id+'/media-automation/start','POST',{kind,regenerate,...body}),'Media generation queued');if(result)setPreview(null)}
    finally{setBusy(false)}
  }
  async function review(){
    setBusy(true);
    try{const result=await act(()=>api('/projects/'+p.id+'/media-automation/preview'));if(result)setPreview(result)}
    finally{setBusy(false)}
  }
  return <Section title={tr('Automatically create and download resources')} caption={kind==='tts'?'Enzo / Friendly · one AI Studio tab · sequential audio segments':'Gemini images / Flow videos · one tab per service · thumbnail first'}>
    <p>{tr(kind==='tts'?'Start to generate missing narration segments and download them immediately. No count confirmation is needed.':'Choose your image/video counts in the visual plan below. Automatic creation starts only after you confirm the final counts.')}</p>
    <p className="muted">{tr('Keep StoryForge and the paired Browser Bridge open with automation enabled. Completed downloads are automatically attached to their audio segment or scene.')}</p>
    <label className="check-field"><input type="checkbox" checked={regenerate} disabled={active||busy} onChange={e=>setRegenerate(e.target.checked)}/>{tr('Generate again, including already assigned resources')}</label>
    <div className="inline wrap">
      <Button primary disabled={!p.locked||active||busy||(kind==='tts'?!p.chunks.length:!p.scenes.length)} onClick={()=>kind==='tts'?start({}):review()}>
        {kind==='tts'?<AudioLines size={16}/>:<Image size={16}/>} {tr(kind==='tts'?'Create and download narration':'Review image/video counts')}
      </Button>
      {running&&<Button disabled={busy} onClick={()=>act(()=>api('/projects/'+p.id+'/media-automation/stop','POST'),'Media generation stopped')}><Square size={16}/>{tr('Stop resource automation')}</Button>}
    </div>
    {show&&<div className="notice compact" role="status"><Download size={18}/><div>
      <strong>{tr(batch.phase==='completed'?'Resources downloaded and attached':batch.phase==='cancelled'?'Resource automation stopped':'Resource queue')}: {batch.completed} / {batch.total}</strong>
      <p>{tr('Already assigned resources skipped')}: {batch.skipped}</p>
      <p style={{overflowWrap:'anywhere'}}>{batch.download_path}</p>
      <Progress value={batch.total?batch.completed*100/batch.total:100}/>
    </div></div>}
    {preview&&<Modal title={tr('Confirm image and video counts')} onClose={()=>{if(!busy)setPreview(null)}}>
      <p><strong>{preview.image_count} {tr('images')} · {preview.video_count} {tr('videos')} + 1 {tr('thumbnail')}</strong></p>
      <p>{tr('Thumbnail is created first. Scene resources follow the approved plan in order. Existing assigned files are kept unless you choose to generate them again.')}</p>
      <p>Flow: Video / {tr('Ingredients')} / 16:9 / Omni 1.1 Flash / 720p / 10 {tr('seconds')} / x1</p>
      <p className="muted">{tr('Video creation uses Flow credits at the rate shown on its page.')}</p>
      <p style={{overflowWrap:'anywhere'}}>{preview.download_path}</p>
      <div className="modal-actions"><Button disabled={busy} onClick={()=>setPreview(null)}>{tr('Cancel')}</Button>
        <Button primary disabled={busy} onClick={()=>start({confirmation:preview.confirmation,image_count:preview.image_count,video_count:preview.video_count})}>{tr('Confirm counts and create resources')}</Button>
      </div>
    </Modal>}
  </Section>;
}
