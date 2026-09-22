import {useState} from 'react';
import {CheckCircle2, Loader2} from 'lucide-react';
import {api, navigate} from './api';
import type {Row} from './api';
import {Button, Modal} from './components';
import {tr} from './i18n';

export function CompleteResourcesButton({job,onCompleted}:{job:Row,onCompleted:()=>void}){
  const [busy,setBusy]=useState(false),[validation,setValidation]=useState<Row|null>(null),[error,setError]=useState('');
  const complete=async()=>{
    setBusy(true);setError('');
    try{
      const result=await api('/jobs/'+job.id+'/complete-resources','POST');
      if(result.completed){onCompleted();navigate('/projects/'+result.project_id+'/timeline')}
      else setValidation(result.validation);
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  };
  return <><Button small primary disabled={busy} onClick={()=>void complete()}>{busy?<Loader2 size={14} className="spin"/>:<CheckCircle2 size={14}/>} {tr(busy?'Checking resources…':'All resources uploaded')}</Button>
    {(validation||error)&&<Modal title={tr('Check uploaded resources')} onClose={()=>{setValidation(null);setError('')}}>
      {error?<p role="alert" className="error-text">{tr(error)}</p>:<><p>{tr('Attach all narration and visuals to the correct chunks and scenes before continuing.')}</p>
        <p>{tr('Narration')}: {validation!.narration.join(' / ')} · {tr('Visuals')}: {validation!.visuals.join(' / ')}</p>
        <ul>{validation!.missing.map((item:string)=><li key={item}>{tr(item)}</li>)}</ul></>}
      <div className="modal-actions"><Button onClick={()=>{setValidation(null);setError('')}}>{tr('Cancel')}</Button><a className="button primary" href={'#/projects/'+job.project_id+'/assets'}>{tr('Open assets')}</a></div>
    </Modal>}</>;
}
