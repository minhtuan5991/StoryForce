// Provider UI adapters for media only. Text/JSON collection keeps its existing
// adapter and protocol. Every action uses visible, unambiguous controls.
(() => {
  const visible=e=>!!e&&!!e.getClientRects().length&&!e.closest('[inert],[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden';
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const caption=e=>{
    const clone=e.cloneNode(true);clone.querySelectorAll('mat-icon,svg,[aria-hidden="true"]').forEach(icon=>icon.remove());
    return norm(clone.textContent)||norm(e.innerText||e.textContent);
  };
  const label=e=>norm(e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('data-tooltip'))||caption(e);
  const controls=()=>[...document.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],a,[role="tab"]')].filter(visible);
  const enabled=e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
  function find(pattern,root=document){return [...root.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],a,[role="tab"]')].filter(enabled).find(e=>pattern.test(label(e)))}
  function exact(text,root=document){
    const texts=Array.isArray(text)?text:[text];
    const control=controls().find(e=>root.contains(e)&&(texts.includes(label(e))||texts.includes(caption(e))));
    if(control)return control;
    // Some voice/style cards use nested text spans instead of button roles.
    const candidates=[...root.querySelectorAll('span,div,p')].filter(e=>visible(e)&&texts.includes(norm(e.textContent)));
    return candidates.find(e=>!candidates.some(child=>child!==e&&e.contains(child)));
  }
  function editor(){
    const fields=[...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e=>visible(e)&&!e.disabled&&!e.readOnly&&
      !e.closest('.ql-clipboard,nav,aside,[role="search"]')&&!/search|tìm kiếm/i.test(e.getAttribute('placeholder')||e.getAttribute('aria-label')||''));
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
    // AI Studio keeps its voice picker open after a selection. The speech
    // badge behind it is inert, so verify the selected voice inside the picker
    // and close that picker before reading the badge again.
    const drawer=[...document.querySelectorAll('[role="dialog"],[id^="mat-mdc-dialog-"],aside,ms-speaker-settings')].find(e=>
      visible(e)&&e.querySelector('[data-voice-name]')&&/Speaker settings|Cài đặt người nói/.test(e.innerText||e.textContent||''));
    if(drawer){
      const selected=drawer.querySelector('[data-voice-name="Enzo"].selected')||find(/^Enzo\s*\(Current\)$/i,drawer);
      if(selected){
        const close=find(/^Close(?: panel)?$|^close$|^Đóng$|Close speaker settings/,drawer);
        if(close)return clickOne(close,'Đang đóng bảng giọng đọc Enzo…');
        throw new Error('Đã chọn Enzo nhưng chưa thấy nút đóng bảng giọng đọc.');
      }
      const card=drawer.querySelector('[data-voice-name="Enzo"]');
      const option=card?.querySelector('button.voice-card-content')||find(/^Enzo$/,drawer);
      if(option)return clickOne(option,'Đã chọn Enzo, đang xác minh…');
      const search=[...drawer.querySelectorAll('input')].find(e=>visible(e)&&/search.*voices|tìm.*giọng/i.test(e.placeholder||''));
      if(search&&search.value!=='Enzo'){setEditor(search,'Enzo');return {ready:false,message:'Đang tìm giọng Enzo…'}}
      throw Object.assign(new Error('Đang chờ danh sách giọng Enzo'),{code:'INPUT_NOT_READY'});
    }
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
    const styleBadge=controls().find(e=>/^(?:Style|Phong cách|Neutral|Serious|Casual|Friendly)$/.test(label(e))&&
      !e.closest('[role="menu"],[role="listbox"],.cdk-overlay-pane')&&e.getAttribute('role')!=='option'&&e.getAttribute('role')!=='menuitem');
    // The badge's accessible name stays "Style" after selection; its visible
    // caption carries "Friendly". Do not reopen an already-selected style.
    if(!styleBadge||caption(styleBadge)!=='Friendly'){
      const option=exact('Friendly',settingsPanel());
      if(option)return clickOne(option,'Đang chọn style Friendly…');
      const style=styleBadge;
      if(style)return clickOne(style,'Đang mở lựa chọn style Friendly…');
      throw new Error('Không thấy style Friendly. Kiểm tra bảng Speaker/Style của AI Studio.');
    }
    const popup=[...document.querySelectorAll('[role="menu"],[role="listbox"],.cdk-overlay-pane')].find(e=>visible(e)&&
      !e.contains(styleBadge)&&!!exact('Friendly',e));
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
  function sourceKey(e){
    const url=source(e);
    if(!url.startsWith('data:'))return url;
    const cache=owned.sourceKeys||=new WeakMap(),previous=cache.get(e);
    if(previous?.url===url)return previous.key;
    // After playback AI Studio may put the whole WAV in AUDIO.src. A baseline
    // must identify that prior result without persisting megabytes of PCM.
    let hash=2166136261;
    for(let i=0;i<url.length;i++)hash=Math.imul(hash^url.charCodeAt(i),16777619);
    const key='data:storyforge:'+url.length+':'+(hash>>>0).toString(16);
    cache.set(e,{url,key});return key;
  }
  function snapshot(provider){return mediaItems(provider).map(e=>provider==='aistudio'?sourceKey(e):source(e))}
  function resultNode(message){
    const items=mediaItems(message.provider);
    // AI Studio swaps playback packet URLs while the same completed result is
    // playing. The authorized job and unchanged editor identify that result;
    // an old packet URL must not prevent its full Download action.
    if(message.provider==='aistudio'&&message.result&&text(editor())===norm(message.prompt)&&!busy('aistudio'))
      return items.at(-1);
    return items.find(e=>source(e)===message.result?.url);
  }
  function downloadButton(node,provider){
    const pattern=/Download|Tải.*(?:xuống|về)|^download$|^file_download$/i;
    if(provider==='flow')return flowTileButton(node,pattern);
    let root=node.parentElement;
    while(root&&root!==document.body){const button=find(pattern,root);if(button)return button;root=root.parentElement}
    return provider==='aistudio'?find(pattern):undefined;
  }
  function studioDuration(node,button){
    // The AUDIO source can be a 40 ms streaming packet. Use the visible
    // player's total-time counter, never that packet's duration, for checking
    // the WAV constructed by the provider's Download action.
    const seek=[...document.querySelectorAll('[role="slider"],input[type="range"]')].find(e=>
      visible(e)&&/Seek audio|audio position|Vị trí âm thanh/i.test(label(e)));
    for(let root=(seek||button||node).parentElement;root&&root!==document.body;root=root.parentElement){
      if(button&&!root.contains(button))continue;
      const times=[...root.querySelectorAll('span,div,time,p')].filter(e=>visible(e)&&
        !e.closest('textarea,[contenteditable="true"],nav,aside')&&!e.children.length)
        .map(e=>norm(e.textContent)).filter(s=>/^(?:\d+:)?\d{1,3}:\d{2}$/.test(s))
        .map(s=>s.split(':').reduce((seconds,part)=>seconds*60+Number(part),0));
      if(times.length)return Math.max(...times);
    }
  }
  const flowThumbnail=e=>e.tagName==='IMG'&&/Hình thu nhỏ của video đã tạo|generated video thumbnail/i.test(e.alt);
  const flowDownload=/Download|Tải.*(?:xuống|về)|^download$|^file_download$/i;
  const flowMenus=()=>[...document.querySelectorAll('[role="menu"],.cdk-overlay-pane')].filter(visible);
  function flowTileButton(node,pattern){
    // Never climb into the project grid and use a neighbouring clip's action.
    for(let root=node.parentElement;root&&root!==document.body;root=root.parentElement){
      const thumbnails=[...root.querySelectorAll('img[alt]')].filter(flowThumbnail);
      if(new Set(thumbnails.map(source)).size>1)break;
      const button=find(pattern,root);if(button)return button;
    }
  }
  function flowResult(message){
    const saved=message.collection?.jobId===message.jobId?message.collection:undefined;
    const local=owned.flowCollection?.jobId===message.jobId?owned.flowCollection:undefined;
    // An action may succeed even when its reply is lost. Preserve the page's
    // newer action evidence instead of overwriting it with the worker's copy.
    let collection=saved?{...saved,...(local?.thumbnailUrl===saved.thumbnailUrl?local:{})}:local?{...local}:undefined;
    const reply=(value={ready:false})=>{owned.flowCollection=collection;return {...value,...(collection?{collection}:{})}};
    // Upgrade an already-open clip from the old adapter even when Flow's
    // canvas editor has removed every generated thumbnail from the DOM.
    if(!collection&&owned.setupJobId===message.jobId&&owned.openedThumbnail&&!(message.baseline||[]).includes(owned.openedThumbnail))
      collection={jobId:message.jobId,thumbnailUrl:owned.openedThumbnail,selectedAt:owned.flowThumbnailAt||Date.now()-4000,openedAt:Date.now(),projectUrl:location.href};
    if(!collection){
      if(busy('flow')&&!find(/^(?:Xong|Done)$/i))return reply();
      const items=mediaItems('flow').filter(e=>!(message.baseline||[]).includes(source(e))&&
        !(flowThumbnail(e)&&owned.baselineNodes?.includes(e)));
      const candidates=[...new Map(items.filter(flowThumbnail).map(e=>[source(e),e])).values()];
      const videos=[...new Map(items.filter(e=>e.tagName==='VIDEO').map(e=>[source(e),e])).values()];
      const outputs=candidates.length?candidates:videos;
      if(outputs.length>1)throw new Error('Có nhiều video Flow mới; chưa xác định được một kết quả duy nhất cho scene này. Kiểm tra tab rồi tiếp tục.');
      const node=message.result?resultNode(message):outputs[0];
      if(!node)return reply();
      const url=source(node);
      collection={jobId:message.jobId,thumbnailUrl:url,selectedAt:Date.now(),projectUrl:location.href};
      // Recover a clip already opened by the previous adapter in this page.
      if(owned.openedThumbnail===url)collection.openedAt=Date.now();
      if(message.result)collection.selectedAt-=4000;
      return reply();
    }
    const page=new URL(collection.projectUrl).pathname.split('/edit/')[0].replace(/\/$/,'');
    if(location.pathname!==page&&!location.pathname.startsWith(page+'/'))throw new Error('Tab Flow đã chuyển sang dự án khác. Mở lại dự án của video đang chờ tải.');
    const done=find(/^(?:Xong|Done)$/i);
    if(done){
      // Only leave the editor we opened for this exact job. Its canvas player
      // may not expose a VIDEO element, and its timeline may be a progressbar.
      if(!collection.openedAt)return reply({ready:false,message:'Đang chờ trở về danh sách video Flow của tác vụ này…'});
      if(!collection.doneClickedAt){
        collection.doneClickedAt=Date.now();owned.flowCollection=collection;done.click();
        return reply({ready:false,message:'Đang bấm Xong để trở về danh sách video Flow…'});
      }
      return reply({ready:false,message:'Đang chờ Flow đóng màn hình chỉnh sửa video…'});
    }
    if(busy('flow'))return reply();
    const nodes=collection.menuOpened?[...document.querySelectorAll(mediaSelector.flow)]:mediaItems('flow');
    const node=nodes.find(e=>source(e)===collection.thumbnailUrl);
    if(!node)return reply({ready:false,message:'Đang chờ video vừa tạo xuất hiện lại trong danh sách Flow…'});
    if(Date.now()-collection.selectedAt<4000)return reply();
    const menus=flowMenus();
    const menu=collection.menuOpened&&menus.length===1?menus[0]:undefined;
    const button=flowTileButton(node,flowDownload)||(menu&&find(flowDownload,menu));
    if(button)return reply({ready:true,result:{url:collection.thumbnailUrl},button,node});
    const more=flowTileButton(node,/^(?:Tuỳ chọn khác|Tùy chọn khác|More options)$/i);
    if(more&&!menus.length){
      collection.menuOpened=true;owned.flowCollection=collection;more.click();
      return reply({ready:false,message:'Đang mở tùy chọn tải đúng video Flow vừa tạo…'});
    }
    if(flowThumbnail(node)&&!collection.openedAt&&!menus.length){
      collection.openedAt=Date.now();owned.flowCollection=collection;node.click();
      return reply({ready:false,message:'Đang mở video Flow vừa tạo…'});
    }
    return reply({ready:false,message:'Đang chờ nút tải của video Flow vừa tạo…'});
  }
  function flowResponse(result){const {button,node,...response}=result;return response}
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
      if(existing&&existing!==norm(message.prompt)&&existing!==owned.lastPrompt&&existing!==norm(message.previousPrompt))
        throw new Error('Ô nhập có nội dung bạn đang soạn. Bridge không xóa nội dung đó.');
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
      if(provider==='flow')return flowResponse(flowResult(message));
      if(busy(provider))return {ready:false};
      const items=mediaItems(provider).filter(e=>!(message.baseline||[]).includes(provider==='aistudio'?sourceKey(e):source(e))&&
        !(provider==='aistudio'&&(message.baseline||[]).includes(source(e)))&&
        !(provider==='flow'&&e.tagName==='IMG'&&owned.baselineNodes?.includes(e)));
      const node=items.find(e=>e.tagName==='VIDEO')||items.at(-1);
      if(!node)return {ready:false};
      const button=downloadButton(node,provider);
      if(!button)return {ready:false,message:'Media đã xuất hiện, đang chờ nút tải khả dụng…'};
      const url=source(node);
      const expectedDuration=provider==='aistudio'?studioDuration(node,button):undefined;
      const signature=(provider==='aistudio'?message.jobId:url)+'|'+(expectedDuration??'');
      if(owned.resultSignature!==signature){owned.resultSignature=signature;owned.resultAt=Date.now();return {ready:false}}
      return {ready:Date.now()-owned.resultAt>=4000,result:{...(provider==='aistudio'?{jobId:message.jobId}:{url}),...(expectedDuration>0?{expectedDuration}:{})}};
    }
    if(action==='media-download-info'){
      const flow=provider==='flow'?flowResult(message):undefined;
      if(flow&&!flow.ready)return flowResponse(flow);
      const node=flow?.node||resultNode(message);
      if(!node)throw new Error('Media vừa tạo không còn trên trang');
      const button=flow?.button||downloadButton(node,provider);
      if(!button)throw new Error('Không tìm thấy nút tải cho media vừa tạo');
      // Prefer the provider's Download action (full image / encoded WAV), not
      // a low-resolution preview URL. The worker captures its exact URL.
      const href=button.tagName==='A'&&button.getAttribute('download')!==null?button.href:null;
      // AI Studio's player exposes individual PCM streaming packets. Clicking
      // Download assembles all packets into the full WAV. Capture that exact
      // download blob instead of saving the preview, even if it is a valid WAV.
      const expectedDuration=provider==='aistudio'?studioDuration(node,button):undefined;
      return {url:href||(provider==='aistudio'?undefined:source(node)),referrer:location.href,direct:!!href,
        ...(expectedDuration>0?{expectedDuration}:{}),...(flow?{collection:flow.collection}:{})};
    }
    if(action==='media-download-click'){
      const flow=provider==='flow'?flowResult(message):undefined;
      if(flow&&!flow.ready)return flowResponse(flow);
      const node=flow?.node||resultNode(message),button=flow?.button||(node&&downloadButton(node,provider));
      if(!button)throw new Error('Nút tải đã thay đổi. Kiểm tra tab rồi tiếp tục.');
      button.click();return {clicked:true};
    }
    if(action==='media-download-continue'){
      if(provider!=='flow')return {clicked:false};
      // A provider menu can temporarily mark its grid inert. Match the exact
      // result without requiring its thumbnail to remain interactive.
      const node=[...document.querySelectorAll(mediaSelector.flow)].find(e=>source(e)===message.result?.url);
      if(!node||owned.downloadChoice===message.jobId)return {clicked:false};
      const menus=[...document.querySelectorAll('[role="menu"],.cdk-overlay-pane')].filter(visible);
      const original=menus.map(menu=>find(/(?:Original|Kích thước gốc|Độ phân giải gốc|720p)/i,menu)).find(Boolean);
      if(!original)return {clicked:false};
      if(/Upscale|Nâng cấp|1080p|4K/i.test(label(original)))throw new Error('Không tải bản nâng cấp của Flow. Chọn bản gốc 720p.');
      owned.downloadChoice=message.jobId;original.click();return {clicked:true};
    }
    throw new Error('Unknown media action');
  };
})();
