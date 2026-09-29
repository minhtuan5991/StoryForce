import {useState} from 'react';
import {Trash2} from 'lucide-react';
import {api, type Row} from './api';
import {Button, Modal} from './components';
import {usePageSelection} from './BulkSelection';
import {tr} from './i18n';

export function AssetSelection({project,selection,act,onDeleted}:{project:Row,selection:ReturnType<typeof usePageSelection>,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,onDeleted:()=>void}){
  const [pending,setPending]=useState<string[]|null>(null),[busy,setBusy]=useState(false);
  const [cleanupWarning,setCleanupWarning]=useState(false);
  const blocked=project.jobs?.some((j:Row)=>['queued','running'].includes(j.status));
  async function remove(){
    if(!pending||busy)return;
    setBusy(true);
    try{
      const result=await act(()=>api('/projects/'+project.id+'/assets/delete','POST',{ids:pending}),'Assets deleted');
      if(result){setCleanupWarning(!!result.cleanup?.failed_files?.length);selection.clear();setPending(null);onDeleted()}
    }finally{setBusy(false)}
  }
  return <><div className="bulk-toolbar">
    <Button small disabled={!project.assets.length||blocked} onClick={selection.all?selection.clear:selection.selectAll}>{tr(selection.all?'Clear selection':'Select all')}</Button>
    <Button small disabled={!selection.ids.length||blocked} onClick={()=>setPending([...selection.ids])}><Trash2 size={15}/>{tr('Delete selected items')} ({selection.ids.length})</Button>
    <Button small disabled={!project.assets.length||blocked} onClick={()=>setPending(project.assets.map((a:Row)=>a.id))}>{tr('Delete all assets')}</Button>
    <span role="status">{tr('Selected')}: {selection.ids.length} / {project.assets.length}</span>
  </div>{cleanupWarning&&<p role="alert">{tr('Assets were removed from the project, but some imported copies could not be deleted from disk.')}</p>}{blocked&&<p className="muted">{tr('Wait for running jobs before deleting assets')}</p>}
  {pending&&<Modal title={tr('Delete assets')} onClose={()=>!busy&&setPending(null)}>
    <p>{tr('Selected')}: {pending.length}</p>
    <p>{tr('Remove these assets and their scene/audio assignments. Private imported copies will be deleted. Original files and rendered videos are kept.')}</p>
    <p>{tr('Upload and map replacement assets before rendering again.')}</p>
    <div className="modal-actions"><Button disabled={busy} onClick={()=>setPending(null)}>{tr('Cancel')}</Button><Button disabled={busy} onClick={remove}><Trash2 size={15}/>{tr(busy?'Deleting…':'Delete assets')}</Button></div>
  </Modal>}</>;
}
