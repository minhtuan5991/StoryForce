// The provider may construct a fresh blob only when Download is clicked. Capture
// that action's anchor URL in the page's main world; do not intercept network
// traffic, cookies, account state or downloads from other tabs.
export function armDownloadCapture(ticket){
  const slot='__storyforgeMediaDownloadCapture';
  if(typeof globalThis[slot]==='function')globalThis[slot]();
  const attribute='data-storyforge-download-'+ticket;
  document.documentElement.removeAttribute(attribute);
  const prototype=HTMLAnchorElement.prototype,original=prototype.click;
  const originalRevoke=URL.revokeObjectURL;
  const held=new Set(),pending=new Set();
  const until=Date.now()+120000;
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
  function stopCapture(){
    if(prototype.click===wrapped)prototype.click=original;
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
    if(globalThis[slot]===cleanup)delete globalThis[slot];
  }
  prototype.click=wrapped;
  URL.revokeObjectURL=revoke;
  globalThis[slot]=cleanup;
  document.addEventListener('click',listener,true);
  setTimeout(cleanup,120000);
}

export function readDownloadCapture(ticket){
  return document.documentElement.getAttribute('data-storyforge-download-'+ticket)||'';
}
