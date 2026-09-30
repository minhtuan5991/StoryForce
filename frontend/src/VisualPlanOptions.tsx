import {useEffect,useState} from 'react';
import {Image} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Field} from './components';
import {tr} from './i18n';

export function VisualPlanOptions({project,active,act,run}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,run:()=>void}){
  const budget=project.visual_budget||{mode:'standard',image_count:7,video_count:1,standard:{image_count:7,video_count:1},minimum:{image_count:4,video_count:1}};
  const saved=JSON.stringify(project.settings?.visual_options||{});
  const [options,setOptions]=useState<Row>({mode:budget.mode,image_count:budget.image_count,video_count:budget.video_count}),[busy,setBusy]=useState(false);
  useEffect(()=>{setOptions({mode:budget.mode,image_count:budget.image_count,video_count:budget.video_count})},[saved]);
  const counts=options.mode==='custom'?options:budget[options.mode];
  const valid=Number.isInteger(counts.image_count)&&counts.image_count>=1&&Number.isInteger(counts.video_count)&&counts.video_count>=0&&counts.image_count+counts.video_count<=200;
  async function generate(){
    setBusy(true);
    try{if(await act(()=>api('/projects/'+project.id+'/visual-options','PATCH',options),'Visual options saved'))run()}
    finally{setBusy(false)}
  }
  return <fieldset className="render-options" disabled={active||busy}>
    <legend>{tr('Image and video count')}</legend>
    <Field label={tr('Visual plan mode')}><select aria-label={tr('Visual plan mode')} value={options.mode} onChange={e=>setOptions({...options,mode:e.target.value})}>
      <option value="standard">{tr('Standard')}</option><option value="minimum">{tr('Minimum · about 50% fewer visuals')}</option><option value="custom">{tr('Custom counts')}</option>
    </select></Field>
    <div className="form-grid">
      <Field label={tr('Image count')}><input aria-label={tr('Image count')} type="number" min={1} max={200} step={1} readOnly={options.mode!=='custom'} value={counts.image_count??''} onChange={e=>setOptions({...options,image_count:e.target.value===''?null:Number(e.target.value)})}/></Field>
      <Field label={tr('Video count')}><input aria-label={tr('Video count')} type="number" min={0} max={199} step={1} readOnly={options.mode!=='custom'} value={counts.video_count??''} onChange={e=>setOptions({...options,video_count:e.target.value===''?null:Number(e.target.value)})}/></Field>
    </div>
    <p className="muted">{tr('Minimum mode uses about half the standard images and videos, rounded up, and focuses on key story beats. Images hold longer; scene videos never loop.')}</p>
    {project.scenes.length>0&&<p className="muted">{tr('Creating a new plan replaces scene assignments. Uploaded resource files are kept.')}</p>}
    {!valid&&<p role="alert" className="error-text">{tr('Choose at least one image, zero or more videos, and at most 200 visuals')}</p>}
    <Button primary disabled={!project.locked||active||busy||!valid} onClick={generate}><Image size={16}/>{tr(busy?'Saving…':'Create visual plan')}</Button>
  </fieldset>;
}
