import { tr } from './i18n';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronRight, Copy, Download, Film, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { api, label, pretty } from './api';
import { ViewText } from './ViewTranslation';

export function Badge({children, tone='neutral'}:{children:ReactNode,tone?:string}) {return <span className={'badge '+tone}><span className="status-dot"/>{children}</span>}
export function Status({value}:{value:string}) {const tone = /complete|locked|ready|established|confirmed|attached|accepted|fixed/i.test(value)?'green':/fail|block|critical|high|stale/i.test(value)?'red':/wait|discover|review|uncertain|pending/i.test(value)?'amber':'blue';return <Badge tone={tone}>{label(value)}</Badge>}
export function Button({children,primary=false,small=false,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{primary?:boolean,small?:boolean}) {return <button {...props} className={'button '+(primary?'primary ':'')+(small?'small ':'')+(props.className||'')}>{children}</button>}
export function Empty({title,description,action}:{title:string,description:string,action?:ReactNode}){return <div className="empty"><div className="empty-icon"><Sparkles size={27}/></div><h3>{title}</h3><p>{description}</p>{action}</div>}
export function PageHead({eyebrow,title,description,action}:{eyebrow?:string,title:string,description?:string,action?:ReactNode}) {return <div className="page-head"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="head-actions">{action}</div></div>}
export function Section({title,caption,action,children,className=''}:{title?:string,caption?:string,action?:ReactNode,children:ReactNode,className?:string}) {return <section className={'panel '+className}>{title&&<div className="panel-head"><div><h2>{title}</h2>{caption&&<p>{tr(caption)}</p>}</div>{action}</div>}{children}</section>}
export function Stat({label:caption,value,icon,note}:{label:string,value:ReactNode,icon?:ReactNode,note?:string}) {return <div className="stat"><div className="stat-label">{tr(caption)}{icon}</div><strong>{value}</strong>{note&&<span>{tr(note)}</span>}</div>}
export function Field({label:caption,children,hint}:{label:string,children:ReactNode,hint?:string}){const id=useId();return <label className="field" id={id}><span>{tr(caption)}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Modal({title,onClose,children,wide=false}:{title:string,onClose:()=>void,children:ReactNode,wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close()},[]);
  return <dialog ref={ref} aria-modal="true" aria-labelledby={titleId} className={'modal '+(wide?'wide':'')} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-head"><h2 id={titleId}><ViewText text={title}/></h2><button className="icon-button" aria-label={tr("Close dialog")} onClick={onClose}><X size={20}/></button></div>{children}</dialog>
}
export function JsonEditor({value,onSave,title='Structured data',readOnly=false}:{value:any,onSave?:(value:any)=>Promise<any>,title?:string,readOnly?:boolean}) {
  const [text,setText]=useState(pretty(value)),[error,setError]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState('read');
  useEffect(()=>{setText(pretty(value))},[pretty(value)]);
  async function save(){try{setBusy(true);setError('');await onSave?.(JSON.parse(text));setMode('read')}catch(e){setError(String(e))}finally{setBusy(false)}}
  return <div className="json-editor"><div className="inline between"><span className="eyebrow">{tr(title)}</span><div className="segmented"><button className={mode==='read'?'active':''} onClick={()=>setMode('read')}>{tr("Readable")}</button><button className={mode==='json'?'active':''} onClick={()=>setMode('json')}>{readOnly?tr("JSON"):tr("Edit JSON")}</button></div></div>{mode==='read'?<Readable value={value}/>:<><textarea className="code-editor" aria-label={title} value={text} readOnly={readOnly} onChange={e=>setText(e.target.value)}/>{onSave&&<Button primary disabled={busy} onClick={save}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}{tr("Save changes")}</Button>}</>}{error&&<p role="alert" className="error-text">{error}</p>}</div>
}
export function Readable({value,field=''}:{value:any,field?:string}) {
  if (value===null || value===undefined) return <span className="muted">{tr("Not set")}</span>;
  if (typeof value!=='object') return <span className="readable-value">{typeof value==='string'&&!/(?:^|_)(?:id|ids|hash|url|path|file|filename|provider|model|timestamp|at|version|scene_key)$/.test(field)?<ViewText text={value}/>:String(value)}</span>;
  if (Array.isArray(value)) return value.length?<div className="readable-list">{value.map((v,i)=><div key={i} className={typeof v==='object'?'readable-item':'readable-line'}>{typeof v!=='object'&&<span className="tiny-dot"/>}<Readable value={v} field={field}/></div>)}</div>:<span className="muted">{tr("None")}</span>;
  return <div className="readable-grid">{Object.entries(value).map(([k,v])=><div key={k} className={'readable-field '+(typeof v==='string'&&v.length>160?'full':'')}><div className="readable-label"><ViewText text={label(k)}/></div><Readable value={v} field={k}/></div>)}</div>
}
export function CopyButton({text,caption='Copy'}:{text:string,caption?:string}) {const [copied,setCopied]=useState(false);return <Button small onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{window.prompt(tr("Copy this text"),text)}}}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?tr("Copied"):tr(caption)}</Button>}
export function MountainArt({variant='blue'}:{variant?:string}) {
  const id=useId().replace(/:/g,'');
  const colors:Record<string,string[]>={blue:['#0b172f','#244876','#83bcdc','#ecb989'],amber:['#281c24','#72533b','#bc8d61','#f1c893'],violet:['#171529','#49395d','#8b83b6','#ebc6db'],teal:['#092a2e','#23616a','#8cd3cb','#eed19c']};
  const c=colors[variant]||colors.blue;
  return <svg className="mountain-art" viewBox="0 0 500 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label={tr("Original cinematic landscape")}><defs><linearGradient id={id+'sky'} x2="0" y2="1"><stop stopColor={c[0]}/><stop offset="1" stopColor={c[1]}/></linearGradient><radialGradient id={id+'glow'}><stop stopColor={c[3]} stopOpacity=".6"/><stop offset="1" stopColor={c[3]} stopOpacity="0"/></radialGradient></defs><rect width="500" height="220" fill={'url(#'+id+'sky)'}/><ellipse cx="348" cy="108" rx="115" ry="102" fill={'url(#'+id+'glow)'}/><circle cx="349" cy="100" r="35" fill={c[3]} opacity=".85"/><path d="M0 143 72 98 102 114 170 47 238 120 283 82 354 151 407 103 500 155V220H0Z" fill={c[1]}/><path d="m170 47-36 56 34-12 14 12 11-6 20 14Z" fill={c[2]} opacity=".65"/><path d="M0 180 80 142 143 169 216 127 313 170 388 143 500 195V220H0Z" fill={c[0]} opacity=".85"/><path d="M243 220c-45-24 92-24 50-48s-49-18-17-28" fill="none" stroke={c[2]} opacity=".45" strokeWidth="3"/>{[23,62,86,114,159,206,269,304,444,472].map((x,i)=><circle key={x} cx={x} cy={20+(i*13)%52} r=".8" fill="#eaf5ff" opacity={.3+i*.04}/>)}<path d="M0 209 29 191 42 199 59 180 74 211 104 196 133 220H0Z" fill="#08121d"/><path d="M500 220H402l31-29 12 8 24-34 15 33 16-8Z" fill="#08121d"/></svg>
}
export function Progress({value}:{value:number}){return <div className="progress-track"><span style={{width:`${Math.min(100,value)}%`}}/></div>}
