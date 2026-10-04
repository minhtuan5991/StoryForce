// The provider may construct a fresh blob only when Download is clicked. Capture
// that action's anchor URL in the page's main world; do not intercept network
// traffic, cookies, account state or downloads from other tabs.
export function armDownloadCapture(ticket,provider){
  const slot='__storyforgeMediaDownloadCapture';
  if(typeof globalThis[slot]==='function')globalThis[slot]();
  const attribute='data-storyforge-download-'+ticket;
  document.documentElement.removeAttribute(attribute);
  const prototype=HTMLAnchorElement.prototype,original=prototype.click;
  const originalRevoke=URL.revokeObjectURL;
  const originalPost=MessagePort.prototype.postMessage;
  const held=new Set(),pending=new Set(),created=new Set();
  const until=Date.now()+180000;
  function downloadableUrl(href){
    if(!href.startsWith('data:'))return href;
    // AI Studio assembles the finished WAV into a base64 data URL. Persisting
    // minutes of PCM in chrome.storage exceeds its quota and stalls the queue.
    // Keep the exact bytes in this page and pass only a short blob URL back.
    const comma=href.indexOf(','),header=href.slice(5,comma);
    if(comma<0||!header.endsWith(';base64'))return href;
    const type=header.slice(0,-7);
    if(!/^(?:audio\/(?:wav|x-wav|wave)|image\/(?:png|jpeg|webp)|video\/mp4)$/i.test(type))return href;
    const binary=atob(href.slice(comma+1)),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type}));created.add(url);
    return url;
  }
  function record(anchor){
    if(Date.now()>until||!anchor?.href||!anchor.hasAttribute('download'))return false;
    const protocol=new URL(anchor.href,location.href).protocol;
    if(!['blob:','https:','data:'].includes(protocol))return false;
    const url=downloadableUrl(anchor.href);
    if(url.startsWith('blob:'))held.add(url);
    document.documentElement.setAttribute(attribute,url);
    stopCapture();
    return true;
  }
  function listener(event){if(record(event.target?.closest?.('a[download]'))){event.preventDefault();event.stopImmediatePropagation()}}
  function wrapped(...args){if(!record(this))return original.apply(this,args)}
  // Google's media pages send finished PNG/WAV files to a sandboxed download
  // iframe. Its blob:null URL is not the preview URL and cannot be observed by
  // the top-page anchor hook. Capture only this known, pure-download message,
  // without reading network traffic or evaluating the provider's code. The
  // sandbox receives a no-op acknowledgement, so there is one saved file.
  const sandboxDownload='var url=URL.createObjectURL(blob);var a=document.createElement("a");if(!("download" in a)){throw new Error("Downloading not supported on this browser");}a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},250);';
  function post(data,...rest){
    const output=data?.values?.[0],filename=data?.values?.[1];
    const expected=provider==='gemini'?output?.type==='image/png'&&/^Gemini_Generated_Image_[a-z0-9_]+(?:\.png)?$/i.test(filename):
      provider==='aistudio'&&['','audio/wav','audio/x-wav','audio/wave'].includes(output?.type)&&/^Generated Audio [\w ,:()-]+(?:\.wav)?$/i.test(filename);
    if(expected&&Date.now()<=until&&typeof data?.code==='string'&&data.code.replace(/\s+/g,'')===sandboxDownload.replace(/\s+/g,'')&&
      Array.isArray(data.paramNames)&&data.paramNames.join(',')==='blob,filename'&&data.values?.length===2&&
      output instanceof Blob&&output.size>0&&typeof filename==='string'){
      const anchor=document.createElement('a');
      // AI Studio's assembled WAV Blob currently has an empty MIME type.
      // Preserve every byte and supply the WAV type only for this exact message.
      const blob=provider==='aistudio'&&!output.type?new Blob([output],{type:'audio/wav'}):output;
      anchor.href=URL.createObjectURL(blob);anchor.download=filename;created.add(anchor.href);
      if(record(anchor))return originalPost.call(this,{...data,code:'void 0;'},...rest);
    }
    return originalPost.call(this,data,...rest);
  }
  function stopCapture(){
    if(prototype.click===wrapped)prototype.click=original;
    if(MessagePort.prototype.postMessage===post)MessagePort.prototype.postMessage=originalPost;
    document.removeEventListener('click',listener,true);
  }
  function revoke(url){
    // Some providers revoke their download blob immediately after a.click().
    // Hold only that captured output until chrome.downloads has opened it.
    if(held.has(String(url))&&Date.now()<until){pending.add(String(url));return}
    return originalRevoke.call(URL,url);
  }
  function cleanup(){
    stopCapture();
    if(URL.revokeObjectURL===revoke)URL.revokeObjectURL=originalRevoke;
    for(const url of pending)originalRevoke.call(URL,url);
    for(const url of created)if(!pending.has(url))originalRevoke.call(URL,url);
    if(globalThis[slot]===cleanup)delete globalThis[slot];
  }
  prototype.click=wrapped;
  if(['gemini','aistudio'].includes(provider))MessagePort.prototype.postMessage=post;
  URL.revokeObjectURL=revoke;
  globalThis[slot]=cleanup;
  document.addEventListener('click',listener,true);
  setTimeout(cleanup,180000);
}

export function readDownloadCapture(ticket){
  return document.documentElement.getAttribute('data-storyforge-download-'+ticket)||'';
}
