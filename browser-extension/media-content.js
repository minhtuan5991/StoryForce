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
  const controls=()=>[...document.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],a,[role="tab"]')].filter(visible);
  const enabled=e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
  function find(pattern,root=document){return [...root.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],a,[role="tab"]')].filter(enabled).find(e=>pattern.test(label(e)))}
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
    const selectors=globalThis.STORYFORGE_ADAPTERS?.[provider==='lyria'?'gemini':provider]?.busy||[];
    return selectors.some(selector=>[...document.querySelectorAll(selector)].some(visible))||
      controls().some(e=>/^(Stop|Dừng)( generating| generation| response| tạo| phản hồi)?$|Stop generating|Dừng tạo|Hủy tạo|Ngừng (?:tạo|phản hồi)/i.test(label(e)))||
      (provider==='flow'&&[...document.querySelectorAll('[role="progressbar"]')].some(visible));
  }
  function run(provider){
    const patterns={aistudio:/^Run(?:\s|$)|^Chạy(?:\s|$)/,gemini:/Send message|Send prompt|Gửi tin nhắn|^Send$|^Gửi$|^send$/,
      flow:/^arrow_forward$|^send$|^Create$|^Generate$|^Tạo$|^Gửi$|^Bắt đầu tạo$|Send prompt|Generate video|Tạo video/,
      lyria:/Send message|Send prompt|Gửi tin nhắn|^Send$|^Gửi$|^send$/};
    return find(patterns[provider]);
  }
  function checkpoint(){
    if([...document.querySelectorAll('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],#challenge-stage')].some(visible))throw new Error('Hãy tự hoàn tất CAPTCHA rồi tiếp tục Bridge.');
  }
  function settingsPanel(){return [...document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"]')].find(visible)||document}
  function clickOne(e,message){if(!enabled(e))throw new Error(message);e.click();return {ready:false,message}}
  const owned=globalThis.storyForgeMediaOwned||={};
  let stableEditor,stableAt=0;

  function setupLyria(){
    if(!find(/^(?:Bỏ chọn Nhạc|Deselect Music|Remove Music|Unselect Music)$/i)){
      const choice=find(/^(?:Tạo nhạc|Create music)$/i);
      if(choice)return clickOne(choice,'Đang chọn Lyria tạo nhạc…');
      const more=find(/^(?:Công cụ khác|Các công cụ khác|More tools|Other tools)$/i);
      if(more)return clickOne(more,'Đang mở công cụ nhạc…');
      const tools=find(/^(?:Nội dung tải lên và công cụ|Uploads and tools|Add files and tools|Tools|Công cụ)$/i);
      if(tools)return clickOne(tools,'Đang mở menu tạo nhạc Gemini…');
      throw Object.assign(new Error('Chưa thấy công cụ Tạo nhạc Lyria trong Gemini. Kiểm tra tài khoản; không gửi prompt ở chế độ ảnh hoặc chat.'),{code:'INPUT_NOT_READY'});
    }
    const duration=find(/^(?:Thời lượng|Duration)(?:,|:|\s)/i)||find(/^(?:Thời lượng|Duration)$/i);
    if(!duration||!/(?:Ngắn|Short|30\s*(?:s|sec|giây))/i.test(label(duration)+caption(duration))){
      const short=find(/^(?:Ngắn|Short|30 seconds|30 giây)$/i);
      if(short)return clickOne(short,'Đang chọn đoạn nhạc ngắn…');
      if(duration)return clickOne(duration,'Đang chọn thời lượng Lyria…');
      throw Object.assign(new Error('Đang chờ lựa chọn thời lượng nhạc Lyria'),{code:'INPUT_NOT_READY'});
    }
    const vocals=find(/^(?:Có giọng hát|Vocals|Vocal)(?:,|:|\s)/i)||find(/^(?:Có giọng hát|Vocals|Vocal)$/i);
    if(!vocals||!/(?:Không lời|Instrumental)/i.test(label(vocals)+caption(vocals))){
      const instrumental=find(/^(?:Không lời|Instrumental)$/i);
      if(instrumental)return clickOne(instrumental,'Đang chọn nhạc không lời…');
      if(vocals)return clickOne(vocals,'Đang mở chế độ không lời…');
      throw Object.assign(new Error('Đang chờ chế độ nhạc không lời Lyria'),{code:'INPUT_NOT_READY'});
    }
    return {ready:true};
  }
  const musicDownload=/^(?:Tải bản nhạc xuống|Download track|Download music)$/i;
  function musicConfigured(){
    return !!find(/^(?:Bỏ chọn Nhạc|Deselect Music|Remove Music|Unselect Music)$/i)&&
      !!controls().find(e=>/^(?:Thời lượng|Duration)/i.test(label(e))&&/(?:Ngắn|Short|30\s*(?:s|sec|giây))/i.test(label(e)+caption(e)))&&
      !!controls().find(e=>/^(?:Có giọng hát|Vocals|Vocal)/i.test(label(e))&&/(?:Không lời|Instrumental)/i.test(label(e)+caption(e)));
  }
  function musicKey(response){
    const id=response.id||response.querySelector('[id^="model-response-message-content"]')?.id;
    return id||'music-response-'+[...document.querySelectorAll('model-response')].indexOf(response);
  }
  function lyriaResponse(message){
    if(message.result?.jobId&&message.result.jobId!==message.jobId)return;
    const response=geminiResponse(message);if(!response)return;
    const key=musicKey(response);
    if((message.baseline||[]).includes(key)||message.result?.responseKey&&message.result.responseKey!==key)return;
    return response;
  }

  async function searchStudioVoice(field){
    if(!globalThis.storyForgePaste)throw new Error('Reload Browser Bridge để áp dụng cách nhập bằng Paste.');
    await globalThis.storyForgePaste.into(field,'Enzo',{validate:()=>{
      checkpoint();
      if(!visible(field)||field.disabled||field.readOnly)throw Object.assign(new Error('Đang chờ ô tìm giọng đọc'),{code:'INPUT_NOT_READY'});
    }});
  }
  async function setupStudio(message){
    // A newly opened AI Studio tab can show its own welcome notice while the
    // playground is inert. Its Continue button is named "Close dialog" in AX.
    // Scope this action to that exact notice, never another provider dialog.
    const welcome=document.getElementById('g1-welcome-dialog');
    if(visible(welcome)&&/Welcome to AI Studio/.test(welcome.textContent||'')){
      const proceed=find(/^(?:Continue|Tiếp tục|Close dialog)$/i,welcome);
      if(proceed)return clickOne(proceed,'Đang tiếp tục qua màn hình giới thiệu AI Studio…');
      throw Object.assign(new Error('Đang chờ nút tiếp tục của màn hình giới thiệu AI Studio'),{code:'INPUT_NOT_READY'});
    }
    const create=find(/^Create new dialog$|^Tạo hộp thoại mới$/);
    if(create)return clickOne(create,'Đang tạo hộp thoại AI Studio…');
    // AI Studio keeps its voice picker open after a selection. The speech
    // badge behind it is inert, so verify the selected voice inside the picker
    // and close that picker before reading the badge again.
    const drawer=[...document.querySelectorAll('[role="dialog"],[id^="mat-mdc-dialog-"],aside,ms-speaker-settings')].find(e=>
      visible(e)&&(e.querySelector('[data-voice-name]')||e.matches('[role="dialog"],[id^="mat-mdc-dialog-"]'))&&/Speaker settings|Cài đặt người nói/.test(e.innerText||e.textContent||''));
    if(drawer){
      const selected=drawer.querySelector('[data-voice-name="Enzo"].selected')||find(/^Enzo\s*\(Current\)$/i,drawer)||
        find(/^Speaker 1\s*[-–]\s*Enzo$/);
      if(selected){
        const close=find(/^Close(?: panel)?$|^close$|^Đóng$|Close speaker settings/,drawer);
        if(close)return clickOne(close,'Đang đóng bảng giọng đọc Enzo…');
        throw new Error('Đã chọn Enzo nhưng chưa thấy nút đóng bảng giọng đọc.');
      }
      const card=drawer.querySelector('[data-voice-name="Enzo"]');
      const option=card?.querySelector('button.voice-card-content')||find(/^Enzo$/,drawer);
      if(option)return clickOne(option,'Đã chọn Enzo, đang xác minh…');
      const search=[...drawer.querySelectorAll('input')].find(e=>visible(e)&&/search.*voices|tìm.*giọng/i.test(e.placeholder||''));
      if(search&&search.value!=='Enzo'){await searchStudioVoice(search);return {ready:false,message:'Đang tìm giọng Enzo…'}}
      throw Object.assign(new Error('Đang chờ danh sách giọng Enzo'),{code:'INPUT_NOT_READY'});
    }
    // Voice selection makes the rest of AI Studio inert. Finish/close that
    // picker before verifying the model; hidden background controls are not
    // evidence that the selected TTS model disappeared.
    const model=message.media?.tts?.model;
    if(model){
      const settings=[...document.querySelectorAll('aside,ms-run-settings,ms-run-settings-panel,h1,h2,h3,[data-model-id]'),
        ...controls().filter(e=>e.matches('button')&&!e.closest('nav,[role="dialog"],[role="menu"],[role="listbox"],.cdk-overlay-pane')&&
          (label(e).startsWith(model)||caption(e).startsWith(model)))]
        .filter(e=>visible(e)&&!e.closest('textarea,[contenteditable="true"],model-response,user-query'));
      if(!settings.some(e=>norm(e.textContent).includes(model)||e.getAttribute('data-model-id')==='gemini-3.8-flash-tts')){
        const option=find(new RegExp('^'+model.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
        const trigger=option||find(/Gemini.*(?:TTS|Speech)|^(?:Model|Mô hình)$/i)||find(/^Toggle run settings panel$/i);
        if(trigger&&(owned.modelAttempts||0)<3){owned.modelAttempts=(owned.modelAttempts||0)+1;return clickOne(trigger,'Đang xác minh model '+model+'…')}
        throw new Error('Chưa xác minh được model '+model+' trên AI Studio. Kiểm tra model rồi tạo lại đoạn còn thiếu.');
      }
    }
    const speaker=find(/^Speaker 1\s*[-–]\s*/);
    // Voice selection is not complete until the speech-block badge says Enzo.
    if(!speaker||!/^Speaker 1\s*[-–]\s*Enzo$/.test(label(speaker))){
      const enzo=exact('Enzo',settingsPanel());
      if(enzo){enzo.click();return {ready:false,message:'Đã chọn Enzo, đang xác minh…'}}
      const search=[...document.querySelectorAll('input')].find(e=>visible(e)&&/search.*voices|tìm.*giọng/i.test(e.placeholder||''));
      if(search&&search.value!=='Enzo'){await searchStudioVoice(search);return {ready:false,message:'Đang tìm giọng Enzo…'}}
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
  async function setEditor(field,prompt,provider){
    if(!globalThis.storyForgePaste)throw new Error('Reload Browser Bridge để áp dụng cách nhập bằng Paste.');
    await globalThis.storyForgePaste.into(field,prompt,{validate:()=>{
      checkpoint();
      if(busy(provider))throw Object.assign(new Error('Dịch vụ vẫn đang tạo media; chưa Paste scene tiếp theo.'),{code:'INPUT_NOT_READY'});
      if(editor()!==field)throw Object.assign(new Error('Ô nhập media vừa tải lại; chưa Paste.'),{code:'EDITOR_CHANGED'});
    }});
  }
  const mediaSelector={aistudio:'audio',gemini:'model-response img,model-response image-preview img,[data-test-id="generated-image"] img',flow:'video,img[alt]'};
  function mediaItems(provider){return [...document.querySelectorAll(mediaSelector[provider])].filter(e=>
    provider==='gemini'?visible(e)&&e.naturalWidth>=300:
      provider==='flow'&&e.tagName==='IMG'?visible(e)&&/Hình thu nhỏ của video đã tạo|generated video thumbnail/i.test(e.alt):!!(e.currentSrc||e.src||e.querySelector('source')?.src))}
  const source=e=>e?.currentSrc||e?.src||e?.querySelector('source')?.src||'';
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
  function snapshot(provider){
    if(provider==='lyria')return [...document.querySelectorAll('model-response')].map(musicKey);
    return mediaItems(provider).map(e=>provider==='aistudio'?sourceKey(e):source(e));
  }
  function geminiResponse(message){
    const turns=[...document.querySelectorAll('user-query,model-response,[data-test-id="user-query"]')];
    const queries=turns.filter(e=>e.matches('user-query,[data-test-id="user-query"]'));
    if(!queries.length)return null;
    const query=queries.filter(e=>norm(e.innerText||e.textContent).includes(norm(message.prompt))).at(-1);
    if(!query)return null;
    const following=turns.slice(turns.indexOf(query)+1);
    const nextQuery=following.findIndex(e=>e.matches('user-query,[data-test-id="user-query"]'));
    return (nextQuery<0?following:following.slice(0,nextQuery)).find(e=>e.matches('model-response'))||null;
  }
  function composer(field=editor()){
    // Never inspect history attachments when locating the current upload UI.
    const form=field.closest('form');if(form)return form;
    let candidate=field.parentElement,result=field;
    while(candidate&&candidate!==document.body){
      if(candidate.querySelector('model-response,user-query,video,img[alt*="generated video thumbnail"],img[alt*="Hình thu nhỏ của video đã tạo"]'))break;
      result=candidate;
      candidate=candidate.parentElement;
    }
    return result;
  }
  const previews=root=>[...root.querySelectorAll('img')].filter(e=>visible(e)&&
    !e.closest('model-response,user-query,nav,aside')&&!/icon|logo|avatar|generated video thumbnail|Hình thu nhỏ của video đã tạo/i.test(e.alt||e.className||''));
  function selectFlowReference(message){
    const upload=owned.referenceUpload;
    if(!upload||upload.verified||(upload.jobId!==message.jobId&&!message.recovery))return;
    const names=upload.signature.split('|').slice(0,upload.loaded),selected=upload.flowSelections||=[];
    const picker=[...document.querySelectorAll('[role="dialog"]')].find(e=>{
      const title=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||e.querySelector('h1,h2,[role="heading"]')?.textContent||'';
      return visible(e)&&/^(?:Thêm thành phần vào dự án|Add ingredients to (?:the )?project)$/i.test(norm(title));
    });
    if(!picker){
      if(selected.length&&selected.length<names.length){
        const add=find(/^Thêm thành phần vào ô nhập câu lệnh$|^Add ingredients to (?:the )?prompt$/i,composer());
        if(add)return clickOne(add,'Đang chọn ảnh nhân vật tham chiếu tiếp theo trong Flow…');
      }
      return;
    }
    for(const name of names){
      if(selected.includes(name))continue;
      const labels=[name,name+' Hình ảnh',name+'Hình ảnh',name+' Image',name+'Image',name+' image',name+'image'];
      const choices=[...picker.querySelectorAll('[role="option"]')].filter(enabled).filter(e=>
        labels.includes(label(e))||labels.includes(caption(e))||labels.includes(norm(e.innerText)));
      const fresh=choices.filter(e=>!upload.libraryBefore?.includes(e)&&
        !(upload.libraryBeforeUrls||[]).includes(source(e.querySelector('img'))));
      const candidates=upload.libraryBefore?fresh:choices;
      if(candidates.length>1)throw new Error('Có nhiều ảnh tham chiếu trùng tên trong Flow. Kiểm tra ảnh trước khi tiếp tục.');
      if(candidates.length===1){selected.push(name);return clickOne(candidates[0],'Đang chọn ảnh nhân vật vừa tải vào scene Flow…')}
    }
    if(names.every(name=>selected.includes(name))){
      const close=find(/^(?:Đóng|Close)$/i,picker);
      if(close)return clickOne(close,'Đang đóng thư viện ảnh tham chiếu Flow…');
    }
    return {ready:false,message:'Đang chờ ảnh nhân vật vừa tải xuất hiện trong thư viện Flow…'};
  }
  function referenceInput(root){
    const inputs=[...document.querySelectorAll('input[type="file"]')].filter(e=>
      !e.disabled&&!e.closest('model-response,user-query,nav,aside')&&(!e.accept||/image|\.png|\.jpe?g/i.test(e.accept)));
    const local=inputs.filter(e=>root.contains(e)),choices=local.length?local:inputs;
    if(!choices.length){
      const dialog=[...document.querySelectorAll('[role="dialog"],[role="menu"]')].find(visible);
      const uploadButton=dialog&&find(/Upload (?:files?|images?|media)|Tải (?:tệp|ảnh|nội dung nghe nhìn) lên|^Upload$|^Tải lên$/i,dialog);
      const add=uploadButton||find(/^(?:add|plus|\+)$|Add (?:files|images|ingredients)|Thêm (?:tệp|ảnh|thành phần)|Upload files|Uploads (?:and|&) tools|Nội dung tải lên và công cụ/i,root);
      if(add)return clickOne(add,'Đang mở phần tải ảnh nhân vật tham chiếu…');
      throw new Error('Chưa thấy ô tải ảnh tham chiếu. Kiểm tra nút Thêm / Tải lên của dịch vụ.');
    }
    if(choices.length!==1)throw new Error('Có nhiều ô tải tệp; chưa xác định được ô ảnh tham chiếu của scene.');
    return {input:choices[0]};
  }
  function attachReferences(input,files){
    const transfer=new DataTransfer();
    for(const file of files){
      const data=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
      transfer.items.add(new File([data],file.name,{type:file.mime}));
    }
    input.files=transfer.files;
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function referenceUploads(message,field){
    const files=message.references||[],root=composer(field),signature=files.map(f=>f.name).join('|');
    let upload=owned.referenceUpload;
    const present=previews(root);
    if(upload?.verified&&upload.jobId!==message.jobId&&!present.length){delete owned.referenceUpload;upload=undefined}
    if(upload&&upload.signature!==signature&&present.length){
      // Only remove attachment previews installed by this adapter. Never clear
      // a user's upload or a historical image to make room for our references.
      for(const image of present){
        if(!upload.nodes?.includes(image)&&!upload.urls?.includes(source(image)))
          throw new Error('Ô nhập có ảnh tham chiếu bạn đã thêm. Kiểm tra ảnh trước khi tiếp tục Bridge.');
        let parent=image.parentElement,remove;
        while(parent&&root.contains(parent)){
          remove=find(/^(?:Remove|Delete|Close|Clear|Xóa|Đóng|close)(?:\s|$)|Remove (?:file|image)|Xóa (?:tệp|ảnh)/i,parent);
          if(remove||parent===root)break;parent=parent.parentElement;
        }
        if(!remove)throw new Error('Không gỡ được ảnh tham chiếu cũ trong ô nhập. Hãy gỡ ảnh rồi tiếp tục.');
        remove.click();return {ready:false,message:'Đang thay ảnh nhân vật tham chiếu…'};
      }
    }
    if(!files.length){delete owned.referenceUpload;owned.referencesReady=message.jobId;return {ready:true}}
    if(files.length>3||files.some(f=>!/^sf_ref_[a-f0-9]{16}\.jpg$/.test(f.name)||f.mime!=='image/jpeg'||!f.data))
      throw new Error('Ảnh tham chiếu không hợp lệ');
    if(upload?.signature===signature){
      const loaded=upload.loaded||files.length;
      const added=present.filter(e=>!upload.before?.includes(e));
      const names=files.slice(0,loaded).every(f=>norm(root.textContent).includes(f.name)||root.querySelector('[data-file-name="'+f.name+'"]'));
      const progressing=[...root.querySelectorAll('[role="progressbar"],[aria-busy="true"]')].some(visible);
      if(present.length>loaded)throw new Error('Ô nhập có thêm ảnh ngoài các ảnh tham chiếu đã chọn. Kiểm tra ảnh trước khi tiếp tục.');
      const proof=names||added.length>=loaded||upload.verified&&present.length>=loaded;
      if(!proof||progressing)return {ready:false,message:'Đang chờ tải đủ ảnh nhân vật tham chiếu…'};
      const urls=present.map(source).join('|');
      if(upload.previewSignature!==urls){upload.previewSignature=urls;upload.stableAt=Date.now();return {ready:false}}
      if(Date.now()-upload.stableAt<2000)return {ready:false,message:'Đang chờ ảnh tham chiếu sẵn sàng…'};
      if(loaded<files.length){
        const selected=referenceInput(root);if(!selected.input)return selected;
        const next=files.slice(loaded,selected.input.multiple?files.length:loaded+1);
        upload.loaded=loaded+next.length;delete upload.previewSignature;
        attachReferences(selected.input,next);return {ready:false,message:'Đang tải ảnh nhân vật tham chiếu tiếp theo…'};
      }
      upload.verified=true;upload.names=files.map(f=>f.name);upload.nodes=present;upload.urls=present.map(source);upload.jobId=message.jobId;owned.referencesReady=message.jobId;
      return {ready:true};
    }
    if(present.length)throw new Error('Ô nhập có ảnh bạn đã thêm. Bridge không thay ảnh đó.');
    const selected=referenceInput(root);if(!selected.input)return selected;
    const first=selected.input.multiple?files:files.slice(0,1);
    const libraryBefore=message.provider==='flow'?[...document.querySelectorAll('[role="dialog"] [role="option"]')]:undefined;
    owned.referenceUpload={jobId:message.jobId,signature,before:present,loaded:first.length,stableAt:Date.now(),libraryBefore,
      libraryBeforeUrls:libraryBefore?.map(e=>source(e.querySelector('img'))).filter(Boolean)};
    attachReferences(selected.input,first);
    return {ready:false,message:'Đang tải ảnh nhân vật tham chiếu vào '+(message.provider==='flow'?'Flow':'Gemini')+'…'};
  }
  function referencesIntact(message){
    if(owned.referencesReady!==message.jobId)return false;
    const root=composer(),present=previews(root),upload=owned.referenceUpload;
    if(!upload)return present.length===0;
    const labels=upload.nodes?.length||upload.names?.every(name=>norm(root.textContent).includes(name)||root.querySelector('[data-file-name="'+name+'"]'));
    return upload.verified&&labels&&present.length===upload.nodes.length&&present.every(e=>upload.nodes.includes(e)||upload.urls.includes(source(e)))&&
      ![...root.querySelectorAll('[role="progressbar"],[aria-busy="true"]')].some(visible);
  }
  function resultNode(message){
    let items=mediaItems(message.provider);
    if(message.provider==='gemini'){
      if(message.result?.jobId&&message.result.jobId!==message.jobId)return;
      const response=geminiResponse(message);if(!response)return;
      items=items.filter(e=>response.contains(e));
    }
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
  const flowDone=/^(?:Xong|Done|Đã chỉnh sửa xong|Done editing|Finished editing)$/i;
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
      if(busy('flow')&&!find(flowDone))return reply();
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
    // A previous adapter can have opened our download menu inside the editor.
    // Dismiss only that owned menu so its inert background exposes Done again.
    if(collection.openedAt&&collection.menuOpened&&location.pathname.startsWith(page+'/edit/')&&flowMenus().length){
      if(!collection.menuDismissedAt){
        collection.menuDismissedAt=Date.now();owned.flowCollection=collection;
        const backdrop=[...document.querySelectorAll('.cdk-overlay-backdrop')].find(visible);
        if(backdrop)backdrop.click();
        else flowMenus()[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
        return reply({ready:false,message:'Đang đóng tùy chọn trong màn hình chỉnh sửa video Flow…'});
      }
      return reply({ready:false,message:'Đang chờ Flow đóng tùy chọn chỉnh sửa…'});
    }
    if(collection.menuDismissedAt){delete collection.menuDismissedAt;collection.menuOpened=false}
    const done=find(flowDone);
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
    // Flow's compact grid exposes clip actions through a context menu rather
    // than a visible More button. Open it once on this exact selected result.
    if(flowThumbnail(node)&&collection.openedAt&&!menus.length&&!collection.contextMenuAt){
      collection.contextMenuAt=Date.now();collection.menuOpened=true;owned.flowCollection=collection;
      const rect=node.getBoundingClientRect();
      node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,
        clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,button:2,buttons:2}));
      return reply({ready:false,message:'Đang mở menu tải của đúng video Flow vừa tạo…'});
    }
    return reply({ready:false,message:'Đang chờ nút tải của video Flow vừa tạo…'});
  }
  function flowResponse(result){const {button,node,...response}=result;return response}
  globalThis.storyForgeMediaExecute=async message=>{
    checkpoint();
    const {provider,action}=message;
    const allowed={aistudio:['aistudio.google.com'],gemini:['gemini.google.com'],lyria:['gemini.google.com'],flow:['flow.google.com','labs.google']}[provider];
    if(!allowed?.includes(location.hostname))throw new Error('Không đúng dịch vụ tạo media');
    if(document.readyState!=='complete')return {ready:false,message:'Đang chờ trang tải xong…'};
    if(action==='media-setup'){
      if(owned.setupJobId!==message.jobId){
        owned.setupJobId=message.jobId;
        delete owned.flowConfigured;delete owned.flowVerified;delete owned.flowChoices;
        delete owned.recoverySignature;delete owned.modelAttempts;delete owned.referencesReady;
      }
      if(busy(provider)){delete owned.recoverySignature;return {ready:false,message:'Dịch vụ đang tạo nội dung trước, đang chờ hoàn tất…'}}
      if(message.recovery){
        const signature=JSON.stringify(snapshot(provider));
        if(signature!==owned.recoverySignature){owned.recoverySignature=signature;owned.recoveryAt=Date.now();return {ready:false}}
        if(Date.now()-owned.recoveryAt<5000)return {ready:false,message:'Đang chờ kết quả cũ ổn định trước scene tiếp theo…'};
      }
      if(provider==='aistudio'){const setup=await setupStudio(message);if(!setup.ready)return setup}
      if(provider==='lyria'){const setup=setupLyria();if(!setup.ready)return setup}
      if(provider==='flow'){
        const reference=selectFlowReference(message);if(reference)return reference;
        if(!owned.flowConfigured){const setup=flowSetup();if(!setup.ready)return setup}
      }
      const field=editor();
      if(field!==stableEditor){stableEditor=field;stableAt=Date.now();return {ready:false}}
      return {ready:Date.now()-stableAt>=2000};
    }
    if(action==='media-prepare'){
      if(busy(provider))throw Object.assign(new Error('Dịch vụ vẫn đang tạo media'),{code:'INPUT_NOT_READY'});
      const field=editor(),existing=text(field);
      if(existing&&existing!==norm(message.prompt)&&existing!==owned.lastPrompt&&existing!==norm(message.previousPrompt))
        throw new Error('Ô nhập có nội dung bạn đang soạn. Bridge không xóa nội dung đó.');
      if(provider==='gemini'||provider==='flow'){
        const upload=referenceUploads(message,field);if(!upload.ready)return upload;
      }
      const baseline=snapshot(provider);
      owned.baselineNodes=provider==='lyria'?[]:mediaItems(provider);
      await setEditor(field,message.prompt,provider);
      if(text(field)!==norm(message.prompt))throw Object.assign(new Error('Ô nhập chưa nhận đủ nội dung'),{code:'INPUT_NOT_READY'});
      owned.lastPrompt=norm(message.prompt);
      return {baseline};
    }
    if(action==='media-ready')return {ready:!busy(provider)&&text(editor())===norm(message.prompt)&&!!run(provider)&&
      (provider!=='lyria'||musicConfigured())&&
      (!(provider==='gemini'||provider==='flow')||referencesIntact(message))};
    if(action==='media-send'){
      if(owned.sent?.includes(message.jobId))return {submitted:true};
      if(busy(provider)||text(editor())!==norm(message.prompt))throw new Error('Ô nhập đã thay đổi trước khi tạo media');
      if(provider==='lyria'&&!musicConfigured())throw new Error('Chế độ Lyria, thời lượng ngắn hoặc nhạc không lời đã thay đổi trước khi gửi');
      if((provider==='gemini'||provider==='flow')&&!referencesIntact(message))throw new Error('Chưa xác minh đủ ảnh tham chiếu cho scene này');
      const button=run(provider);
      if(!button)throw new Error('Chưa có nút Run / Tạo khả dụng');
      owned.sent=[...(owned.sent||[]),message.jobId];button.click();return {submitted:true};
    }
    if(action==='media-poll'){
      if(provider==='flow')return flowResponse(flowResult(message));
      if(busy(provider))return {ready:false};
      if(provider==='lyria'){
        const response=lyriaResponse(message),button=response&&find(musicDownload,response);
        if(!button)return {ready:false,message:'Đang chờ bản nhạc Lyria và nút tải âm thanh…'};
        const key=musicKey(response);
        if(owned.resultSignature!==key){owned.resultSignature=key;owned.resultAt=Date.now();return {ready:false}}
        return {ready:Date.now()-owned.resultAt>=4000,result:{jobId:message.jobId,responseKey:key}};
      }
      const response=provider==='gemini'?geminiResponse(message):document;
      if(!response)return {ready:false,message:'Đang chờ câu trả lời thuộc đúng prompt scene này…'};
      const items=mediaItems(provider).filter(e=>response.contains(e)&&!(message.baseline||[]).includes(provider==='aistudio'?sourceKey(e):source(e))&&
        !(provider==='aistudio'&&(message.baseline||[]).includes(source(e)))&&
        !(provider==='flow'&&e.tagName==='IMG'&&owned.baselineNodes?.includes(e)));
      if(provider==='gemini'&&new Set(items.map(source)).size>1)throw new Error('Có nhiều ảnh mới trong câu trả lời scene này. Chọn kết quả thủ công trong Tài Nguyên.');
      const node=items.find(e=>e.tagName==='VIDEO')||items.at(-1);
      if(!node)return {ready:false};
      const button=downloadButton(node,provider);
      if(!button)return {ready:false,message:'Media đã xuất hiện, đang chờ nút tải khả dụng…'};
      const url=source(node);
      const expectedDuration=provider==='aistudio'?studioDuration(node,button):undefined;
      const signature=(provider==='aistudio'?message.jobId:url)+'|'+(expectedDuration??'');
      if(owned.resultSignature!==signature){owned.resultSignature=signature;owned.resultAt=Date.now();return {ready:false}}
      return {ready:Date.now()-owned.resultAt>=4000,result:{jobId:message.jobId,...(provider==='aistudio'?{}:{url}),...(expectedDuration>0?{expectedDuration}:{})}};
    }
    if(action==='media-download-info'){
      if(provider==='lyria'){
        const response=lyriaResponse(message);
        if(!response||!find(musicDownload,response))throw new Error('Không thấy nút tải đúng bản nhạc Lyria đã tạo');
        return {direct:false,referrer:location.href};
      }
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
      if(provider==='lyria'){
        const response=lyriaResponse(message),button=response&&find(musicDownload,response);
        if(!button)throw new Error('Bản nhạc Lyria đã thay đổi; không tải kết quả khác');
        owned.musicDownload={jobId:message.jobId,responseKey:musicKey(response)};
        button.click();return {clicked:true};
      }
      const flow=provider==='flow'?flowResult(message):undefined;
      if(flow&&!flow.ready)return flowResponse(flow);
      const node=flow?.node||resultNode(message),button=flow?.button||(node&&downloadButton(node,provider));
      if(!button)throw new Error('Nút tải đã thay đổi. Kiểm tra tab rồi tiếp tục.');
      button.click();return {clicked:true};
    }
    if(action==='media-download-continue'){
      if(provider==='lyria'){
        // The same Download button offers a cover video and an MP3. Choose
        // only its audio menu, never the cover image/video or another response.
        if(!owned.musicDownload){
          const response=lyriaResponse(message);
          if(!response||musicKey(response)!==message.result?.responseKey)return {clicked:false};
          owned.musicDownload={jobId:message.jobId,responseKey:musicKey(response)};
        }
        if(owned.musicDownload.jobId!==message.jobId||owned.musicDownload.responseKey!==message.result?.responseKey)return {clicked:false};
        const menus=[...document.querySelectorAll('[role="menu"]')].filter(visible);
        if(menus.length!==1)return {clicked:false};
        const audio=find(/^(?:Chỉ riêng âm thanh|Audio only|Audio)(?:\s|$)/i,menus[0]);
        if(!audio||!/MP3/i.test(label(audio)+caption(audio)))return {clicked:false};
        if(owned.musicDownload.clicked)return {clicked:false};
        owned.musicDownload.clicked=true;audio.click();return {clicked:true};
      }
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
