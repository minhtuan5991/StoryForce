import {useEffect,useState} from 'react';
import {ExternalLink,Save} from 'lucide-react';
import {api,type Row} from './api';
import {Button} from './components';
import {tr} from './i18n';

export function mediaSessionUrl(project:Row,provider:string){
  const value=project.settings?.media_sessions?.[provider]?.url;
  try{
    const url=new URL(value);
    const hosts:Record<string,string[]>={gemini:['gemini.google.com'],aistudio:['aistudio.google.com'],flow:['flow.google.com','labs.google']};
    if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts[provider]?.includes(url.hostname))return undefined;
    if(provider==='gemini'&&!/^\/app\/[\w-]+\/?$/.test(url.pathname))return undefined;
    if(provider==='flow'&&!/\/projects?\/[^/]+/.test(url.pathname))return undefined;
    url.search='';url.hash='';return url.href;
  }catch{return undefined}
}

export function MediaSessions({project:p,kind,act}:{project:Row,kind:'tts'|'visuals',act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const saved=p.settings?.character_references;
  const savedIds:string[]=saved?.manual&&saved.story_version===p.story_version?saved.asset_ids||[]:[];
  const [ids,setIds]=useState<string[]>(savedIds),[busy,setBusy]=useState(false);
  useEffect(()=>setIds(savedIds),[p.id,savedIds.join('|')]);
  const visualBusy=(p.jobs||[]).some((j:Row)=>j.payload?._media&&['gemini','flow'].includes(j.provider)&&['queued','running','waiting_user'].includes(j.status));
  const disabled=busy||visualBusy||!p.locked;
  const images=(p.assets||[]).filter((a:Row)=>a.kind==='image');
  const providers=kind==='tts'?['aistudio']:['gemini','flow'];
  return <div className="project-media-sessions">
    <div className="inline wrap">{providers.map(provider=>{
      const url=mediaSessionUrl(p,provider);if(!url)return null;
      return <a key={provider} className="button small" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14}/>{tr(provider==='gemini'?'Open this project’s Gemini chat':provider==='flow'?'Open this project’s Flow project':'Open this project’s AI Studio dialog')}</a>;
    })}</div>
    <p className="muted">{tr(kind==='tts'?'The project keeps its AI Studio dialog and rechecks Enzo / Friendly before each segment. An unsaved dialog is recreated with the same settings if needed.':'The project keeps one Gemini chat and one Flow project, including when a scene fails or the browser restarts.')}</p>
    {kind==='visuals'&&<details><summary>{tr('Character reference images (optional)')}</summary>
      <p>{tr('Choose up to three images from this project. Leave the selection empty to use the first completed scene image automatically. The same references are attached to Gemini and Flow scene prompts.')}</p>
      <p>{tr('New plans with opening videos create a main-cast reference image first when none is available. The same faces are reused for images and videos; the reference image stays outside the timeline.')}</p>
      <div className="reference-image-list">{images.map((a:Row)=><label key={a.id} className="check-field">
        <input type="checkbox" checked={ids.includes(a.id)} disabled={disabled||!ids.includes(a.id)&&ids.length>=3}
          onChange={e=>setIds(current=>e.target.checked?[...current,a.id]:current.filter(id=>id!==a.id))}/>
        <img loading="lazy" src={'/api/assets/'+a.id+'/file'} alt=""/>
        <span>{a.name}</span>
      </label>)}</div>
      {!images.length&&<p className="muted">{tr('No image resources yet. Automatic reference selection will start after the first scene image is downloaded.')}</p>}
      {visualBusy&&<p role="status">{tr('Finish or stop visual generation before changing character references. You can change them while narration is running.')}</p>}
      <Button small disabled={disabled||ids.join('|')===savedIds.join('|')} onClick={async()=>{
        setBusy(true);try{await act(()=>api('/projects/'+p.id+'/media-automation/references','POST',{asset_ids:ids}),'Character references saved')}finally{setBusy(false)}
      }}><Save size={14}/>{tr('Save character references')}</Button>
    </details>}
  </div>;
}
