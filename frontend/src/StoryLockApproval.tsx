import {ViewText} from './ViewTranslation';
import {useState} from 'react';
import {CheckCircle2, Clock3, LockKeyhole} from 'lucide-react';
import {Button, Modal, Section} from './components';
import {label} from './api';
import type {Row} from './api';
import {tr} from './i18n';

function reasonText(reason:string){
  const match=reason.match(/^(final_verify_\w+): (quality gate failed|verify the current draft)$/);
  return match?label(match[1])+': '+tr(match[2]):tr(reason);
}
function Warnings({project:p}:{project:Row}){
  return <><ul className="gate-list">{p.lock_gate.reasons.map((reason:string)=><li key={reason}><Clock3 size={15} aria-hidden="true"/>{reasonText(reason)}</li>)}</ul>
    <p>{tr('Current draft')}: {p.word_count} {tr('words')} · {tr('Word target')}: {p.profile.word_range.join('–')}</p>
    {['final_verify_gemini','final_verify_chatgpt'].map(kind=>p.artifacts[kind]&&<details key={kind}><summary>{label(kind)}</summary><p><ViewText text={p.artifacts[kind].content.summary}/></p></details>)}</>;
}
export function StoryLockApproval({project:p,onApprove}:{project:Row,onApprove:(body?:Row)=>Promise<any>}){
  const [warning,setWarning]=useState<Row|null>(null),[saving,setSaving]=useState(false);
  const active=p.jobs.some((job:Row)=>['queued','running','waiting_user'].includes(job.status));
  const unavailable=!p.draft?.trim()||!p.story_version||active;
  const approve=async(body?:Row)=>{setSaving(true);try{if(await onApprove(body))setWarning(null)}finally{setSaving(false)}};
  return <><Section title={p.locked?tr('Story locked. Ready for production.'):tr('A deliberate checkpoint')}
    caption={tr('Review verification warnings before approving production.')}
    action={<Button primary disabled={p.locked||unavailable||saving} title={active?tr('Finish or cancel active jobs before approving Story Lock'):unavailable?tr('Create a draft before approving Story Lock'):''}
      onClick={()=>p.lock_gate.can_lock?void approve():setWarning(structuredClone(p))}><LockKeyhole size={16} aria-hidden="true"/>{p.locked?tr('Locked v')+p.story_version+'.0':tr('Approve Story Lock')}</Button>}>
    {p.lock_gate.can_lock?<div className="notice success"><CheckCircle2 size={22}/><div><strong>{tr('Quality gates passed')}</strong><p>{tr('Review the story yourself before approving production.')}</p></div></div>:<Warnings project={p}/>}
    {p.artifacts.story_lock_approval?.story_version===p.story_version&&<p className="notice compact">{tr('This version was approved manually with the recorded warnings.')}</p>}
    {active&&<p className="muted">{tr('Finish or cancel active jobs before approving Story Lock')}</p>}
  </Section>{warning&&<Modal title={tr('Approve despite verification warnings?')} onClose={()=>{if(!saving)setWarning(null)}} wide>
    <div className="notice compact">{tr('This story has not passed all quality checks. Confirm only after reviewing these warnings. Your decision will be recorded; AI results will remain unchanged.')}</div>
    <Warnings project={warning}/>
    <div className="modal-actions"><Button disabled={saving} onClick={()=>setWarning(null)}>{tr('Cancel')}</Button><Button primary disabled={saving||active} onClick={()=>void approve({confirm_warnings:true,approval_token:warning.lock_gate.approval_token})}><LockKeyhole size={16} aria-hidden="true"/>{tr('Confirm Story Lock despite warnings')}</Button></div>
  </Modal>}</>;
}
