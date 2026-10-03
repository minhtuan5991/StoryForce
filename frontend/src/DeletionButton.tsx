import { useEffect, useState } from 'react';
import { Loader2, Trash2, TriangleAlert } from 'lucide-react';
import { api, label } from './api';
import type { Row } from './api';
import { Button, Modal, Status } from './components';
import { tr } from './i18n';

type Kind = 'sources' | 'novelty' | 'jobs' | 'projects' | 'channels';
type Props = {kind:Kind, ids:string[], title?:string, caption?:string, onDeleted:()=>void};

export function DeletionButton({kind, ids, title, caption, onDeleted}:Props) {
  const [selection,setSelection]=useState<string[]|null>(null);
  return <><Button small className="delete-button" disabled={!ids.length} aria-label={title?tr('Delete')+' '+title:tr('Delete selected items')}
    onClick={()=>setSelection([...ids])}><Trash2 size={15} aria-hidden="true"/>{tr(caption||'Delete')}{!title&&` (${ids.length})`}</Button>
    {selection&&<DeletionDialog kind={kind} ids={selection} onClose={()=>setSelection(null)} onDeleted={()=>{setSelection(null);onDeleted()}}/>}</>;
}

function DeletionDialog({kind, ids, onClose, onDeleted}:{kind:Kind,ids:string[],onClose:()=>void,onDeleted:()=>void}) {
  const [report,setReport]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[deleteFiles,setDeleteFiles]=useState(false),[removed,setRemoved]=useState<Row|null>(null);
  const bytes=(n:number)=>n>=1073741824?(n/1073741824).toFixed(2)+' GB':(n/1048576).toFixed(2)+' MB';
  useEffect(()=>{let alive=true;setReport(null);setError('');api('/deletions/preview','POST',{kind,ids,delete_files:deleteFiles}).then(r=>{if(alive)setReport(r)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[kind,ids,deleteFiles]);
  const refresh=async()=>{
    setBusy(true);setError('');setReport(null);
    try{setReport(await api('/deletions/preview','POST',{kind,ids,delete_files:deleteFiles}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  };
  const remove=async()=>{
    if(!report||report.blocked||busy||!!report.delete_files!==deleteFiles)return;
    setBusy(true);setError('');
    try{const result=await api('/deletions/confirm','POST',{kind,ids,delete_files:deleteFiles,confirmation:report.confirmation});if(result.file_cleanup){setRemoved(result.file_cleanup);setReport(null)}else onDeleted()}
    catch(e){setError((e as Error).message);setReport(null);try{setReport(await api('/deletions/preview','POST',{kind,ids,delete_files:deleteFiles}))}catch{/* Keep the deletion error visible; allow retry or close. */}}
    finally{setBusy(false)}
  };
  if(removed)return <Modal title={tr(kind==='channels'?'Channel deletion finished':'Project deletion finished')} onClose={onDeleted}>
    <p>{tr('Files removed')}: {removed.removed_files} · {tr('Space freed')}: {bytes(removed.freed_bytes)}</p>
    {removed.failed_files.length>0&&<div role="alert" className="notice error"><div><strong>{tr('Some files could not be removed. Close apps using them, then remove these files manually:')}</strong><ul>{removed.failed_files.map((path:string)=><li key={path}>{path}</li>)}</ul></div></div>}
    {!!removed.kept_files.length&&<p>{tr('Shared files and linked folders were kept.')}</p>}
    <div className="modal-actions"><Button primary onClick={onDeleted}>{tr('Close')}</Button></div>
  </Modal>;
  return <Modal title={tr(kind==='channels'?'Delete channel and its projects':'Review deletion')} onClose={()=>{if(!busy)onClose()}}>
    {(kind==='projects'||kind==='channels')&&<label className="check-field"><input type="checkbox" checked={deleteFiles} disabled={busy} onChange={e=>{setReport(null);setDeleteFiles(e.target.checked)}}/>{tr('Delete private project media and generated files from disk')}</label>}
    {!report&&!error&&<p role="status"><Loader2 className="spin" size={16}/> {tr('Checking related work…')}</p>}
    {error&&<p role="alert" className="notice error">{tr(error)}</p>}
    {report&&<>
      <p>{tr('The following items will be permanently deleted:')}</p>
      <ul className="deletion-list">{report.items.map((item:Row)=><li key={item.id}>{kind==='jobs'?label(item.title):item.title}</li>)}</ul>
      {report.file_cleanup&&<div className="notice compact"><div><strong>{tr('Files to remove')}: {report.file_cleanup.count} · {bytes(report.file_cleanup.bytes)}</strong><p>{tr('Includes imported copies, audio, images, video, render attempts and TXT files inside this project folder. Exports and originals elsewhere remain.')}</p><details><summary>{tr('Review file list')}</summary><ul className="deletion-list">{report.file_cleanup.files.map((file:Row)=><li key={file.path}>{file.path} · {bytes(file.bytes)}</li>)}</ul></details>{!!report.file_cleanup.kept.length&&<p>{tr('Shared files and linked folders were kept.')} ({report.file_cleanup.kept.length})</p>}</div></div>}
      {kind==='sources'&&<p>{tr('Sources are shared by Content inbox and Source library. Deleting here removes them from both pages, including their source-only analysis and history.')}</p>}
      {report.warnings.map((warning:string)=><div key={warning} className="notice compact deletion-warning"><TriangleAlert size={18} aria-hidden="true"/><span>{tr(warning)}</span></div>)}
      {!!report.projects.length&&<><h3>{tr('Linked projects')}</h3><ul className="deletion-list">{report.projects.map((p:Row)=><li key={p.id}>{p.title} · {label(p.stage)}</li>)}</ul></>}
      {report.blocked&&<div className="notice error deletion-blocked" role="alert"><strong>{tr('Cannot delete while related work is active.')}</strong><p>{tr('Wait for completion, or cancel the related job in Activity & jobs and wait for it to stop. Then check again.')}</p><ul className="deletion-list">{report.blockers.map((j:Row)=><li key={j.id}>{label(j.kind)}{(j.project_title||j.source_title)&&' · '+(j.project_title||j.source_title)} · <Status value={j.status}/>{j.worker_active&&<span> · {tr('Worker is still stopping or finishing.')}</span>}</li>)}</ul></div>}
      <p className="muted">{tr('This action cannot be undone.')}</p>
    </>}
    <div className="modal-actions"><Button autoFocus disabled={busy} onClick={onClose}>{tr('Cancel')}</Button>
      <Button disabled={busy} onClick={refresh}>{tr('Check again')}</Button>
      <Button className="delete-button" disabled={busy||!report||report.blocked||!!report.delete_files!==deleteFiles} onClick={remove}>{busy?<Loader2 size={15} className="spin"/>:<Trash2 size={15}/>} {tr('Confirm deletion')}</Button>
    </div>
  </Modal>;
}
