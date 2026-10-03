import {useState} from 'react';
import {ArrowRight, Check, Loader2} from 'lucide-react';
import {api, navigate} from './api';
import type {Row} from './api';
import {Button} from './components';
import {tr} from './i18n';

export function PremiseReuseNotice({project:p}:{project:Row}) {
  if(!p.selected_premise_id)return null;
  return <div className="notice compact" role="status">{tr(p.premise_reuse?.reason||'Watch and approve the final video in Render & QA first.')}</div>;
}

export function PremiseChoice({project:p,premise:pr,active,act}:{project:Row,premise:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}) {
  const [busy,setBusy]=useState(false);
  const selected=p.selected_premise_id===pr.id;
  const branching=!!p.selected_premise_id&&!selected;
  const choose=async()=>{
    if(busy)return;
    setBusy(true);
    try {
      const result=await act(()=>api('/projects/'+p.id+'/select-premise','POST',{premise_id:pr.id}),branching?'New project created from premise':'Premise selected');
      if(result?.id&&result.id!==p.id)navigate('/projects/'+result.id+'/bible');
    } catch { /* The shared action displays the error. */ }
    finally {setBusy(false)}
  };
  return <Button small primary disabled={busy||active||selected||(branching&&!p.premise_reuse?.ready)||pr.warnings.some((w:Row)=>w.level==='BLOCK')}
    title={branching?tr(p.premise_reuse?.ready?'Create a new project from this premise':p.premise_reuse?.reason||'Watch and approve the final video in Render & QA first.'):undefined}
    onClick={choose}>{busy?<Loader2 size={14} className="spin"/>:selected?<Check size={14}/>:null}{tr(selected?'Selected':branching?'Create new project':'Choose')}{!selected&&!busy&&<ArrowRight size={14}/>}</Button>;
}
