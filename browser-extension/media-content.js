// Provider UI adapters for media only. Text/JSON collection keeps its existing
// adapter and protocol. Every action uses visible, unambiguous controls.
(() => {
  const visible=e=>!!e&&!!e.getClientRects().length&&!e.closest('[inert],[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden';
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const label=e=>{
    const aria=e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('data-tooltip');
    if(aria)return norm(aria);
    const clone=e.cloneNode(true);clone.querySelectorAll('mat-icon,svg,[aria-hidden="true"]').forEach(icon=>icon.remove());
    return norm(clone.textContent)||norm(e.innerText||e.textContent);
  };
  const controls=()=>[...document.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],a,[role="tab"]')].filter(visible);
  const enabled=e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
  function find(pattern,root=document){return [...root.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],a,[role="tab"]')].filter(enabled).find(e=>pattern.test(label(e)))}
  function exact(text,root=document){
    const texts=Array.isArray(text)?text:[text];
    const control=controls().find(e=>root.contains(e)&&texts.includes(label(e)));
    if(control)return control;
    // Some voice/style cards use nested text spans instead of button roles.
    const candidates=[...root.querySelectorAll('span,div,p')].filter(e=>visible(e)&&texts.includes(norm(e.textContent)));
    return candidates.find(e=>!candidates.some(child=>child!==e&&e.contains(child)));
  }
  function editor(){
    const fields=[...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e=>visible(e)&&!e.disabled&&!e.readOnly&&
      !e.closest('nav,aside,[role="search"]')&&!/search|tìm kiếm/i.test(e.getAttribute('placeholder')||e.getAttribute('aria-label')||''));
    const top=fields.filter(e=>!fields.some(parent=>parent!==e&&parent.contains(e)));
    if(top.length!==1)throw Object.assign(new Error('Chưa có một ô nhập media duy nhất khả dụng'),{code:'INPUT_NOT_READY'});
    return top[0];
  }
  const text=e=>norm(e.value??e.innerText??e.textContent);
  function busy(provider){
    return controls().some(e=>/^(Stop|Dừng)( generating| generation| response| tạo| phản hồi)?$|Stop generating|Dừng tạo|Hủy tạo/i.test(label(e)))||
      (provider==='flow'&&[...document.querySelectorAll('[role="progressbar"]')].some(visible));
  }
  function run(provider){
    const patterns={aistudio:/^Run(?:\s|$)|^Chạy(?:\s|$)/,gemini:/Send message|Send prompt|Gửi tin nhắn|^Send$|^Gửi$|^send$/,
      flow:/^arrow_forward$|^send$|^Create$|^Generate$|^Tạo$|^Gửi$|^Bắt đầu tạo$|Send prompt|Generate video|Tạo video/};
    return find(patterns[provider]);
  }
  function checkpoint(){
    if([...document.querySelectorAll('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],#challenge-stage')].some(visible))throw new Error('Hãy tự hoàn tất CAPTCHA rồi tiếp tục Bridge.');
  }
  function settingsPanel(){return [...document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"]')].find(visible)||document}
  function clickOne(e,message){if(!enabled(e))throw new Error(message);e.click();return {ready:false,message}}
  const owned=globalThis.storyForgeMediaOwned||={};
  let stableEditor,stableAt=0;

  function setupStudio(){
    const create=find(/^Create new dialog$|^Tạo hộp thoại mới$/);
    if(create)return clickOne(create,'Đang tạo hộp thoại AI Studio…');
    const speaker=find(/^Speaker 1\s*[-–]\s*/);
    // Voice selection is not complete until the speech-block badge says Enzo.
    if(!speaker||!/^Speaker 1\s*[-–]\s*Enzo$/.test(label(speaker))){
      const enzo=exact('Enzo',settingsPanel());
      if(enzo){enzo.click();return {ready:false,message:'Đã chọn Enzo, đang xác minh…'}}
      const search=[...document.querySelectorAll('input')].find(e=>visible(e)&&/search.*voices|tìm.*giọng/i.test(e.placeholder||''));
      if(search&&search.value!=='Enzo'){setEditor(search,'Enzo');return {ready:false,message:'Đang tìm giọng Enzo…'}}
      if(speaker)return clickOne(speaker,'Đang mở lựa chọn giọng Enzo…');
      throw Object.assign(new Error('Đang chờ hộp thoại giọng đọc'),{code:'INPUT_NOT_READY'});
    }
    // New AI Studio leaves its Speaker settings drawer open after selection.
    const drawer=[...document.querySelectorAll('[role="dialog"],aside,ms-speaker-settings')].find(e=>visible(e)&&/Speaker settings|Cài đặt người nói/.test(e.innerText||''));
    const close=drawer&&find(/^Close$|^close$|^Đóng$|Close speaker settings/,drawer);
    if(close)return clickOne(close,'Đang đóng bảng giọng đọc…');
    const styleBadge=controls().find(e=>/^(?:Style|Phong cách|Neutral|Serious|Casual|Friendly)$/.test(label(e))&&
      !e.closest('[role="menu"],[role="listbox"]')&&e.getAttribute('role')!=='option'&&e.getAttribute('role')!=='menuitem');
    if(!styleBadge||label(styleBadge)!=='Friendly'){
      const option=exact('Friendly',settingsPanel());
      if(option)return clickOne(option,'Đang chọn style Friendly…');
      const style=styleBadge;
      if(style)return clickOne(style,'Đang mở lựa chọn style Friendly…');
      throw new Error('Không thấy style Friendly. Kiểm tra bảng Speaker/Style của AI Studio.');
    }
    const popup=[...document.querySelectorAll('[role="menu"],[role="listbox"]')].find(visible);
    if(popup){styleBadge.click();return {ready:false,message:'Đang đóng menu style…'}}
    return {ready:true};
  }

  function flowSetup(){
    const create=find(/^(?:add\s*)?(?:New project|Dự án mới)$/i);
    if(create)return clickOne(create,'Đang tạo dự án Flow…');
    const expected=[['Video'],['Thành phần','Ingredients'],['16:9'],['Omni 1.1 Flash'],['720p'],['10 giây','10 seconds','10s'],['x1']];
    const summary=controls().find(e=>/Video.*720p.*(?:10 giây|10 seconds|10s).*x1/i.test(norm(e.innerText||e.textContent)));
    const trigger=find(/Điều kiện kích hoạt cài đặt|Generation settings|Settings trigger|Cài đặt tạo/i)||summary||find(/Video.*(?:720p|360p|1080p).*(?:giây|seconds|s)/i);
    const modelMenu=[...document.querySelectorAll('[role="menu"],[role="listbox"],.cdk-overlay-pane')].find(e=>visible(e)&&
      /Omni|Veo/.test(e.innerText||'')&&!/720p/.test(e.innerText||''));
    if(modelMenu){
      const option=exact('Omni 1.1 Flash',modelMenu);
      if(!option)throw new Error('Flow chưa có model Omni 1.1 Flash. Bridge không chọn model khác.');
      return clickOne(option,'Đang chọn model Omni 1.1 Flash…');
    }
    let panel=[...document.querySelectorAll('[role="dialog"],[role="menu"],[data-state="open"],.cdk-overlay-pane')].find(e=>visible(e)&&/720p/.test(e.innerText||''));
    // Flow's settings popover can expose separate radio groups with no menu
    // role. Locate their smallest shared visible container instead.
    if(!panel){
      let candidate=exact('720p');
      while(candidate&&candidate!==document.body){
        const value=norm(candidate.innerText||candidate.textContent);
        if(/360p/.test(value)&&/16:9/.test(value)&&/x1/.test(value)){panel=candidate;break}
        candidate=candidate.parentElement;
      }
    }
    if(!panel){
      if(owned.flowVerified&&summary){owned.flowConfigured=true;return {ready:true}}
      if(trigger)return clickOne(trigger,'Đang mở cài đặt Flow…');
      throw Object.assign(new Error('Chưa thấy cài đặt tạo video Flow'),{code:'INPUT_NOT_READY'});
    }
    for(const names of expected){
      const item=exact(names,panel);
      if(!item){
        if(names[0]==='Omni 1.1 Flash'){
          const model=find(/Omni|Veo|Model|Mô hình|Chọn nhóm mô hình/i,panel);
          if(model)return clickOne(model,'Đang mở danh sách model Omni 1.1 Flash…');
        }
        throw new Error('Flow chưa có lựa chọn '+names.join(' / ')+'. Bridge dừng để bạn kiểm tra, không đổi model/cài đặt.');
      }
      const parent=item.closest('button,[role="tab"],[role="radio"],[role="option"]')||item;
      const selected=names[0]==='Omni 1.1 Flash'||parent.getAttribute('aria-selected')==='true'||parent.getAttribute('aria-checked')==='true'||parent.getAttribute('aria-pressed')==='true'||
        parent.getAttribute('data-state')==='active'||parent.getAttribute('data-state')==='checked'||
        /(?:^|\s)(?:selected|active|checked|mat-button-toggle-checked)(?:\s|$)/.test(parent.className||'');
      if(!selected){
        // A click is not proof of a selected setting. Verify the actual radio
        // state on the next poll and stop if the UI did not accept it.
        const attempts=owned.flowChoices||{};
        if((attempts[names[0]]||0)>=2)throw new Error('Chưa xác minh được cài đặt Flow '+names[0]+'. Hãy kiểm tra lựa chọn trên trang.');
        owned.flowChoices={...attempts,[names[0]]:(attempts[names[0]]||0)+1};
        parent.click();return {ready:false,message:'Đang chọn Flow '+names[0]+'…'};
      }
    }
    owned.flowVerified=true;
    if(!trigger||!summary)throw new Error('Chưa xác minh được Video / 720p / 10 giây / x1 trong Flow. Kiểm tra cài đặt rồi tiếp tục.');
    return clickOne(trigger,'Đang đóng bảng cài đặt Flow…');
  }
  function setEditor(field,prompt){
    field.focus();
    if(field instanceof HTMLTextAreaElement||field instanceof HTMLInputElement){
      const prototype=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,prompt);
      field.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(field);selection.removeAllRanges();selection.addRange(range);
      if(!document.execCommand('insertText',false,prompt))throw new Error('Không nhập được nội dung media');
      field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:prompt}));
    }
    field.dispatchEvent(new Event('change',{bubbles:true}));
  }
  const mediaSelector={aistudio:'audio',gemini:'model-response img,model-response image-preview img,[data-test-id="generated-image"] img',flow:'video,img[alt]'};
  function mediaItems(provider){return [...document.querySelectorAll(mediaSelector[provider])].filter(e=>
    provider==='gemini'?visible(e)&&e.naturalWidth>=300:
      provider==='flow'&&e.tagName==='IMG'?visible(e)&&/Hình thu nhỏ của video đã tạo|generated video thumbnail/i.test(e.alt):!!(e.currentSrc||e.src||e.querySelector('source')?.src))}
  const source=e=>e.currentSrc||e.src||e.querySelector('source')?.src||'';
  function snapshot(provider){return mediaItems(provider).map(e=>source(e))}
  function resultNode(message){return mediaItems(message.provider).find(e=>source(e)===message.result?.url)}
  function downloadButton(node,provider){
    const pattern=/Download|Tải.*(?:xuống|về)|^download$|^file_download$/i;
    let root=node.parentElement;
    while(root&&root!==document.body){const button=find(pattern,root);if(button)return button;root=root.parentElement}
    return ['aistudio','flow'].includes(provider)?find(pattern):undefined;
  }
  globalThis.storyForgeMediaExecute=async message=>{
    checkpoint();
    const {provider,action}=message;
    const allowed={aistudio:['aistudio.google.com'],gemini:['gemini.google.com'],flow:['flow.google.com','labs.google']}[provider];
    if(!allowed?.includes(location.hostname))throw new Error('Không đúng dịch vụ tạo media');
    if(document.readyState!=='complete')return {ready:false,message:'Đang chờ trang tải xong…'};
    if(action==='media-setup'){
      if(owned.setupJobId!==message.jobId){
        owned.setupJobId=message.jobId;
        delete owned.flowConfigured;delete owned.flowVerified;delete owned.flowChoices;
      }
      if(busy(provider))return {ready:false,message:'Dịch vụ đang tạo nội dung trước, đang chờ hoàn tất…'};
      if(provider==='aistudio'){const setup=setupStudio();if(!setup.ready)return setup}
      if(provider==='flow'&&!owned.flowConfigured){const setup=flowSetup();if(!setup.ready)return setup}
      const field=editor();
      if(field!==stableEditor){stableEditor=field;stableAt=Date.now();return {ready:false}}
      return {ready:Date.now()-stableAt>=2000};
    }
    if(action==='media-prepare'){
      if(busy(provider))throw Object.assign(new Error('Dịch vụ vẫn đang tạo media'),{code:'INPUT_NOT_READY'});
      const field=editor(),existing=text(field);
      if(existing&&existing!==norm(message.prompt)&&existing!==owned.lastPrompt)throw new Error('Ô nhập có nội dung bạn đang soạn. Bridge không xóa nội dung đó.');
      const baseline=snapshot(provider);
      owned.baselineNodes=mediaItems(provider);
      setEditor(field,message.prompt);
      if(text(field)!==norm(message.prompt))throw Object.assign(new Error('Ô nhập chưa nhận đủ nội dung'),{code:'INPUT_NOT_READY'});
      owned.lastPrompt=norm(message.prompt);
      return {baseline};
    }
    if(action==='media-ready')return {ready:!busy(provider)&&text(editor())===norm(message.prompt)&&!!run(provider)};
    if(action==='media-send'){
      if(owned.sent?.includes(message.jobId))return {submitted:true};
      if(busy(provider)||text(editor())!==norm(message.prompt))throw new Error('Ô nhập đã thay đổi trước khi tạo media');
      const button=run(provider);
      if(!button)throw new Error('Chưa có nút Run / Tạo khả dụng');
      owned.sent=[...(owned.sent||[]),message.jobId];button.click();return {submitted:true};
    }
    if(action==='media-poll'){
      if(busy(provider))return {ready:false};
      const items=mediaItems(provider).filter(e=>!(message.baseline||[]).includes(source(e))&&
        !(provider==='flow'&&e.tagName==='IMG'&&owned.baselineNodes?.includes(e)));
      const node=items.find(e=>e.tagName==='VIDEO')||items.at(-1);
      if(!node)return {ready:false};
      if(provider==='flow'&&node.tagName==='IMG'){
        const url=source(node);
        if(owned.flowThumbnail!==url){owned.flowThumbnail=url;owned.flowThumbnailAt=Date.now();return {ready:false}}
        if(Date.now()-owned.flowThumbnailAt<4000)return {ready:false};
        if(owned.openedThumbnail===url)return {ready:false,message:'Đang chờ trình phát video Flow…'};
        // Flow displays completed videos as thumbnail tiles. Clicking their
        // play area opens the actual media player in this same tab; the title
        // button only opens prompt information and must not be used here.
        owned.openedThumbnail=url;
        node.click();return {ready:false,message:'Đang mở video Flow vừa tạo…'};
      }
      const button=downloadButton(node,provider);
      if(!button&&provider==='flow'){
        const more=find(/^(?:Tuỳ chọn khác|Tùy chọn khác|More options)$/i);
        if(more){more.click();return {ready:false,message:'Đang mở tùy chọn tải video Flow…'}}
      }
      if(!button)return {ready:false,message:'Media đã xuất hiện, đang chờ nút tải khả dụng…'};
      const url=source(node);
      if(owned.resultUrl!==url){owned.resultUrl=url;owned.resultAt=Date.now();return {ready:false}}
      return {ready:Date.now()-owned.resultAt>=4000,result:{url}};
    }
    if(action==='media-download-info'){
      const node=resultNode(message);
      if(!node)throw new Error('Media vừa tạo không còn trên trang');
      const button=downloadButton(node,provider);
      if(!button)throw new Error('Không tìm thấy nút tải cho media vừa tạo');
      // Prefer the provider's Download action (full image / encoded WAV), not
      // a low-resolution preview URL. The worker captures its exact URL.
      const href=button.tagName==='A'&&button.getAttribute('download')!==null?button.href:null;
      // Audio/video players expose the actual generated media, including blobs.
      // Download it through chrome.downloads(saveAs:false), avoiding AI Studio's
      // Save As picker and Chrome's "ask where to save" preference.
      return {url:href||source(node),referrer:location.href,direct:provider==='aistudio'||!!href};
    }
    if(action==='media-download-click'){
      const node=resultNode(message),button=node&&downloadButton(node,provider);
      if(!button)throw new Error('Nút tải đã thay đổi. Kiểm tra tab rồi tiếp tục.');
      button.click();return {clicked:true};
    }
    if(action==='media-download-continue'){
      if(provider!=='flow')return {clicked:false};
      if(!resultNode(message)||owned.downloadChoice===message.jobId)return {clicked:false};
      const menus=[...document.querySelectorAll('[role="menu"],.cdk-overlay-pane')].filter(visible);
      const original=menus.map(menu=>find(/(?:Original|Kích thước gốc|Độ phân giải gốc|720p)/i,menu)).find(Boolean);
      if(!original)return {clicked:false};
      if(/Upscale|Nâng cấp|1080p|4K/i.test(label(original)))throw new Error('Không tải bản nâng cấp của Flow. Chọn bản gốc 720p.');
      owned.downloadChoice=message.jobId;original.click();return {clicked:true};
    }
    throw new Error('Unknown media action');
  };
})();
