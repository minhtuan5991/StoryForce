(() => {
  if (globalThis.storyForgeVersion === '1.1.5') return;
  if (globalThis.storyForgeListener) chrome.runtime.onMessage.removeListener(globalThis.storyForgeListener);
  globalThis.storyForgeVersion = '1.1.5';
  globalThis.storyForgeLoaded = true;
  const visible = el => !!el && !!el.getClientRects().length && !el.closest('[inert],[aria-hidden="true"]') &&
    (el.checkVisibility ? el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) : getComputedStyle(el).visibility!=='hidden');
  const first = selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(visible);
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
    const a = adapter();
    for (const selector of a.result) {
      const elements = [...document.querySelectorAll(selector)].filter(visible);
      if (elements.length) return elements.at(-1).innerText.trim();
    }
    return '';
  }
  const sent=new Set();
  function snapshot(){
    for(const selector of adapter().result){
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
    if(message.action==='ping')return {version:'1.1.5'};
    check();
    const a = adapter();
    if(message.action==='auto-prepare'){
      if(first(a.busy))throw new Error('Trang AI đang trả lời. Chờ hoàn tất rồi tiếp tục.');
      const existing=first(a.input);
      if(existing&&inputText(existing)&&inputText(existing)!==normalizeText(message.prompt))throw new Error('Ô nhập AI có nội dung chưa gửi. Kiểm tra nội dung đó rồi tiếp tục.');
      const baseline=snapshot();
      await execute({...message,action:'fill'});
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
      const input=first(a.input);
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
      const fresh=current.count>message.baseline.count&&current.last!==message.baseline.last;
      return {text:fresh?current.last:'',busy:!!first(a.busy)};
    }
    if (message.action === 'fill') {
      let element = null;
      for (let i = 0; i < 20; i++) { element = first(a.input); if (element) break; await new Promise(resolve => setTimeout(resolve, 400)); }
      if (!element) throw new Error('Prompt field not found. Open the correct generation screen, or copy/paste the prompt manually.');
      if (element.disabled || element.readOnly) throw new Error('Provider input is disabled. Resolve account or quota requirements manually.');
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
      await new Promise(resolve=>setTimeout(resolve,100));
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
