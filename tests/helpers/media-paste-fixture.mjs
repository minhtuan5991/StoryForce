// Media adapter tests isolate the OS clipboard dependency. Real permission and
// trusted Paste behavior is covered by bridge-paste-native.spec.mjs in Chromium.
export function installPasteFixture(window){
  const norm=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').trim();
  function editorText(node){
    if(node.nodeType===3)return node.textContent;
    if(node.nodeName==='BR')return node.classList.contains('ProseMirror-trailingBreak')?'':'\n';
    const children=[...node.childNodes];
    if(children.length===1&&children[0].nodeName==='BR')return '';
    let result='',previousBlock=false;
    children.forEach((child,index)=>{const block=/^(P|DIV|LI|PRE|BLOCKQUOTE|H[1-6])$/.test(child.nodeName);
      if(index&&(block||previousBlock))result+='\n';result+=editorText(child);previousBlock=block});
    return result;
  }
  const read=field=>norm(field.value??editorText(field));
  const into=async(field,prompt,{validate=()=>{}}={})=>{
    validate();
    if(read(field)===norm(prompt))return {ready:true,mode:'text'};
    field.focus();
    if('value' in field){
      Object.getOwnPropertyDescriptor(field instanceof window.HTMLTextAreaElement?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,'value').set.call(field,prompt);
      field.dispatchEvent(new window.Event('input',{bubbles:true}));
    }else if(window.document.execCommand){
      const selection=window.getSelection(),range=window.document.createRange();range.selectNodeContents(field);selection.removeAllRanges();selection.addRange(range);
      window.document.execCommand('insertText',false,prompt);
    }else{field.textContent=prompt;field.dispatchEvent(new window.Event('input',{bubbles:true}))}
    if(window.document.execCommand)await new Promise(resolve=>window.setTimeout(resolve,350));
    if(!field.isConnected)throw Object.assign(new Error('Ô soạn thảo vừa tải lại'),{code:'EDITOR_CHANGED'});
    validate();return {ready:true,mode:'text'};
  };
  window.storyForgePaste={into,prepare:into,matches:(field,prompt)=>read(field)===norm(prompt),ownsDraft:()=>false};
}
