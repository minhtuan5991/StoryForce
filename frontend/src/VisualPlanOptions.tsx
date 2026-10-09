import {useEffect,useState} from 'react';
import {Image} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Field,Modal} from './components';
import {tr} from './i18n';

export function VisualPlanOptions({project,active,act,run}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,run:(payload?:Row)=>void}){
  const budget=project.visual_budget||{mode:'standard',image_count:6,video_count:2,standard:{image_count:6,video_count:2},minimum:{image_count:3,video_count:1}};
  const saved=JSON.stringify(project.settings?.visual_options||{});
  const [options,setOptions]=useState<Row>({mode:budget.mode,image_count:budget.image_count,video_count:budget.video_count}),[busy,setBusy]=useState(false);
  const [autoCreate,setAutoCreate]=useState(true),[confirm,setConfirm]=useState(false);
  const live=(project.jobs||[]).filter((j:Row)=>['queued','running','waiting_user'].includes(j.status));
  const ttsBusy=live.length>0&&live.every((j:Row)=>j.kind==='tts_context'&&j.payload?._media?.target_type==='chunk');
  const blocked=active&&!ttsBusy;
  useEffect(()=>{setOptions({mode:budget.mode,image_count:budget.image_count,video_count:budget.video_count})},[saved]);
  const presets={...budget,efficient:budget.efficient||{image_count:budget.minimum.image_count,video_count:budget.standard.video_count}};
  const counts=options.mode==='custom'?options:presets[options.mode];
  const valid=Number.isInteger(counts.image_count)&&counts.image_count>=1&&Number.isInteger(counts.video_count)&&counts.video_count>=0&&counts.image_count+counts.video_count<=200;
  async function generate(){
    setBusy(true);
    try{if(await act(()=>api('/projects/'+project.id+'/visual-options','PATCH',options),'Visual options saved')){run(autoCreate?{automatic_resources:true,confirmed_image_count:counts.image_count,confirmed_video_count:counts.video_count}:{});setConfirm(false)}}
    finally{setBusy(false)}
  }
  return <><fieldset className="render-options" disabled={blocked||busy}>
    <legend>{tr('Image and video count')}</legend>
    <Field label={tr('Visual plan mode')}><select aria-label={tr('Visual plan mode')} value={options.mode} onChange={e=>setOptions({...options,mode:e.target.value})}>
      <option value="standard">{tr('Standard')}</option><option value="efficient">{tr('Fewer images · keep opening videos')}</option><option value="minimum">{tr('Minimum · about 50% fewer visuals')}</option><option value="custom">{tr('Custom counts')}</option>
    </select></Field>
    <div className="form-grid">
      <Field label={tr('Image count')}><input aria-label={tr('Image count')} type="number" min={1} max={200} step={1} readOnly={options.mode!=='custom'} value={counts.image_count??''} onChange={e=>setOptions({...options,image_count:e.target.value===''?null:Number(e.target.value)})}/></Field>
      <Field label={tr('Video count')}><input aria-label={tr('Video count')} type="number" min={0} max={199} step={1} readOnly={options.mode!=='custom'} value={counts.video_count??''} onChange={e=>setOptions({...options,video_count:e.target.value===''?null:Number(e.target.value)})}/></Field>
    </div>
    <p className="muted">{tr('Minimum mode uses about half the standard images and videos, rounded up, and focuses on key story beats. Images hold longer; scene videos never loop.')}</p>
    {options.mode==='efficient'&&<p className="notice compact">{tr('Fewer images mode halves the image count while keeping the standard opening video count. Each image covers a meaningful story beat with the same pan and zoom. Confirm the counts before creation.')}</p>}
    <p className="notice compact">{tr('New plans start at 0:00 with up to three consecutive 10-second videos. Standard mode uses 2–3; custom counts remain exact and additional videos appear later. Images cover the rest of the story.')}</p>
    {project.scenes.length>0&&<p className="muted">{tr('Creating a new plan replaces scene assignments. Uploaded resource files are kept.')}</p>}
    <label className="check-field"><input type="checkbox" checked={autoCreate} onChange={e=>setAutoCreate(e.target.checked)}/>{tr('Automatically create and download after this plan')}</label>
    {ttsBusy&&<p className="muted">{tr('Narration is running. This plan will wait until all audio items are completed or skipped.')}</p>}
    {!valid&&<p role="alert" className="error-text">{tr('Choose at least one image, zero or more videos, and at most 200 visuals')}</p>}
    <Button primary disabled={!project.locked||blocked||busy||!valid} onClick={()=>autoCreate?setConfirm(true):generate()}><Image size={16}/>{tr(busy?'Saving…':ttsBusy?'Queue visual plan':'Create visual plan')}</Button>
  </fieldset>{confirm&&<Modal title={tr('Confirm image and video counts')} onClose={()=>{if(!busy)setConfirm(false)}}>
    <p><strong>{counts.image_count} {tr('images')} · {counts.video_count} {tr('videos')} + 1 {tr('thumbnail')}</strong></p>
    <p>{tr('Thumbnail is created first. Images and videos start only after this count confirmation and after narration finishes.')}</p>
    <p>{tr('If opening videos need a character reference, one main-cast reference image is created before the clips and shared by Gemini and Flow. It is saved separately and is not included in the timeline or scene counts.')}</p>
    <p>{tr('Video creation uses Flow credits at the rate shown on its page.')}</p>
    <div className="modal-actions"><Button disabled={busy} onClick={()=>setConfirm(false)}>{tr('Cancel')}</Button><Button primary disabled={busy} onClick={generate}>{tr('Confirm counts and create resources')}</Button></div>
  </Modal>}</>;
}
