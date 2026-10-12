import {useEffect,useRef,useState} from 'react';
import {Music2,Upload} from 'lucide-react';
import {api,type Row} from './api';
import {Button,Field,Section} from './components';
import {tr} from './i18n';
import {resourcesCleaned} from './ResourceCleanup';

export function BackgroundMusicPanel({project,active,act}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [library,setLibrary]=useState<Row|null>(null),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[loadError,setLoadError]=useState('');
  const upload=useRef<HTMLInputElement>(null),disabled=!project.locked||active||busy||resourcesCleaned(project);
  const state=project.settings?.background_music||{},enabled=!!project.settings?.production_options?.music_enabled;
  useEffect(()=>{let cancelled=false;api('/background-music').then(result=>{if(!cancelled){setLibrary(result);setLoadError('')}}).catch(e=>{if(!cancelled)setLoadError(e.message)});return ()=>{cancelled=true}},[project.id,state.status]);
  useEffect(()=>{setSelected(state.library_id||'')},[project.id,state.library_id]);
  const reload=async()=>{setBusy(true);try{setLibrary(await api('/background-music'));setLoadError('')}catch(e){setLoadError((e as Error).message)}finally{setBusy(false)}};
  const choose=async()=>{setBusy(true);try{await act(()=>api('/projects/'+project.id+'/background-music/select','POST',{library_id:selected}),'Background music selected')}finally{setBusy(false)}};
  const run=async(regenerate=false)=>{setBusy(true);try{await act(()=>api('/projects/'+project.id+'/background-music','POST',{retry:state.status==='missing',regenerate}),regenerate?'Long background music queued':'Background music prepared')}finally{setBusy(false)}};
  const linked=project.assets?.find((a:Row)=>a.id===state.asset_id&&a.kind==='music')||project.assets?.find((a:Row)=>a.kind==='music'&&a.metadata_json?.shared_library_id&&a.story_version===project.story_version);
  const selectedTrack=library?.items?.find((item:Row)=>item.id===selected),available=library?.items?.filter((item:Row)=>item.available!==false)||[];
  const duration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  return <Section title={tr('Shared background music')} caption={tr('Lyria instrumental · continuous music · fixed level during speech')}>
    <p className="muted">{enabled?tr('Background music is enabled for this project.'):tr('Background music is optional. Your project currently uses narration without automatic music.')}</p>
    <p className="muted">{tr('Music uses its original file level (0 dB), without reduction during speech. The final mix only limits excessive peaks. Render again to apply this to an existing video.')}</p>
    <p className="muted">{tr('New music uses Lyria 3 Pro Preview in Google AI Studio: about 2–3 instrumental minutes, with a seamless loop between the ending and opening.')}</p>
    {['generating','waiting_library'].includes(state.status)&&<p role="status">{tr(state.status==='generating'?'Lyria is creating one long reusable track.':'Waiting for the shared track; no additional generation will be sent.')}</p>}
    {state.upgrade_notice&&<p role="status">{state.upgrade_notice}</p>}
    {library&&<p className="muted" style={{overflowWrap:'anywhere'}}>{tr('Shared folder')}: {library.folder}</p>}
    <p className="muted">{tr('Copy audio files into this folder, then refresh the list. Choose a different track for each project; the original files are kept.')}</p>
    {loadError&&<p role="alert">{loadError}</p>}
    <Field label={tr('Choose background music')}><select value={selected} disabled={disabled||!library} onChange={e=>setSelected(e.target.value)}>
      <option value="">{tr('Choose a shared track')}</option>
      {(library?.items||[]).map((item:Row)=><option key={item.id} value={item.id} disabled={item.available===false}>{item.display_name||item.name} · {duration(item.duration||0)}{item.available===false?' · '+tr('File unavailable'):''}</option>)}
    </select></Field>
    {selectedTrack?.available!==false&&selectedTrack&&selectedTrack.id!==state.library_id&&<audio controls preload="metadata" src={'/api/assets/'+selectedTrack.id+'/file'} aria-label={tr('Selected music preview')}/>}
    {(library?.errors||[]).length>0&&<details><summary>{tr('Music files need attention')}</summary>{(library?.errors||[]).map((item:Row)=><p key={item.name}>{item.name}: {item.reason}</p>)}</details>}
    {linked?<audio controls preload="metadata" src={'/api/assets/'+linked.id+'/file'} aria-label={tr('Project background music')}/>:<p className="muted">{state.reason||tr(state.status==='waiting_library'?'Waiting for the shared track; no additional generation will be sent.':state.status==='generating'?'Lyria is creating one long reusable track.':'Reuse an existing track or create one long Lyria track.')}</p>}
    <div className="inline">
      <Button disabled={disabled||!selectedTrack||selectedTrack.available===false} onClick={()=>choose()}><Music2 size={16}/>{tr('Use selected music')}</Button>
      <Button disabled={busy} onClick={()=>reload()}>{tr('Refresh music list')}</Button>
      {!available.length&&<Button disabled={disabled} onClick={()=>run()}>{tr(state.status==='missing'?'Retry Lyria music':'Create shared Lyria music')}</Button>}
      <Button disabled={disabled} onClick={()=>run(true)}>{tr('Create new long Lyria music')}</Button>
      <Button disabled={disabled} onClick={()=>upload.current?.click()}><Upload size={16}/>{tr('Import reusable music')}</Button><input ref={upload} type="file" aria-label={tr('Import reusable music')} accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" disabled={disabled} hidden onChange={async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;setBusy(true);const data=new FormData();data.append('file',file);try{await act(()=>api('/projects/'+project.id+'/background-music/import','POST',data),'Background music imported');setLibrary(await api('/background-music'))}finally{setBusy(false);input.value=''}}}/>
    </div>
    <p className="muted">{tr('One shared track can serve many videos. Cleaning a project keeps the shared library. If Lyria fails, production continues and the missing music is listed here.')}</p>
  </Section>;
}
