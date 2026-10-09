import {useState} from 'react';
import {api,time,type Row} from './api';
import {Button,Section,Readable,Status} from './components';
import {ViewText} from './ViewTranslation';
import {tr} from './i18n';

type Act=(fn:()=>Promise<any>,message?:string)=>Promise<any>;

export function AudienceReadiness({project:p,active,run}:{project:Row,active:boolean,run:(kind:string,payload?:Row)=>void}){
  const ready=p.audience_readiness||{}, report=ready.audit?.content;
  const flags=[['story_integrity_passed','Story integrity'],['retention_readiness_passed','Retention readiness'],['packaging_alignment_passed','Title and thumbnail alignment'],['youtube_readiness_passed','YouTube preparation']];
  return <Section title={tr('YouTube preparation')} caption={tr('AI editorial assessment. Scores and estimated timestamps are not observed YouTube results.')}>
    <div className="qa-checks">{flags.map(([key,name])=><div key={key}><span>{tr(name)}</span><strong>{tr(ready[key]===true?'Pass':ready[key]===false?'Needs attention':'Not assessed')}</strong></div>)}</div>
    {ready.status==='STALE'&&<p className="notice compact">{tr('The draft, outline or promise changed. Assess the current version again.')}</p>}
    {ready.status==='NOT_ASSESSED'&&!ready.required&&<p className="muted">{tr('Existing projects remain usable. Retention assessment is optional for these projects.')}</p>}
    <div className="inline wrap"><Button disabled={active||p.locked||!p.draft} onClick={()=>run('retention_audit',{auto_continue:true})}>{tr('Assess retention and promise')}</Button>
      <Button disabled={active||p.locked||ready.status!=='ASSESSED'||!report?.issues?.length} onClick={()=>run('retention_rewrite',{auto_continue:true})}>{tr('Repair affected passages')}</Button></div>
    <p className="muted">{tr('Passing current verification gates automatically locks the story and prepares narration. Final video review remains manual.')}</p>
    {report&&<details><summary>{tr('Retention findings and time zones')}</summary><p><ViewText text={report.summary}/></p>
      <div className="table-wrap"><table><thead><tr><th>{tr('Time zone')}</th><th>{tr('Status')}</th><th>{tr('Evidence')}</th></tr></thead><tbody>{report.zones.map((z:Row)=><tr key={z.id}><td>{z.id}s</td><td>{tr(z.status==='NOT_APPLICABLE'?'Not applicable':z.status==='PASS'?'Pass':'Needs attention')}</td><td><ViewText text={z.evidence||z.explanation}/></td></tr>)}</tbody></table></div>
      {report.issues.map((i:Row)=><details key={i.issue_id}><summary>{i.issue_id} · ~{time(i.estimated_seconds)} · <Status value={i.severity}/></summary><blockquote><ViewText text={i.evidence}/></blockquote><p><ViewText text={i.retention_risk}/></p><p><ViewText text={i.suggested_repair}/></p></details>)}
      <p><ViewText text={report.packaging_explanation}/></p></details>}
  </Section>;
}

export function OpeningOptions({project:p,active,run,act}:{project:Row,active:boolean,run:(kind:string,payload?:Row)=>void,act:Act}){
  const [busy,setBusy]=useState(false), report=p.artifacts.opening_variants?.content, choice=p.artifacts.opening_choice?.content;
  if(!p.selected_premise_id)return null;
  return <Section title={tr('Compare three openings')} caption={tr('A / B / C are AI writing alternatives, not a live audience experiment.')}>
    <Button disabled={active||p.locked||!p.artifacts.outline_rewrite} onClick={()=>run('opening_variants')}>{tr('Create opening alternatives')}</Button>
    {report&&<><p><ViewText text={report.rationale}/></p><div className="premise-grid">{report.variants.map((v:Row)=><article className={'premise-card '+(choice?.id===v.id?'chosen':'')} key={v.id}><h3>{v.id} · <ViewText text={v.strategy}/></h3><p><ViewText text={v.text}/></p><details><summary>{tr('AI prediction scores / 100')}</summary><Readable value={v.scores}/><p><ViewText text={v.tradeoff}/></p></details><Button disabled={busy||active||p.locked||choice?.id===v.id} onClick={async()=>{setBusy(true);try{await act(()=>api('/projects/'+p.id+'/opening-choice','POST',{id:v.id}),'Opening selected')}finally{setBusy(false)}}}>{tr(choice?.id===v.id?'Selected':'Use this opening')}</Button></article>)}</div></>}
  </Section>;
}

export function MissingResources({project:p}:{project:Row}){
  const missing=p.missing_resources||[];
  if(!missing.length)return null;
  return <Section title={tr('Resources still missing')} caption={tr('Failed browser items are skipped so the queue can continue. Create these items manually, then upload and assign them here.')}>
    <div className="table-wrap"><table><thead><tr><th>{tr('Expected file')}</th><th>{tr('Reason')}</th><th>{tr('Manual creation')}</th></tr></thead><tbody>{missing.map((m:Row)=><tr key={m.target_id+':'+(m.variant_id||'')}><td>{m.filename}</td><td>{m.reason}</td><td><a className="button small" href={'#/projects/'+p.id+'/'+(m.target_type==='chunk'?'tts':m.target_type==='background_music'?'assets':'visuals')}>{tr(m.target_type==='chunk'?'TTS studio':m.target_type==='background_music'?'Shared background music':'Visual director')}</a></td></tr>)}</tbody></table></div>
  </Section>;
}
