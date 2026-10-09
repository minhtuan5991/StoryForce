import {useEffect,useRef,useState} from 'react';
import {Music2,Upload} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Section} from './components';
import {tr} from './i18n';
import {resourcesCleaned} from './ResourceCleanup';

export function BackgroundMusicPanel({project,active,act}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [library,setLibrary]=useState<Row|null>(null),[busy,setBusy]=useState(false);
  const upload=useRef<HTMLInputElement>(null),disabled=!project.locked||active||busy||resourcesCleaned(project);
  const state=project.settings?.background_music||{},enabled=!!project.settings?.production_options?.music_enabled;
  useEffect(()=>{let cancelled=false;api('/background-music').then(result=>{if(!cancelled)setLibrary(result)}).catch(()=>{});return ()=>{cancelled=true}},[project.id,state.status]);
  const run=async()=>{setBusy(true);try{await act(()=>api('/projects/'+project.id+'/background-music','POST',{retry:state.status==='missing'}),'Background music prepared')}finally{setBusy(false)}};
  const linked=project.assets?.find((a:Row)=>a.kind==='music'&&a.metadata_json?.shared_library_id&&a.story_version===project.story_version);
  return <Section title={tr('Shared background music')} caption={tr('Lyria instrumental · stronger opening · quiet looping bed · narration ducking')}>
    <p className="muted">{enabled?tr('Background music is enabled for this project.'):tr('Background music is optional. Your project currently uses narration without automatic music.')}</p>
    {library&&<p className="muted" style={{overflowWrap:'anywhere'}}>{tr('Shared folder')}: {library.folder}</p>}
    {linked?<audio controls preload="metadata" src={'/api/assets/'+linked.id+'/file'} aria-label={tr('Project background music')}/>:<p className="muted">{state.reason||tr(state.status==='waiting_library'?'Waiting for the shared track; no additional generation will be sent.':state.status==='generating'?'Lyria is creating one reusable track.':'Reuse an existing track or create one short Lyria clip.')}</p>}
    {!linked&&library?.items?.[0]&&<audio controls preload="metadata" src={'/api/assets/'+library.items[0].id+'/file'} aria-label={tr('Shared music preview')}/>}
    <div className="inline">
      <Button disabled={!project.locked||active||busy||resourcesCleaned(project)} onClick={run}><Music2 size={16}/>{tr(linked?'Reuse shared music':library?.items?.length?'Use shared music':state.status==='missing'?'Retry Lyria music':'Create shared Lyria music')}</Button>
      <Button disabled={disabled} onClick={()=>upload.current?.click()}><Upload size={16}/>{tr('Import reusable music')}</Button><input ref={upload} type="file" aria-label={tr('Import reusable music')} accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" disabled={disabled} hidden onChange={async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;setBusy(true);const data=new FormData();data.append('file',file);try{await act(()=>api('/projects/'+project.id+'/background-music/import','POST',data),'Background music imported');setLibrary(await api('/background-music'))}finally{setBusy(false);input.value=''}}}/>
    </div>
    <p className="muted">{tr('One shared track can serve many videos. Cleaning a project keeps the shared library. If Lyria fails, production continues and the missing music is listed here.')}</p>
  </Section>;
}
