import {ViewText} from './ViewTranslation';
import {useState} from 'react';
import {Image,Download} from 'lucide-react';
import {Section,Field,Button,CopyButton} from './components';
import type {Row} from './api';
import {api} from './api';
import {tr} from './i18n';
import {ThumbnailPackaging} from './ThumbnailPackaging';

export function ThumbnailStudio({project:p,act}:{project:Row,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const images=p.assets.filter((a:Row)=>a.kind==='image'&&a.metadata_json?.role!=='thumbnail');
  const [source,setSource]=useState(''),[busy,setBusy]=useState(false);
  const asset=p.assets.find((a:Row)=>a.id===p.publish.thumbnail_asset_id);
  return <><ThumbnailPackaging project={p} act={act}/><Section title={tr('Video thumbnail')} caption={tr('Large video title, one story image, minimal detail. 1280 × 720.')}><details><summary>{tr('Manual thumbnail from a story image')}</summary>
    <p><ViewText text={p.publish.title||p.title}/></p>
    <Field label={tr('Thumbnail image')}><select value={source} onChange={e=>setSource(e.target.value)}><option value="">{tr('Choose a story image')}</option>{images.map((a:Row)=><option value={a.id} key={a.id}>{a.name}</option>)}</select></Field>
    {source&&<img src={'/api/assets/'+source+'/file'} alt={tr('Thumbnail image')} style={{width:'100%',maxWidth:400,aspectRatio:'16/9',objectFit:'cover'}}/>}
    <div className="inline wrap"><Button primary disabled={!source||busy} onClick={async()=>{setBusy(true);try{await act(()=>api('/projects/'+p.id+'/thumbnail','POST',{asset_id:source}),'Thumbnail created')}finally{setBusy(false)}}}><Image size={16}/>{tr('Create thumbnail')}</Button><CopyButton text={p.thumbnail_prompt} caption={tr('Thumbnail prompt for AI')}/></div>
    </details>{asset&&<><img src={'/api/assets/'+asset.id+'/file'} alt={asset.metadata_json.title||tr('Selected project thumbnail')} style={{width:'100%',maxWidth:640,marginTop:20}}/><div><a className="button small" href={'/api/assets/'+asset.id+'/file'} download={asset.name}><Download size={15}/>{tr('Download thumbnail')}</a></div></>}
  </Section></>;
}
