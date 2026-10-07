import {useState} from 'react';
import {Download,Loader2} from 'lucide-react';
import {api} from './api';
import {Button} from './components';
import {tr} from './i18n';

export function FinalVideoDownload({projectId,act}:{projectId:string,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [busy,setBusy]=useState(false),[path,setPath]=useState('');
  return <div className="final-video-download">
    <Button small disabled={busy} onClick={async()=>{
      setBusy(true);setPath('');
      try{const result=await act(()=>api('/projects/'+projectId+'/download-final','POST'),'Final video saved to the project’s Downloads folder');if(result?.saved)setPath(result.path)}
      finally{setBusy(false)}
    }}>{busy?<Loader2 size={14} className="spin"/>:<Download size={14}/>}final_video.mp4</Button>
    {busy&&<p className="muted" role="status">{tr('Saving final video to the project’s Downloads folder…')}</p>}
    {path&&<p className="muted" role="status">{tr('Saved to')}: <span>{path}</span></p>}
  </div>;
}
