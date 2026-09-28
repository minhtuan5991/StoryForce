(() => {
  if (globalThis.storyForgeVersion === '1.1.8') return;
  if (globalThis.storyForgeListener) chrome.runtime.onMessage.removeListener(globalThis.storyForgeListener);
  globalThis.storyForgeVersion = '1.1.8';
  globalThis.storyForgeLoaded = true;
  const visible = el => !!el && !!el.getClientRects().length && !el.closest('[inert],[aria-hidden="true"]') &&
    (el.checkVisibility ? el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) : getComputedStyle(el).visibility!=='hidden');
  const first = selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(visible);
  const editable = el =>
    visible(el)&&(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement||el.isContentEditable)&&
    !el.disabled&&!el.readOnly&&el.getAttribute('aria-disabled')!=='true'&&el.getAttribute('aria-readonly')!=='true';
  function promptField(a){
    const known=a.input.flatMap(selector=>[...document.querySelectorAll(selector)]).find(editable);
    if(known)return known;
    // ChatGPT's composer ID/placeholder can change. Only use a unique visible
    // editor outside navigation/search/dialogs; never guess between multiple drafts.
    if(a.host!=='chatgpt.com')return;
    const candidates=[...document.querySelectorAll('textarea,[contenteditable]')].filter(el=>
      editable(el)&&!el.closest('nav,aside,[role="navigation"],[role="search"],[role="dialog"]')&&
      !el.parentElement?.isContentEditable);
    if(candidates.length===1)return candidates[0];
  }
  const transient = (message,code='INPUT_NOT_READY') => Object.assign(new Error(message),{code});
  const runButton = a => a.run.flatMap(selector=>[...document.querySelectorAll(selector)]).find(el=>
    visible(el)&&!el.matches(':disabled')&&el.getAttribute('aria-disabled')!=='true'&&
    getComputedStyle(el).pointerEvents!=='none'&&!a.busy.some(selector=>el.matches(selector)));
  const adapter = () => Object.entries(STORYFORGE_ADAPTERS).find(([key,value]) => key !== 'version' && value.host === location.hostname)?.[1];
  const checkpoint = () => [...document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid="challenge"], #challenge-stage')].some(visible);
  function check() {
    if (!adapter()) throw new Error('Unsupported provider. Use manual mode.');
    if (checkpoint()) throw new Error('Browser checkpoint detected. Complete it yourself, then retry.');
  }
  function lastResult() {
    return snapshot().last;
  }
  const sent=new Set();
  function snapshot(){
    const a=adapter();
    if(a.messages){
      const selector=a.messages.join(',');
      // New ChatGPT renders search units instead of data-message-author-role.
      // A selection-message wrapper groups multiple markdown blocks when no
      // outer search unit is present. Both variants exclude user/thinking units.
      const candidates=[...new Set([...document.querySelectorAll(selector)].map(el=>
        el.matches('[data-markdown-text-style="assistant-message"]')?
          el.closest('[data-chatgpt-selection-message-id]')||el:el))];
      const roots=candidates.filter(el=>visible(el)&&!candidates.some(parent=>parent!==el&&parent.contains(el)));
      if(roots.length){
        const latest=roots.at(-1);
        // One reply can contain several prose/code blocks. Count messages, not
        // markdown fragments, and never return just the last paragraph/block.
        const blockSelector='.markdown,[data-message-content],[data-markdown-text-style="assistant-message"]';
        const blocks=[...latest.querySelectorAll(blockSelector)].filter(el=>
          visible(el)&&!el.parentElement?.closest(blockSelector));
        const last=(blocks.length?blocks.map(el=>el.innerText).join('\n\n'):latest.innerText).trim();
        const id=latest.getAttribute('data-message-id')||latest.querySelector('[data-message-id]')?.getAttribute('data-message-id')||
          latest.getAttribute('data-chatgpt-selection-message-id')||latest.querySelector('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id')||
          latest.getAttribute('data-testid')||latest.closest('[data-turn-key]')?.getAttribute('data-turn-key');
        const selectionId=latest.getAttribute('data-chatgpt-selection-message-id')||latest.querySelector('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id');
        return {count:roots.length,last,...(id?{id}:{}),...(selectionId?{selectionId}:{})};
      }
    }
    for(const selector of a.result){
      const elements=[...document.querySelectorAll(selector)].filter(visible);
      if(elements.length)return {count:elements.length,last:elements.at(-1).innerText.trim()};
    }
    return {count:0,last:''};
  }
  const normalizeText=text=>text.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').trim();
  function editorText(node){
    if(node.nodeType===Node.TEXT_NODE)return node.textContent;
    if(node.nodeName==='BR')return node.classList.contains('ProseMirror-trailingBreak')?'':'\n';
    const children=[...node.childNodes];
    if(children.length===1&&children[0].nodeName==='BR')return '';
    let text='',previousBlock=false;
    children.forEach((child,index)=>{
      const block=/^(P|DIV|LI|PRE|BLOCKQUOTE|H[1-6])$/.test(child.nodeName);
      if(index&&(block||previousBlock))text+='\n';
      text+=editorText(child);previousBlock=block;
    });
    return text;
  }
  // innerText includes CSS paragraph spacing; textContent omits block breaks.
  const inputText=element=>normalizeText(element.value??editorText(element));
  async function execute(message) {
    if(message.action==='ping')return {version:'1.1.8'};
    check();
    const a = adapter();
    if(message.action==='auto-prepare'){
      if(first(a.busy))throw new Error('Trang AI đang trả lời. Chờ hoàn tất rồi tiếp tục.');
      const existing=promptField(a);
      if(existing&&inputText(existing)&&inputText(existing)!==normalizeText(message.prompt))throw new Error('Ô nhập AI có nội dung chưa gửi. Kiểm tra nội dung đó rồi tiếp tục.');
      const baseline=snapshot();
      await execute({...message,action:'fill',preserveDraft:true});
      const after=snapshot();
      if(after.count!==baseline.count||after.last!==baseline.last||first(a.busy))throw new Error('Nội dung trang đã thay đổi trong khi điền prompt. Kiểm tra tab AI rồi tiếp tục.');
      return {baseline};
    }
    if(message.action==='auto-send'||message.action==='auto-check-send'){
      // Readiness may lag behind the input event. Only the preflight waits;
      // every iteration rechecks the prompt and conversation before approval.
      const deadline=Date.now()+(message.action==='auto-check-send'?8000:0);
      let button;
      do {
      check();
      if(sent.has(message.jobKey))throw new Error('Prompt này đã gửi; chỉ lấy kết quả, không gửi lần nữa.');
      if(first(a.busy))throw new Error('AI đang tạo câu trả lời; không gửi thêm.');
      const current=snapshot();
      if(!message.baseline||current.count!==message.baseline.count||current.last!==message.baseline.last)throw new Error('Nội dung trang đã thay đổi. Kiểm tra thủ công để tránh lấy nhầm câu trả lời.');
      const input=promptField(a);
      if(!input)throw transient('Ô nhập đang tải lại. Đang chờ trang AI sẵn sàng.');
      if(!input||inputText(input)!==normalizeText(message.prompt))throw new Error('Prompt trên trang không khớp tác vụ. Không tự gửi.');
      button=runButton(a);
      if(button)break;
      if(Date.now()>=deadline)throw Object.assign(new Error('Chưa có nút gửi khả dụng. Kiểm tra đăng nhập, quota hoặc chế độ trang AI.'),{code:'SEND_NOT_READY'});
      await new Promise(resolve=>setTimeout(resolve,200));
      } while(true);
      if(message.action==='auto-check-send')return {ready:true};
      sent.add(message.jobKey);
      button.click();
      return {submitted:true};
    }
    if(message.action==='auto-poll'){
      const current=snapshot();
      if(!message.baseline)throw new Error('Thiếu mốc câu trả lời trước khi gửi; hãy lấy kết quả thủ công.');
      const newMessage=current.count>message.baseline.count||
        (current.id&&message.baseline.id&&current.id!==message.baseline.id);
      const fresh=newMessage&&current.last!==message.baseline.last;
      const busy=!!first(a.busy);
      return {text:fresh?current.last:'',busy,...(fresh&&current.selectionId?{copyTarget:{messageId:current.selectionId,text:current.last}}:{}),capture:{messages:current.count,
        baselineMessages:message.baseline.count,characters:current.last.length,fresh:!!fresh,busy}};
    }
    if (message.action === 'fill') {
      let element = null;
      for (let i = 0; i < 20; i++) { check(); element = promptField(a); if (element) break; await new Promise(resolve => setTimeout(resolve, 400)); }
      if (!element) throw transient('Chưa tìm thấy ô nhập ChatGPT/AI sẵn sàng. Đang chờ trang tải xong.');
      if (element.disabled || element.readOnly) throw new Error('Provider input is disabled. Resolve account or quota requirements manually.');
      // Recheck AFTER the editor appears; a late-mounted draft belongs to the user too.
      if(message.preserveDraft){
        if(first(a.busy))throw new Error('AI đang tạo câu trả lời; không điền thêm prompt.');
        if(inputText(element)&&inputText(element)!==normalizeText(message.prompt))throw new Error('Ô nhập AI có nội dung chưa gửi. Kiểm tra nội dung đó rồi tiếp tục.');
      }
      if(inputText(element)===normalizeText(message.prompt))return {message:'Prompt đã có sẵn trong ô nhập.'};
      element.focus();
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, message.prompt);
        element.dispatchEvent(new InputEvent('input', {bubbles:true, inputType:'insertText', data:message.prompt}));
      } else {
        // Native editing preserves line breaks and updates rich-editor state.
        // Assigning textContent collapses multiline prompts in contenteditables.
        const selection=window.getSelection(),range=document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();selection.addRange(range);
        if(!document.execCommand('insertText',false,message.prompt.replace(/\r\n?/g,'\n'))){
          throw new Error('Không điền được ô soạn thảo AI. Hãy dán prompt thủ công rồi tiếp tục.');
        }
      }
      element.dispatchEvent(new Event('change', {bubbles:true}));
      // Let the provider reconcile its editor model before checking/sending.
      await new Promise(resolve=>setTimeout(resolve,350));
      check();
      const current=promptField(a);
      if(!element.isConnected||current!==element)throw transient('Ô soạn thảo vừa tải lại. Đang kết nối lại để điền prompt.','EDITOR_CHANGED');
      if(inputText(current)!==normalizeText(message.prompt)){
        if(!inputText(current))throw transient('Trang AI chưa giữ nội dung vừa nhập. Đang chờ rồi điền lại.','EDITOR_CHANGED');
        throw new Error('Nội dung trong ô nhập không khớp prompt. Kiểm tra tab AI để tránh ghi đè bản nháp.');
      }
      return {message:'Prompt filled. Review the page before Send / Run.'};
    }
    if (message.action === 'send') {
      if(first(a.busy))throw new Error('AI đang tạo câu trả lời; không gửi thêm.');
      const button = runButton(a);
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') throw new Error('Run control unavailable. Review the page and submit manually.');
      button.click();
      return {message:'Submitted once. Wait for the provider; quotas and login stay under your control.'};
    }
    if (message.action === 'capture') {
      if (first(a.busy)) throw new Error('The provider is still generating. Wait before capture.');
      const text = lastResult();
      if (!text) throw new Error(a.media?'Download media manually, then attach it in StoryForge Assets.':'No response found. Copy the response and paste it in StoryForge Jobs.');
      return {text};
    }
    if (message.action === 'wait') {
      let previous = '', stable = 0;
      const deadline = Date.now() + Math.min(180000, Math.max(30000, message.timeout || 180000));
      while (Date.now() < deadline) {
        check();
        const text = lastResult();
        if (text && text === previous && !first(a.busy)) stable++; else stable = 0;
        if (stable >= 3) return {text};
        previous = text;
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      throw new Error('Timeout. Job stays waiting for you. Capture manually when the response is complete.');
    }
    throw new Error('Unknown bridge action');
  }
  globalThis.storyForgeListener=(message,sender,respond) => {
    if (message.type !== 'storyforge') return;
    execute(message).then(result=>respond({ok:true,...result})).catch(error=>respond({ok:false,error:error.message,code:error.code}));
    return true;
  };
  chrome.runtime.onMessage.addListener(globalThis.storyForgeListener);
})();
