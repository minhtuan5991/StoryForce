// This module owns display strings only. It never writes project data or creates jobs.
type TranslatorInstance = {translate:(text:string, options?:{signal:AbortSignal})=>Promise<string>};
type TranslatorAPI = {create:(options:{sourceLanguage:string,targetLanguage:string,signal:AbortSignal,monitor:(monitor:EventTarget)=>void})=>Promise<TranslatorInstance>};
const CACHE_VERSION='en-vi-display-v1';
const cache=new Map<string,string>();
let cacheSize=0, saveTimer:ReturnType<typeof setTimeout>|undefined;
let database:Promise<IDBDatabase|null>|undefined, loaded:Promise<void>|undefined;
const translators=new Map<string,Promise<TranslatorInstance>>();
let queue:Promise<unknown>=Promise.resolve();

function db(){
  return database??=new Promise(resolve=>{
    try {
      const request=indexedDB.open('storyforge-view-translations',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('cache');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>resolve(null);
      request.onblocked=()=>resolve(null);
    } catch {resolve(null)}
  });
}
function remember(source:string,result:string){
  cacheSize-=(cache.get(source)?.length||0)+(cache.has(source)?source.length:0);
  cache.delete(source);cache.set(source,result);cacheSize+=source.length+result.length;
  while(cache.size>1000||cacheSize>600000){const key=cache.keys().next().value!;cacheSize-=key.length+cache.get(key)!.length;cache.delete(key)}
}
async function loadCache(){
  return loaded??= (async()=>{
    const database=await db();if(!database)return;
    await new Promise<void>(resolve=>{
      try {const request=database.transaction('cache').objectStore('cache').get(CACHE_VERSION);
        request.onsuccess=()=>{if(Array.isArray(request.result))for(const pair of request.result){if(Array.isArray(pair)&&pair.length===2&&pair.every(v=>typeof v==='string'))remember(pair[0],pair[1])}resolve()};
        request.onerror=()=>resolve();
      }catch{resolve()}
    });
  })();
}
function persist(){
  clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{
    const database=await db();if(!database)return;
    try {const tx=database.transaction('cache','readwrite');tx.onerror=()=>{};tx.objectStore('cache').put([...cache],CACHE_VERSION)}catch{/* Cache is optional. */}
  },500);
}

// Call directly from the language button: installing a language pack needs a user gesture.
export function startViewTranslator(progress:(percent:number)=>void,sourceLanguage='en'){
  if(sourceLanguage==='vi')return Promise.resolve({translate:async(text:string)=>text});
  const existing=translators.get(sourceLanguage);if(existing)return existing;
  const native=(globalThis as typeof globalThis & {Translator?:TranslatorAPI}).Translator;
  if(!native)return Promise.reject(new Error('Trình duyệt chưa hỗ trợ dịch trên máy. Hãy mở trang này bằng Comet hoặc Chrome phiên bản mới.'));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),120000);
  const translator=native.create({sourceLanguage,targetLanguage:'vi',signal:controller.signal,monitor(m){
    m.addEventListener('downloadprogress',event=>progress(Math.round((event as Event & {loaded:number}).loaded*100)));
  }}).catch(()=>{translators.delete(sourceLanguage);throw new Error(`Chưa tải được bộ dịch ${sourceLanguage==='zh'?'Trung':sourceLanguage==='en'?'Anh':sourceLanguage}–Việt. Kiểm tra kết nối rồi bấm Thử dịch lại; bản gốc vẫn sử dụng bình thường.`)}).finally(()=>clearTimeout(timer));
  translators.set(sourceLanguage,translator);
  return translator;
}

export function shouldTranslate(text:string,sourceLanguage='en'){
  const value=text.trim();
  const readable=sourceLanguage==='zh'?/\p{Script=Han}/u.test(value):sourceLanguage==='vi'?false:/[a-zA-Z]/.test(value)&&!/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(value);
  return readable
    && !/^(?:https?:\/\/|[A-Z]:[\\/]|[\w.-]+\.(?:wav|mp3|mp4|png|jpe?g|webp|json|srt|vtt|csv|txt)$|[a-f\d]{12,}$|(?:scene|tts)[_-]?\d+$)/i.test(value);
}
// Imports can retain the default English metadata even when their transcript is Chinese.
export function sourceViewLanguage(text:string,declared=''):'en'|'zh'|'vi'{
  const han=(text.match(/\p{Script=Han}/gu)||[]).length;
  if(han>0&&han>=(text.match(/[a-zA-Z]/g)||[]).length)return 'zh';
  const language=declared.trim().toLowerCase();
  if(/^(?:zh(?:[-_].*)?|chinese|tiếng trung|中文)$/.test(language))return 'zh';
  if(/^(?:vi(?:[-_].*)?|vietnamese|tiếng việt)$/.test(language))return 'vi';
  return 'en';
}
export function splitTranslationText(text:string,sourceLanguage='en'):string[]{
  const parts:string[]=[];let remaining=text;
  while(remaining.length>1600){
    const head=remaining.slice(0,1600);
    let end=head.lastIndexOf('\n');
    if(end<500)end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('! '),head.lastIndexOf('? '));
    if(end<500&&sourceLanguage==='zh')end=Math.max(head.lastIndexOf('。'),head.lastIndexOf('！'),head.lastIndexOf('？'));
    if(end<500)end=head.lastIndexOf(' ');
    if(end<1)end=1599;
    parts.push(remaining.slice(0,end+1));remaining=remaining.slice(end+1);
  }
  if(remaining)parts.push(remaining);return parts;
}
function cancelled(signal:AbortSignal){if(signal.aborted)throw new DOMException('Cancelled','AbortError')}
async function translatePart(source:string,signal:AbortSignal,sourceLanguage:string){
  await loadCache();cancelled(signal);
  // Preserve the existing English cache, and isolate other language pairs.
  const key=sourceLanguage==='en'?source:`\0${sourceLanguage}\0${source}`;
  const cached=cache.get(key);if(cached!==undefined)return cached;
  const work=queue.catch(()=>{}).then(async()=>{
    cancelled(signal);
    const existing=cache.get(key);if(existing!==undefined)return existing;
    const translator=translators.get(sourceLanguage);
    if(!translator)throw new Error('Bấm Thử dịch lại để khởi động bộ dịch.');
    const engine=await translator;cancelled(signal);
    // One small translation at a time, yielding between pieces for normal interaction.
    await new Promise(resolve=>setTimeout(resolve,20));cancelled(signal);
    const controller=new AbortController(), abort=()=>controller.abort();
    signal.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,30000);
    try {
      const result=await engine.translate(source,{signal:controller.signal});
      cancelled(signal);
      if(!result.trim())throw new Error('Empty translation');
      remember(key,result);persist();return result;
    } finally {clearTimeout(timer);signal.removeEventListener('abort',abort)}
  });
  queue=work;return work;
}
export async function translateForView(text:string,signal:AbortSignal,sourceLanguage='en'){
  const translated:string[]=[];
  for(const part of splitTranslationText(text,sourceLanguage)){
    cancelled(signal);
    const source=part.trim();
    translated.push(shouldTranslate(source,sourceLanguage)?part.slice(0,part.indexOf(source))+await translatePart(source,signal,sourceLanguage)+part.slice(part.indexOf(source)+source.length):part);
  }
  return translated.join('');
}
