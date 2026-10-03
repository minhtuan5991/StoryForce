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
  function record(anchor){
    if(Date.now()>until||!anchor?.href||!anchor.hasAttribute('download'))return false;
    const protocol=new URL(anchor.href,location.href).protocol;
    if(!['blob:','https:','data:'].includes(protocol))return false;
    if(protocol==='blob:')held.add(anchor.href);
    document.documentElement.setAttribute(attribute,anchor.href);
    stopCapture();
    return true;
  }
  function listener(event){if(record(event.target?.closest?.('a[download]'))){event.preventDefault();event.stopImmediatePropagation()}}
  function wrapped(...args){if(!record(this))return original.apply(this,args)}
  // Gemini sends its finished, full-resolution PNG to a sandboxed download
  // iframe. Its blob:null URL is not the preview URL and cannot be observed by
  // the top-page anchor hook. Capture only this known, pure-download message,
  // without reading network traffic or evaluating the provider's code. The
  // sandbox receives a no-op acknowledgement, so there is one saved file.
  const geminiDownload='var url=URL.createObjectURL(blob);var a=document.createElement("a");if(!("download" in a)){throw new Error("Downloading not supported on this browser");}a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},250);';
  function post(data,...rest){
    if(provider==='gemini'&&Date.now()<=until&&typeof data?.code==='string'&&data.code.replace(/\s+/g,'')===geminiDownload.replace(/\s+/g,'')&&
      Array.isArray(data.paramNames)&&data.paramNames.join(',')==='blob,filename'&&data.values?.length===2&&
      data.values[0] instanceof Blob&&data.values[0].size>0&&data.values[0].type==='image/png'&&
      typeof data.values[1]==='string'&&/^Gemini_Generated_Image_[a-z0-9_]+(?:\.png)?$/i.test(data.values[1])){
      const anchor=document.createElement('a');
      anchor.href=URL.createObjectURL(data.values[0]);anchor.download=data.values[1];created.add(anchor.href);
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
  if(provider==='gemini')MessagePort.prototype.postMessage=post;
  URL.revokeObjectURL=revoke;
  globalThis[slot]=cleanup;
  document.addEventListener('click',listener,true);
  setTimeout(cleanup,180000);
}

export function readDownloadCapture(ticket){
  return document.documentElement.getAttribute('data-storyforge-download-'+ticket)||'';
}
