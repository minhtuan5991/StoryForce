// Runs in the provider's main world so its own Copy action supplies the source
// text. Rendered markdown can remove JSON backslashes (\" becomes ").
export async function copyResponseSource(target, timeoutMs=5000) {
  if(location.hostname!=='chatgpt.com'||!target?.messageId)throw new Error('No scoped response to copy');
  const selected=[...document.querySelectorAll('[data-chatgpt-selection-message-id]')]
    .find(el=>el.getAttribute('data-chatgpt-selection-message-id')===target.messageId);
  if(!selected||selected.closest('[inert],[aria-hidden="true"]'))throw new Error('Response changed before copy');
  const blocks=[...selected.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
  if(!blocks.length||blocks.map(el=>el.innerText).join('\n\n').trim()!==target.text)throw new Error('Response changed before copy');
  let scope=selected,button;
  // Stop at the current turn; never borrow Copy from another message or user prompt.
  while(scope&&!button){
    button=[...scope.querySelectorAll('.turn-action-controls button')].find(el=>
      /^(Copy|Copy response|Sao chép)$/i.test(el.getAttribute('aria-label')||'')&&
      !el.disabled&&el.getAttribute('aria-disabled')!=='true'&&el.getClientRects().length);
    if(scope.hasAttribute('data-turn-key'))break;
    scope=scope.parentElement;
  }
  if(!button)throw new Error('Response Copy control unavailable');
  const clipboard=navigator.clipboard;
  if(!clipboard)throw new Error('Response copy unavailable');
  const descriptors=['writeText','write'].map(key=>[key,Object.getOwnPropertyDescriptor(clipboard,key)]);
  let timer,resolveText,rejectText;
  const result=new Promise((resolve,reject)=>{resolveText=resolve;rejectText=reject});
  const deliver=text=>{if(typeof text==='string'&&text.trim())resolveText(text);else rejectText(new Error('Empty response copy'))};
  try{
    // Capture only during this scoped Copy action. Do not read or replace the
    // user's existing clipboard, and always restore the original methods.
    Object.defineProperty(clipboard,'writeText',{configurable:true,value:async text=>deliver(text)});
    Object.defineProperty(clipboard,'write',{configurable:true,value:async items=>{
      try{const item=items.find(item=>item.types.includes('text/plain'));if(!item)throw new Error('No plain response');deliver(await (await item.getType('text/plain')).text())}catch(error){rejectText(error)}
    }});
    timer=setTimeout(()=>rejectText(new Error('Response copy timed out')),timeoutMs);
    button.click();
    return {text:await result};
  }finally{
    clearTimeout(timer);
    for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(clipboard,key,descriptor);else delete clipboard[key]}
  }
}
