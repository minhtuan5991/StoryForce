import {useEffect,useState} from 'react';
import {api,time,type Row} from './api';
import {Button,Field,Modal,PageHead,Section,Stat,Readable} from './components';
import {tr} from './i18n';

type Act=(fn:()=>Promise<any>,message?:string)=>Promise<any>;
const numeric: [string,string][]=[['video_duration_seconds','Video duration (seconds)'],['horizon_days','Observation age (days)'],['views','Views'],['impressions','Impressions'],['ctr','CTR (%)'],['watch_time_minutes','Watch time (minutes)'],['average_view_duration','Average view duration (seconds)'],['average_percentage_viewed','Average percentage viewed (%)'],['retention_30','Retention at 30s (%)'],['retention_60','Retention at 60s (%)'],['retention_90','Retention at 90s (%)'],['retention_180','Retention at 3m (%)'],['retention_300','Retention at 5m (%)'],['retention_600','Retention at 10m (%)'],['subscribers_gained','Subscribers gained'],['returning_viewers','Returning viewers'],['likes','Likes'],['comments','Comments']];
const integerFields=new Set(['horizon_days','views','impressions','subscribers_gained','returning_viewers','likes','comments']);
const classification:Row={INSUFFICIENT_DATA:'Insufficient comparable data',STRONG_CLICK_WEAK_RETENTION:'Strong click / weak retention',WEAK_CLICK_STRONG_RETENTION:'Weak click / strong retention',PROMISING_COMPARABLE_RESULT:'Promising comparable result',NEAR_BASELINE_OR_MIXED:'Near baseline or mixed'};

export function AnalyticsReminders({items,act,onAdd}:{items:Row[],act:Act,onAdd?:(item:Row)=>void}){
  const [hidden,setHidden]=useState<string[]>([]);
  const visible=items.filter(r=>!hidden.includes(r.project_id+':'+r.horizon_days));
  if(!visible.length)return null;
  return <Section title={tr('Optional analytics reminders')} caption={tr('Add results when convenient. These reminders never block story creation, production or publishing.')}>
    {visible.map(r=><div className="inline between wrap" key={r.project_id+':'+r.horizon_days}><p>{r.title} · {r.horizon_days} {tr('days after publication')}</p><div className="inline wrap">{onAdd?<Button onClick={()=>onAdd(r)}>{tr('Add results')}</Button>:<a className="button small" href="#/analytics">{tr('Add results')}</a>}<Button small onClick={async()=>{const result=await act(()=>api('/projects/'+r.project_id+'/analytics-reminder-dismiss','POST',{horizon_days:r.horizon_days}),'Reminder dismissed');if(result)setHidden([...hidden,r.project_id+':'+r.horizon_days])}}>{tr('Dismiss reminder')}</Button></div></div>)}
  </Section>;
}

export function ReminderInbox({act}:{act:Act}){
  const [items,setItems]=useState<Row[]>([]);
  useEffect(()=>{let stopped=false;api('/analytics/reminders').then(r=>{if(!stopped)setItems(r.items)}).catch(()=>{});return()=>{stopped=true}},[]);
  return <AnalyticsReminders items={items} act={act}/>;
}

export function AudienceAnalytics({data,projects,act}:{data:Row|null,projects:Row[],act:Act}){
  const [modal,setModal]=useState(false),[busy,setBusy]=useState(false),[form,setForm]=useState<Row>({project_id:'',date:new Date().toISOString().slice(0,10),metrics:{traffic_source:'Mixed'}});
  const l=data?.learning;
  const set=(key:string,value:any)=>setForm({...form,metrics:{...form.metrics,[key]:value}});
  function selectProject(id:string,horizon?:number){
    const p=projects.find(p=>p.id===id);
    const published=p?.publish?.date, publishedTime=Date.parse(published||'');
    const snapshotDate=horizon&&Number.isFinite(publishedTime)?new Date(publishedTime+horizon*86400000).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
    setForm({project_id:id,date:snapshotDate,metrics:{traffic_source:'Mixed',title_used:p?.publish?.title||p?.title||'',published_date:published||null,video_duration_seconds:p?.publish?.final_duration||null,horizon_days:horizon||null}});
  }
  const shown=(r:Row,key:string)=>r.metrics?._version?r.metrics[key]:r[key];
  const display=(v:any,suffix='')=>v===null||v===undefined?'—':String(v)+suffix;
  return <><PageHead eyebrow={tr('LISTEN TO YOUR AUDIENCE')} title={tr('A little wiser with every story')} description={tr('Record real results, look for patterns, and test what to change next.')} action={<Button primary onClick={()=>setModal(true)}>{tr('Add analytics snapshot')}</Button>}/>
    <AnalyticsReminders items={data?.reminders||[]} act={act} onAdd={r=>{selectProject(r.project_id,r.horizon_days);setModal(true)}}/>
    <div className="stats-grid"><Stat label={tr('Observed videos')} value={l?.sample_size||0}/><Stat label={tr('Total views')} value={(l?.total_views||0).toLocaleString()}/><Stat label={tr('Average CTR')} value={display(l?.average_ctr,'%')}/><Stat label={tr('Evidence level')} value={tr(l?.confidence||'Insufficient')}/></div>
    <Section title={tr('Compare similar videos')} caption={tr('Same channel, similar duration, observation age and traffic source. Correlation does not establish a cause.')}>
      <p className="muted">{tr('At least five comparable observations with enough impressions and views are required for a relative classification. Missing metrics stay blank; zero means a measured zero.')}</p>
      <div className="table-wrap"><table><thead><tr><th>{tr('Story')}</th><th>{tr('Comparable videos')}</th><th>{tr('Assessment')}</th><th>{tr('Evidence level')}</th></tr></thead><tbody>{l?.comparisons.map((c:Row)=><tr key={c.project_id}><td><a href={'#/projects/'+c.project_id+'/publish'}>{c.title}</a><details><summary>{tr('Channel median and sample sizes')}</summary><Readable value={c.baseline}/><Readable value={c.baseline_sample_sizes}/></details></td><td>{c.comparable_videos}</td><td>{tr(classification[c.classification]||c.classification)}</td><td>{tr(c.confidence)}</td></tr>)}</tbody></table></div>
      <details><summary>{tr('Patterns for the next experiment')}</summary>{l?.learned_patterns?.length?<Readable value={l.learned_patterns}/>:<p>{tr('Not enough comparable videos to learn a pattern yet. The app remains fully usable.')}</p>}</details>
    </Section>
    <Section title={tr('Performance snapshots')}><div className="table-wrap"><table><thead><tr><th>{tr('Story / snapshot date')}</th><th>{tr('Views')}</th><th>{tr('Impressions')}</th><th>{tr('CTR')}</th><th>{tr('Avg. view')}</th><th>{tr('% viewed')}</th><th>{tr('Retention at 30s (%)')}</th></tr></thead><tbody>{data?.items.map((r:Row)=><tr key={r.id}><td>{r.project_title}<small>{r.date}</small></td><td>{display(shown(r,'views'))}</td><td>{display(shown(r,'impressions'))}</td><td>{display(shown(r,'ctr'),'%')}</td><td>{shown(r,'average_view_duration')===null?'—':time(shown(r,'average_view_duration'))}</td><td>{display(shown(r,'average_percentage_viewed'),'%')}</td><td>{display(shown(r,'retention_30'),'%')}</td></tr>)}</tbody></table></div></Section>
    {modal&&<Modal title={tr('Add an observed snapshot')} wide onClose={()=>{if(!busy)setModal(false)}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await act(()=>api('/analytics','POST',form),'Analytics snapshot saved');if(r)setModal(false)}finally{setBusy(false)}}}>
      <p>{tr('All performance metrics are optional. CTR uses 0–100%; retention can exceed 100% due to replay. Average view duration is in seconds. Leave unavailable or non-applicable measurements blank.')}</p>
      <div className="form-grid"><Field label={tr('Project')}><select required value={form.project_id} onChange={e=>selectProject(e.target.value)}><option value="">{tr('Choose project')}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
        <Field label={tr('Snapshot date')}><input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
        {['video_id','title_used','thumbnail_used'].map(k=><Field key={k} label={tr(k==='video_id'?'YouTube video ID':k==='title_used'?'Actual published title':'Actual thumbnail version / note')}><input value={form.metrics[k]||''} onChange={e=>set(k,e.target.value||null)}/></Field>)}
        {['published_date','date_range_start','date_range_end'].map(k=><Field key={k} label={tr(k==='published_date'?'Publish date':k==='date_range_start'?'Observation range start':'Observation range end')}><input type="date" value={form.metrics[k]||''} onChange={e=>set(k,e.target.value||null)}/></Field>)}
        <Field label={tr('Traffic source')}><select value={form.metrics.traffic_source} onChange={e=>set('traffic_source',e.target.value)}>{['Mixed','Browse','Suggested','Search','External','Other'].map(v=><option key={v} value={v}>{tr(v)}</option>)}</select></Field>
        {numeric.map(([key,title])=><Field key={key} label={tr(title)}><input type="number" min={key==='subscribers_gained'?undefined:key==='video_duration_seconds'||key==='horizon_days'?1:0} max={key==='ctr'?100:undefined} step={integerFields.has(key)?'1':'0.01'} value={form.metrics[key]??''} onChange={e=>set(key,e.target.value===''?null:Number(e.target.value))}/></Field>)}
      </div><div className="modal-actions"><Button disabled={busy} type="button" onClick={()=>setModal(false)}>{tr('Cancel')}</Button><Button primary disabled={busy} type="submit">{tr('Save snapshot')}</Button></div></form></Modal>}
  </>;
}
