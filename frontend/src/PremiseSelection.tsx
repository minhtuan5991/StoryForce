import {useState} from 'react';
import {ArrowRight, Check, Loader2} from 'lucide-react';
import {api, navigate} from './api';
import type {Row} from './api';
import {Button,Badge} from './components';
import {tr} from './i18n';

export function PremiseReuseNotice({project:p}:{project:Row}) {
  if(!p.selected_premise_id)return null;
  return <div className="notice compact" role="status">{tr(p.premise_reuse?.reason||'Watch and approve the final video in Render & QA first.')}</div>;
}

export function premiseUsed(project:Row,premise:Row) {
  return project.selected_premise_id===premise.id||!!project.premise_pool?.used_premise_ids?.includes(premise.id);
}

export function PremiseProjectNotice({project:p}:{project:Row}) {
  if(!p.settings?.premise_origin)return null;
  const pool=p.premise_pool;
  return <div className="notice compact"><Badge>{tr('Project from premise')}</Badge>
    {pool?.project_exists?<a className="text-link" href={'#/projects/'+pool.project_id+'/premises'}>{tr('View original idea list')}<ArrowRight size={14}/></a>:<span>{tr('The original idea list is no longer available.')}</span>}
  </div>;
}

export function PremiseChoice({project:p,premise:pr,active,act}:{project:Row,premise:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}) {
  const [busy,setBusy]=useState(false);
  const selected=p.selected_premise_id===pr.id;
  const used=premiseUsed(p,pr);
  const branching=!!p.selected_premise_id&&!selected;
  const target=p.premise_pool?.used_projects?.[pr.id];
  const choose=async()=>{
    if(busy||used)return;
    setBusy(true);
    try {
      const result=await act(()=>api('/projects/'+p.id+'/select-premise','POST',{premise_id:pr.id}),branching?'New project created from premise':'Premise selected');
      if(result?.id&&result.id!==p.id)navigate('/projects/'+result.id+'/bible');
    } catch { /* The shared action displays the error. */ }
    finally {setBusy(false)}
  };
  if(used&&target?.project_id&&target.project_id!==p.id)return <Button small onClick={()=>navigate('/projects/'+target.project_id+'/bible')}><ArrowRight size={14}/>{tr('Open created project')}</Button>;
  return <Button small primary disabled={busy||active||used||(branching&&!p.premise_reuse?.ready)||pr.warnings.some((w:Row)=>w.level==='BLOCK')}
    title={branching?tr(p.premise_reuse?.ready?'Create a new project from this premise':p.premise_reuse?.reason||'Watch and approve the final video in Render & QA first.'):undefined}
    onClick={choose}>{busy?<Loader2 size={14} className="spin"/>:used?<Check size={14}/>:null}{tr(used?(target?.deleted?'Used premise · project deleted':'Used premise'):branching?'Create new project':'Choose')}{!used&&!busy&&<ArrowRight size={14}/>}</Button>;
}
