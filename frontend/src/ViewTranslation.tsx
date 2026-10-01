import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Languages,Loader2} from 'lucide-react';
import {startViewTranslator,shouldTranslate,translateForView,splitTranslationText} from './translationEngine';

type ViewContext={enabled:boolean,ready:boolean,revision:number,sourceLanguage:string,activity:(delta:number)=>void,failed:()=>void};
const Context=createContext<ViewContext>({enabled:false,ready:false,revision:0,sourceLanguage:'en',activity:()=>{},failed:()=>{}});
const Controls=createContext<ReactNode>(null);
export const useVietnameseView=()=>useContext(Context).enabled;
export function ViewTranslationScope({active,children,sourceLanguage='en',originalLabel='Tiếng Anh gốc'}:{active:boolean,children:ReactNode,sourceLanguage?:string,originalLabel?:string}){
  const [language,setLanguage]=useState<'en'|'vi'>('en'),[ready,setReady]=useState(false),[starting,setStarting]=useState(false);
  const [progress,setProgress]=useState<number|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(0),[revision,setRevision]=useState(0);
  const [foreground,setForeground]=useState(!document.hidden);
  useEffect(()=>{const update=()=>setForeground(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update)},[]);
  const activity=useCallback((delta:number)=>setPending(n=>Math.max(0,n+delta)),[]);
  const failed=useCallback(()=>setError('Một số nội dung chưa dịch được. Bạn vẫn có thể dùng bản gốc hoặc bấm Thử dịch lại.'),[]);
  async function vietnamese(){
    setLanguage('vi');setStarting(true);setError('');setProgress(null);
    try {await startViewTranslator(setProgress,sourceLanguage);setReady(true);setRevision(n=>n+1)}catch(e){setError((e as Error).message)}finally{setStarting(false)}
  }
  const value=useMemo(()=>({enabled:active&&language==='vi',ready:ready&&foreground,revision,sourceLanguage,activity,failed}),[active,language,ready,foreground,revision,sourceLanguage,activity,failed]);
  const pair=sourceLanguage==='zh'?'Trung–Việt':'Anh–Việt';
  return <Context.Provider value={value}><Controls.Provider value={active?<div className="view-translation-toolbar">
    <div className="inline between wrap"><strong><Languages size={17} aria-hidden="true"/> Ngôn ngữ nội dung</strong>
      <div className="segmented" role="group" aria-label="Ngôn ngữ nội dung">
        <button type="button" aria-pressed={language==='en'} className={language==='en'?'active':''} onClick={()=>setLanguage('en')}>{originalLabel}</button>
        <button type="button" aria-pressed={language==='vi'} className={language==='vi'?'active':''} disabled={starting} onClick={()=>void vietnamese()}>Tiếng Việt</button>
      </div></div>
    <p>Chỉ dịch để đọc. Sao chép, chỉnh sửa, xuất file và gửi AI vẫn dùng bản gốc.</p>
    {language==='vi'&&<div role="status" aria-live="polite" className={error?'error-text':'muted'}>
      {starting?<><Loader2 size={14} className="spin" aria-hidden="true"/> {progress!==null?`Đang tải bộ dịch ${pair}: ${progress}%`:`Đang chuẩn bị bộ dịch ${pair}…`}</>:error?<>{error} <button type="button" className="button small" onClick={()=>void vietnamese()}>Thử dịch lại</button></>:pending>0?'Đang dịch nội dung đang xem… Bản gốc vẫn hiện trong lúc chờ.':'Bản dịch tham khảo trên máy · chỉ dịch phần đang xem · tự lưu để dùng lại.'}
    </div>}
  </div>:null}>{children}</Controls.Provider></Context.Provider>;
}
export function ViewTranslationToolbar(){return <>{useContext(Controls)}</>}

export function ViewText({text}:{text:string|null|undefined}){
  const source=String(text??'');
  const {enabled,ready,revision,sourceLanguage,activity,failed}=useContext(Context);
  const ref=useRef<HTMLSpanElement>(null);
  const [visible,setVisible]=useState(false),[result,setResult]=useState<{source:string,language:string,text:string}|null>(null);
  useEffect(()=>{
    const element=ref.current;if(!element||!enabled)return;
    if(!('IntersectionObserver' in window)){setVisible(true);return}
    const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)),{rootMargin:'150px'});
    observer.observe(element);return()=>observer.disconnect();
  },[enabled]);
  useEffect(()=>{
    if(!enabled||!ready||!visible||!shouldTranslate(source,sourceLanguage)||(result?.source===source&&result.language===sourceLanguage))return;
    const controller=new AbortController();let finished=false;
    const finish=()=>{if(!finished){finished=true;activity(-1)}};
    activity(1);
    translateForView(source,controller.signal,sourceLanguage).then(text=>{if(!controller.signal.aborted)setResult({source,language:sourceLanguage,text})}).catch(()=>{if(!controller.signal.aborted)failed()}).finally(finish);
    return()=>{controller.abort();finish()};
  },[source,enabled,ready,visible,revision,sourceLanguage,activity,failed,result?.source,result?.language]);
  const translated=enabled&&result?.source===source&&result.language===sourceLanguage;
  return <span ref={ref} className="view-text" lang={translated?'vi':undefined} title={translated?source:undefined} data-view-translated={translated?'true':undefined}>{translated?result.text:source}</span>;
}

// Editable originals never become translated form values.
export function DraftTranslation({text}:{text:string}){
  return useVietnameseView()?<div className="draft-view-translation"><strong>Bản dịch tiếng Việt · chỉ đọc</strong><div className="narration-text">{splitTranslationText(text).map((part,i)=><span key={i} style={{display:'block'}}><ViewText text={part}/></span>)}</div><p className="muted">Bản gốc để chỉnh sửa ở bên dưới.</p></div>:null;
}
