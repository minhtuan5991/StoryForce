import {useEffect, useState} from 'react';
import {Film, FolderOpen, Loader2} from 'lucide-react';
import {api, type Row} from './api';
import {Button, Field, Modal, Progress} from './components';
import {tr} from './i18n';

export function CapCutExport({projectId}:{projectId:string}) {
  const [open,setOpen]=useState(false), [folder,setFolder]=useState('');
  const [job,setJob]=useState<Row|null>(null), [error,setError]=useState(''), [starting,setStarting]=useState(false);
  useEffect(()=>{if(!open)return;let alive=true;api('/capcut').then(info=>{if(alive)setFolder(current=>current||info.drafts_folder)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[open]);
  const active=!!job&&['queued','running'].includes(job.status);
  useEffect(()=>{
    if(!job?.id||!active)return;
    let alive=true;
    const poll=()=>api('/jobs/'+job.id).then(value=>{if(alive){setJob(value);setError('')}}).catch(e=>{if(alive)setError(e.message)});
    const timer=setInterval(poll,1500);poll();
    return()=>{alive=false;clearInterval(timer)};
  },[job?.id,active]);
  async function start(){
    setStarting(true);setError('');
    try {setJob(await api('/projects/'+projectId+'/export-capcut','POST',{drafts_folder:folder}));}
    catch(e){setError((e as Error).message)}finally{setStarting(false)}
  }
  return <><button type="button" className="capcut-export-card" onClick={()=>setOpen(true)}>
    <Film size={24}/><strong>{tr('Export CapCut project')}</strong>
    <span>{tr('Editable project with assigned media placed on the timeline')}</span><FolderOpen size={17}/>
  </button>{open&&<Modal title={tr('Export CapCut project')} onClose={()=>setOpen(false)}>
    <p>{tr('Creates a new CapCut Desktop project with its own copy of your media. No video rendering is needed in StoryForge.')}</p>
    <Field label={tr('CapCut drafts folder')} hint={tr('Use CapCut Settings → Draft location. Select the folder containing projects, not an individual project.')}>
      <input aria-label={tr('CapCut drafts folder')} value={folder} disabled={active||starting} onChange={e=>setFolder(e.target.value)} placeholder="C:\…\CapCut\User Data\Projects\com.lveditor.draft"/>
    </Field>
    <div className="notice compact">{tr('Uses the current narration and scene timeline, native video lengths, ending thumbnail, and your selected subtitles, waveform and logo. Scene video sound is muted; narration remains on its own track.')}</div>
    {active&&<div role="status"><p>{tr(job!.step||'Exporting CapCut project…')}</p><Progress value={job!.progress||0}/></div>}
    {job?.status==='completed'&&<div className="notice compact" role="status">
      <strong>{tr('CapCut project ready')}</strong>
      <p className="capcut-path">{job.result?.folder}</p>
      <p>{tr('Open CapCut and select this new project on the Home screen. Restart CapCut if it is not listed, then export your video.')}</p>
    </div>}
    {(error||job?.status==='failed')&&<p className="error-text" role="alert">{tr(error||job?.error||'Export failed')}</p>}
    {job?.status==='cancelled'&&<p role="status">{tr('CapCut export cancelled')}</p>}
    <div className="inline wrap"><Button primary disabled={!folder.trim()||active||starting} onClick={start}>
      {(active||starting)&&<Loader2 size={16} className="spin"/>}{tr(active||starting?'Exporting CapCut project…':'Export CapCut project')}
    </Button><Button onClick={()=>setOpen(false)}>{tr('Close dialog')}</Button></div>
  </Modal>}</>;
}
