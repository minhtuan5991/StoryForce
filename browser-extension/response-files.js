// Read only a JSON/TXT artifact supplied by the selected assistant reply. The
// native file Download supplies the full source, including off-screen code.
(() => {
  const version='1.1.34';
  // Reuse a live reader so two collection requests cannot stack page hooks.
  if(globalThis.storyForgeResponseFiles?.version===version)return;
  const visible=el=>!!el?.getClientRects().length&&!el.closest('[inert],[aria-hidden="true"]');
  const assistant='[data-message-author-role="assistant"],[data-turn="assistant"],[data-content-search-unit-key$=":assistant"],[data-chatgpt-search-unit-key$=":assistant"]';
  const excluded='[data-message-author-role="user"],[data-turn="user"],[data-content-search-unit-key$=":thinking"],[data-chatgpt-search-unit-key$=":thinking"],pre,code';
  const name=value=>{
    const line=String(value||'').trim().split(/\r?\n/).find(line=>/^[^<>:"/\\|?*\x00-\x1f]{1,180}\.(?:json|txt)$/i.test(line.trim()));
    return line?.trim()||'';
  };
  function fileName(el){
    for(const value of [el.getAttribute('download'),el.getAttribute('data-filename')]){
      const found=name(value);if(found)return found;
    }
    const href=el.getAttribute('href');
    if(href){try{const found=name(decodeURIComponent(new URL(href,location.href).pathname.split('/').at(-1)));if(found)return found}catch{}}
    for(const value of [el.innerText,el.getAttribute('title')]){const found=name(value);if(found)return found}
    return '';
  }
  function controls(root){
    const elements=[...root.querySelectorAll('a,button,[role="button"],[data-testid*="file"],[data-testid*="artifact"],[data-testid*="canvas"]')];
    // Some canvas cards are clickable divs rather than accessible buttons.
    for(const el of root.querySelectorAll('span,div,p')){
      if(!el.children.length&&name(el.textContent)&&getComputedStyle(el).cursor==='pointer'){
        elements.push(el.closest('button,a,[role="button"]')||el.parentElement);
      }
    }
    return [...new Set(elements)].filter(el=>visible(el)&&!el.closest(excluded)).map(el=>({el,name:fileName(el)})).filter(file=>file.name);
  }
  function describe(root){
    return [...new Set(controls(root).map(file=>file.name))];
  }
  const normalize=value=>String(value).replace(/\.(json|txt)$/i,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
  function responseText(root){
    const selector='.markdown,[data-message-content],[data-markdown-text-style="assistant-message"]';
    const blocks=[...root.querySelectorAll(selector)].filter(el=>visible(el)&&!el.parentElement?.closest(selector));
    return (blocks.length?blocks.map(el=>el.innerText).join('\n\n'):root.innerText).trim();
  }
  function scopedReply(target){
    if(location.hostname!=='chatgpt.com'||!target?.messageId)throw new Error('No scoped response file');
    const attributes=['data-chatgpt-selection-message-id','data-message-id','data-testid','data-turn-key'];
    const selected=[...document.querySelectorAll(attributes.map(key=>'['+key+']').join(','))]
      .find(el=>visible(el)&&attributes.some(key=>el.getAttribute(key)===target.messageId));
    if(!selected)throw new Error('Response file changed before reading');
    const reply=selected.closest(assistant)||selected;
    const all=[...document.querySelectorAll(assistant)].filter(el=>visible(el)&&!el.closest('[data-content-search-unit-key$=":thinking"],[data-chatgpt-search-unit-key$=":thinking"]'));
    const latest=all.filter(el=>!all.some(parent=>parent!==el&&parent.contains(el))).at(-1);
    if(latest&&!latest.contains(selected)&&latest!==reply)throw new Error('A newer assistant response is present');
    if(responseText(reply)!==target.text&&responseText(selected)!==target.text)throw new Error('Response file changed before reading');
    const current=describe(reply);
    if(JSON.stringify([...current].sort())!==JSON.stringify([...target.files].sort()))throw new Error('Response files changed before reading');
    return reply;
  }
  function downloadUrl(value){
    try{
      const url=new URL(value,location.href);
      if(url.protocol==='blob:'&&url.origin===location.origin)return url.href;
      if(url.protocol==='data:'&&/^data:(?:application\/json|text\/plain)[;,]/i.test(url.href))return url.href;
      if(url.protocol==='https:'&&!url.username&&!url.password&&
         (url.hostname===location.hostname||url.hostname.endsWith('.oaiusercontent.com')))return url.href;
    }catch{}
    return '';
  }
  let cached,busy=false;
  async function read(target,timeoutMs=9000){
    let restore=()=>{};
    try{
      const reply=scopedReply(target);
      const names=describe(reply),json=names.filter(value=>/\.json$/i.test(value)),choices=json.length?json:names;
      if(choices.length!==1)throw new Error('Choose one JSON/TXT response file; the reply contains multiple files');
      const filename=choices[0],key=JSON.stringify([target.messageId,target.text,filename]);
      if(cached?.key===key)return cached.result;
      if(busy)throw new Error('Response file reading is already in progress');
      busy=true;
      const limit=2_000_000,deadline=Date.now()+timeoutMs;
      const controller=new AbortController();
      const prototype=HTMLAnchorElement.prototype,original=prototype.click,originalRevoke=URL.revokeObjectURL;
      const held=new Set();let timer,resolveFile,rejectFile,loading=false;
      const result=new Promise((resolve,reject)=>{resolveFile=resolve;rejectFile=reject});
      // Attach a handler immediately, including while waiting for the editor.
      result.catch(()=>{});
      async function load(url,downloadName){
        if(loading)return;
        loading=true;
        try{
          const response=await fetch(url,{signal:controller.signal});
          if(!response.ok)throw new Error('Response file download failed');
          if(/text\/html/i.test(response.headers.get('content-type')||''))throw new Error('Response file is a sign-in/error page');
          if(Number(response.headers.get('content-length'))>limit)throw new Error('Response file must be smaller than 2 MB');
          let bytes;
          if(response.body?.getReader){
            const reader=response.body.getReader(),parts=[];let size=0;
            while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
              if(size>limit){await reader.cancel();throw new Error('Response file must be smaller than 2 MB')}
              parts.push(chunk.value)}
            bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
          }else{bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>limit)throw new Error('Response file must be smaller than 2 MB')}
          const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
          if(!text.trim())throw new Error('Response file is empty');
          scopedReply(target);
          resolveFile({text,filename:downloadName||filename,source:'response_file'});
        }catch(error){rejectFile(error)}
      }
      function record(anchor){
        if(!anchor?.href)return false;
        const found=fileName(anchor),url=downloadUrl(anchor?.href);
        if(!url||normalize(found)!==normalize(filename))return false;
        if(url.startsWith('blob:'))held.add(url);
        void load(url,found);return true;
      }
      function click(...args){if(!record(this))return original.apply(this,args)}
      function listener(event){if(record(event.target?.closest?.('a'))){event.preventDefault();event.stopImmediatePropagation()}}
      function revoke(url){if(!held.has(String(url)))return originalRevoke.call(URL,url)}
      restore=()=>{
        clearTimeout(timer);controller.abort();document.removeEventListener('click',listener,true);
        if(prototype.click===click)prototype.click=original;
        if(URL.revokeObjectURL===revoke)URL.revokeObjectURL=originalRevoke;
        for(const url of held)originalRevoke.call(URL,url);
        busy=false;
      };
      prototype.click=click;URL.revokeObjectURL=revoke;document.addEventListener('click',listener,true);
      timer=setTimeout(()=>rejectFile(new Error('Response file unavailable. Open its JSON/TXT card, then resume collection.')),timeoutMs);
      const files=controls(reply).filter(file=>file.name===filename);
      const card=files.find(file=>file.el.tagName!=='A')||files[0];
      if(!card)throw new Error('Response file control unavailable');
      if(card.el.tagName==='A'&&!downloadUrl(card.el.href)&&!/^sandbox:\/\//i.test(card.el.href)&&!/^sandbox:\//i.test(card.el.href)){
        throw new Error('The response file is outside the supported provider');
      }
      card.el.click();
      // A native canvas Download exports the whole document. Reading editor
      // lines would silently truncate a virtualized/scrolled code pane.
      while(!loading&&Date.now()<deadline){
        scopedReply(target);
        let button;
        for(const editor of document.querySelectorAll('.monaco-editor,.cm-editor,.CodeMirror,[data-testid="code-editor"]')){
          if(!visible(editor)||reply.contains(editor))continue;
          let panel=editor.parentElement;
          while(panel&&panel!==document.body&&!panel.contains(reply)){
            const labels=[...panel.querySelectorAll('button,[title],[aria-label]')].filter(visible);
            const named=labels.some(el=>{
              const text=normalize(el.getAttribute('title')||el.getAttribute('aria-label')||el.innerText);
              const expected=normalize(filename);
              return text===expected||(expected.length>=8&&text.includes(expected))||(text.length>=12&&expected.startsWith(text));
            });
            if(named){button=labels.find(el=>el.tagName==='BUTTON'&&!el.disabled&&
              /^(Download(?: file)?|Tải xuống(?: tệp)?|Tải về)$/i.test(el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText));if(button)break}
            panel=panel.parentElement;
          }
          if(button)break;
        }
        if(button){button.click();break}
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      const output=await result;cached={key,result:output};return output;
    }catch(error){return {error:error.message||String(error),code:'FILE_RESPONSE_UNAVAILABLE'}}
    finally{restore()}
  }
  globalThis.storyForgeResponseFiles={version,describe,read};
})();
