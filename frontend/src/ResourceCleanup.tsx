import {useEffect, useState} from 'react';
import {FolderOpen, Loader2, RefreshCw, Trash2, TriangleAlert} from 'lucide-react';
import {api, label} from './api';
import type {Row} from './api';
import {Button, Modal, Section} from './components';
import {FinalVideoDownload} from './FinalVideoDownload';
import {tr} from './i18n';

type Act = (fn:()=>Promise<any>, message?:string)=>Promise<any>;
const bytes = (n:number)=>n>=1073741824?(n/1073741824).toFixed(2)+' GB':(n/1048576).toFixed(2)+' MB';
export const resourcesCleaned = (p:Row)=>['completed','partial'].includes(p.settings?.resource_cleanup?.status);

export function ResourceCleanup({project:p, active, act}:{project:Row, active:boolean, act:Act}) {
  const [open,setOpen]=useState(false),[resuming,setResuming]=useState(false);
  const cleaned=resourcesCleaned(p);
  return <Section title={tr('Project storage')} caption={tr('The storage folder follows the English story title. Project links and IDs stay the same.')}>
    {p.storage_folder&&<p className="storage-path"><FolderOpen size={16} aria-hidden="true"/><span>{p.storage_folder}</span></p>}
    <p>{tr('Clean audio, images, videos, render caches and recorded project copies. Keep the current final video and story records.')}</p>
    {cleaned&&<div className="notice compact" role="status"><div><strong>{tr('Resources have been cleaned; the final video is kept.')}</strong><p>{tr('Recreating resources is required to render again or export a CapCut project.')}</p><FinalVideoDownload projectId={p.id} act={act}/></div></div>}
    <div className="inline wrap">
      <Button className="delete-button" disabled={active||resuming} title={active?tr('Finish the active project job first.'):undefined} onClick={()=>setOpen(true)}><Trash2 size={16} aria-hidden="true"/>{tr('Delete resource data')}</Button>
      {cleaned&&<Button disabled={active||resuming} onClick={async()=>{
        setResuming(true);
        try { await act(()=>api('/projects/'+p.id+'/resources/resume','POST'),'Resource production reopened. Recreate or attach the missing resources.'); }
        finally {setResuming(false)}
      }}>{resuming?<Loader2 size={16} className="spin" aria-hidden="true"/>:<RefreshCw size={16} aria-hidden="true"/>}{tr('Recreate resources')}</Button>}
    </div>
    {open&&<CleanupDialog projectId={p.id} onClose={()=>setOpen(false)} onChanged={async(result)=>{await act(()=>Promise.resolve(result),'Resource cleanup finished');}}/>}
  </Section>;
}

function CleanupDialog({projectId,onClose,onChanged}:{projectId:string,onClose:()=>void,onChanged:(result:Row)=>Promise<void>}) {
  const [report,setReport]=useState<Row|null>(null),[result,setResult]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=async()=>{
    setReport(null);
    try {setReport(await api('/projects/'+projectId+'/resources/cleanup-preview'))}
    catch(e){setError((e as Error).message)}
  };
  useEffect(()=>{let alive=true;
    api('/projects/'+projectId+'/resources/cleanup-preview').then(r=>{if(alive)setReport(r)}).catch(e=>{if(alive)setError(e.message)});
    return()=>{alive=false};
  },[projectId]);
  const remove=async()=>{
    if(!report||report.blocked||busy)return;
    setBusy(true);setError('');
    try {
      const outcome=await api('/projects/'+projectId+'/resources/cleanup','POST',{confirmation:report.confirmation});
      setResult(outcome);await onChanged(outcome);
    } catch(e) {setError((e as Error).message);await load();}
    finally {setBusy(false)}
  };
  return <Modal title={tr(result?'Resource cleanup finished':'Delete resource data')} onClose={()=>{if(!busy)onClose()}}>
    {error&&<p role="alert" className="notice error">{tr(error)}</p>}
    {result?<>
      <p role="status">{tr('Files removed')}: {result.removed_files} · {tr('Space freed')}: {bytes(result.freed_bytes)}</p>
      <p className="storage-path"><span>{tr('Final video kept')}: {result.final}</span></p>
      {!!result.failed_files.length&&<div role="alert" className="notice error"><div><strong>{tr('Some files are still in use or could not be deleted. Close apps using them and run cleanup again.')}</strong><ul className="deletion-list">{result.failed_files.map((f:Row)=><li key={f.path}>{f.path}</li>)}</ul></div></div>}
      <p>{tr('Story Bible, draft, idea history and publication information remain in the app.')}</p>
      <div className="modal-actions"><Button primary onClick={onClose}>{tr('Close')}</Button></div>
    </>:<>
      {!report&&!error&&<p role="status"><Loader2 size={16} className="spin" aria-hidden="true"/> {tr('Checking project files…')}</p>}
      {report&&<>
        <p><strong>{report.title}</strong></p>
        <div className="notice compact"><div><strong>{tr('Files to remove')}: {report.count} · {bytes(report.bytes)}</strong><p>{tr('Final video kept')}: <span className="storage-path">{report.final||tr('Not available')}</span></p></div></div>
        <div className="notice compact deletion-warning"><TriangleAlert size={18} aria-hidden="true"/><span>{tr('This permanently removes source media and render caches. Rendering again and CapCut export will require new resources. The story and current final video remain.')}</span></div>
        {report.blocked&&<div role="alert" className="notice error"><div><strong>{tr(report.reason||'Finish or cancel active project jobs before cleaning resources.')}</strong>{report.blockers.map((j:Row)=><p key={j.id}>{label(j.kind)} · {label(j.status)}</p>)}</div></div>}
        {!report.was_current&&report.final&&<p className="muted">{tr('The retained final does not match the latest resource settings. It cannot unlock another idea until a current final is reviewed.')}</p>}
        <details><summary>{tr('Review file list')}</summary><ul className="deletion-list">{report.files.map((f:Row)=><li key={f.path}>{f.path} · {bytes(f.bytes)}</li>)}</ul></details>
        <details><summary>{tr('Files that will be kept')} ({report.kept.length})</summary><ul className="deletion-list">{report.kept.map((f:Row,i:number)=><li key={f.path+i}>{f.path} · {tr(f.reason)}</li>)}</ul></details>
        <p className="muted">{tr('Only verified project copies on the system drive are removed. Shared browser caches, other projects and untracked originals are kept.')}</p>
      </>}
      <div className="modal-actions"><Button autoFocus disabled={busy} onClick={onClose}>{tr('Cancel')}</Button><Button disabled={busy} onClick={async()=>{setError('');await load()}}>{tr('Check again')}</Button><Button className="delete-button" disabled={busy||!report||report.blocked||report.count===0} onClick={remove}>{busy?<Loader2 size={16} className="spin" aria-hidden="true"/>:<Trash2 size={16} aria-hidden="true"/>}{tr('Confirm resource cleanup')}</Button></div>
    </>}
  </Modal>;
}
