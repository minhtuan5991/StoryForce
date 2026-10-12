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
  const controls=()=>[...document.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],a,[role="tab"],[role="radio"]')].filter(visible);
  const enabled=e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
  function find(pattern,root=document){return [...root.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],a,[role="tab"],[role="radio"]')].filter(enabled).find(e=>pattern.test(label(e)))}
  function exact(text,root=document){
    const texts=Array.isArray(text)?text:[text];
    const control=controls().find(e=>root.contains(e)&&(texts.includes(label(e))||texts.includes(caption(e))));
    if(control)return control;
    // Some voice/style cards use nested text spans instead of button roles.
    const candidates=[...root.querySelectorAll('span,div,p')].filter(e=>visible(e)&&texts.includes(norm(e.textContent)));
    return candidates.find(e=>!candidates.some(child=>child!==e&&e.contains(child)));
  }
  function editor(behindPicker=false){
    const fields=[...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e=>(visible(e)||behindPicker&&e.closest('[inert],[aria-hidden="true"]'))&&!e.disabled&&!e.readOnly&&
      e.getAttribute('aria-disabled')!=='true'&&e.getAttribute('aria-readonly')!=='true'&&
      !e.closest('.ql-clipboard,nav,aside,[role="search"]')&&!/search|tìm kiếm/i.test(e.getAttribute('placeholder')||e.getAttribute('aria-label')||''));
    const top=fields.filter(e=>!fields.some(parent=>parent!==e&&parent.contains(e)));
    if(top.length!==1)throw Object.assign(new Error('Chưa có một ô nhập media duy nhất khả dụng'),{code:'INPUT_NOT_READY'});
    return top[0];
  }
  const text=e=>norm(e.value??e.innerText??e.textContent);
  function busy(provider){
    const selectors=globalThis.STORYFORGE_ADAPTERS?.[provider==='lyria'?'aistudio':provider]?.busy||[];
    return selectors.some(selector=>[...document.querySelectorAll(selector)].some(visible))||
      controls().some(e=>/^(Stop|Dừng)( generating| generation| response| tạo| phản hồi)?$|Stop generating|Dừng tạo|Hủy tạo|Ngừng (?:tạo|phản hồi)/i.test(label(e)))||
      (provider==='flow'&&[...document.querySelectorAll('[role="progressbar"]')].some(e=>visible(e)&&!e.closest('[role="dialog"]')));
  }
  function run(provider){
    const patterns={aistudio:/^Run(?:\s|$)|^Chạy(?:\s|$)/,gemini:/Send message|Send prompt|Gửi tin nhắn|^Send$|^Gửi$|^send$/,
      flow:/^arrow_forward$|^send$|^Create$|^Generate$|^Tạo$|^Gửi$|^Bắt đầu tạo$|Send prompt|Generate video|Tạo video/,
      lyria:/^(?:Generate(?: music)?|Tạo(?: nhạc)?)$/i};
    return find(patterns[provider]);
  }
  function checkpoint(){
    if([...document.querySelectorAll('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],#challenge-stage')].some(visible))throw new Error('Hãy tự hoàn tất CAPTCHA rồi tiếp tục Bridge.');
  }
  function settingsPanel(){return [...document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"]')].find(visible)||document}
  function clickOne(e,message){if(!enabled(e))throw new Error(message);e.click();return {ready:false,message}}
  const owned=globalThis.storyForgeMediaOwned||={};
  if(!globalThis.storyForgeStudioStyleWatch){
    globalThis.storyForgeStudioStyleWatch=true;
    document.addEventListener('input',event=>{
      const field=event.target;
      if(event.isTrusted&&owned.studioVerified&&field?.matches?.('textarea,input,[contenteditable="true"]')&&
          /describe.*(?:voice|style)/i.test([field.getAttribute('placeholder'),field.getAttribute('aria-label')].join(' '))){
        delete owned.studioVerified;delete owned.studioStyle;
      }
    },true);
  }
  let stableEditor,stableText,stableAt=0;
  const resetEditorStability=()=>{stableEditor=undefined;stableText=undefined;stableAt=0};

  const musicModel=/^(?:Lyria\s+3\s+Pro\s+Preview|lyria-3-pro-preview)(?:\s|$)/i;
  const musicDownload=/^(?:Download(?: (?:audio|music|song|track))?|Tải(?: (?:âm thanh|nhạc|bản nhạc))?(?: xuống| về)?|download|file_download)(?:\s*\((?:MP3|WAV)\))?$/i;
  function musicModelSelected(){
    // The run-settings card can be collapsed at narrow widths. Only its
    // current model label counts; prompt text or a model-picker option cannot.
    return [...document.querySelectorAll('h1,h2,h3,h4,span,p,button,[role="heading"],[data-model-id]')].some(e=>
      visible(e)&&!e.closest('textarea,[contenteditable],nav,[role="menu"],[role="listbox"],[role="dialog"]')&&
      (e.getAttribute('data-model-id')==='lyria-3-pro-preview'||musicModel.test(caption(e))||musicModel.test(label(e))));
  }
  function musicPlayers(){
    // AI Studio's generated result is the explicitly named Music player.
    // Preset cards with Toggle audio playback are not generated outputs.
    const players=[...document.querySelectorAll('[role="group"][aria-label],[aria-label="Music player"],[aria-label="Trình phát nhạc"]')]
      .filter(e=>visible(e)&&/^(?:Music player|Trình phát nhạc)$/i.test(e.getAttribute('aria-label')||''));
    return players.filter(e=>!players.some(child=>child!==e&&e.contains(child)));
  }
  function musicDuration(player){
    const times=[...player.querySelectorAll('span,div,time,p')].filter(e=>visible(e)&&!e.children.length)
      .map(e=>norm(e.textContent)).filter(s=>/^(?:\d+:)?\d{1,3}:\d{2}$/.test(s))
      .map(s=>s.split(':').reduce((seconds,part)=>seconds*60+Number(part),0));
    if(times.length)return Math.max(...times);
    const duration=player.querySelector('audio')?.duration;
    return Number.isFinite(duration)&&duration>=15?duration:undefined;
  }
  const musicTextMode=()=>find(/^(?:Text|Văn bản)$/i);
  const selectedMode=e=>!e||e.getAttribute('aria-checked')==='true'||e.getAttribute('aria-selected')==='true'||
    e.getAttribute('aria-pressed')==='true'||e.checked||/(?:^|\s)(?:selected|active|mat-button-toggle-checked)(?:\s|$)/.test(e.className||'');
  function setupLyria(message){
    const welcome=document.getElementById('g1-welcome-dialog');
    if(visible(welcome)&&/Welcome to AI Studio/.test(welcome.textContent||'')){
      const proceed=find(/^(?:Continue|Tiếp tục|Close dialog)$/i,welcome);
      if(proceed)return clickOne(proceed,'Đang tiếp tục vào AI Studio Music…');
      throw Object.assign(new Error('Đang chờ màn hình giới thiệu AI Studio'),{code:'INPUT_NOT_READY'});
    }
    const start=find(/^Describe the music you want to generate with Lyria\s+3\s+Pro\s+Preview\b/i);
    if(start)return clickOne(start,'Đang mở ô Describe your music trong AI Studio Lyria…');
    const mode=musicTextMode();
    if(mode&&!selectedMode(mode))return clickOne(mode,'Đang chọn ô nhập Text cho Lyria…');
    if(!musicModelSelected()){
      const panel=find(/^Toggle run settings panel$/i);
      if(panel&&!owned.lyriaSettingsOpened){owned.lyriaSettingsOpened=true;return clickOne(panel,'Đang xác minh Lyria 3 Pro Preview trong Run settings…')}
      throw Object.assign(new Error('Chưa xác minh được Lyria 3 Pro Preview trong AI Studio Music; chưa gửi prompt.'),{code:'INPUT_NOT_READY'});
    }
    if(!musicConfigured(message))throw Object.assign(new Error('Đang chờ ô Describe your music của Lyria sẵn sàng'),{code:'INPUT_NOT_READY'});
    if(musicPlayers().length){
      // The Music playground keeps its last player below the editor. Clear
      // only a prior prompt owned by this queue, before taking a new baseline.
      // This prevents old playback packets from looking like a new result.
      const existing=text(editor());
      if(existing&&existing!==owned.lastPrompt&&existing!==norm(message.previousPrompt)&&existing!==norm(message.prompt))
        throw new Error('AI Studio có bản nhạc hoặc prompt bạn đang soạn. Bridge không thay nội dung đó.');
      if(owned.lyriaResetFor!==message.jobId){
        const reset=find(/^(?:New session|Phiên mới)$/i);
        if(reset){owned.lyriaResetFor=message.jobId;return clickOne(reset,'Đang mở phiên nhạc mới, giữ bản đã tải trong thư viện…')}
      }
      return {ready:false,message:'Đang chờ phiên nhạc mới bỏ player của lượt trước…'};
    }
    return {ready:true};
  }
  function musicConfigured(message){
    if(location.hostname!=='aistudio.google.com'||!musicModelSelected()||!selectedMode(musicTextMode()))return false;
    if(message.media?.lyria?.model&&!['Pro','lyria-3-pro-preview'].includes(message.media.lyria.model))return false;
    try{
      const field=editor(),description=norm(field.getAttribute('placeholder')||field.getAttribute('data-placeholder')||field.getAttribute('aria-description'));
      return /Describe your music|Mô tả.*nhạc/i.test(description)||/^Prompt input$/i.test(field.getAttribute('aria-label')||'');
    }catch{return false}
  }
  function musicKey(response){
    // Packet/blob URLs change during playback. The unchanged authorized
    // prompt and this player's total duration identify the completed output.
    return 'lyria-studio:'+musicDuration(response)+':'+(response.id||musicPlayers().indexOf(response));
  }
  function lyriaResponse(message){
    if(message.result?.jobId&&message.result.jobId!==message.jobId)return;
    if(!musicConfigured(message)||text(editor())!==norm(message.prompt))return;
    const players=musicPlayers().filter(e=>!(message.baseline||[]).includes(musicKey(e)));
    if(players.length>1)throw new Error('Có nhiều bản nhạc mới; Bridge không chọn kết quả không rõ nguồn.');
    const response=players[0];if(!response||response.getAttribute('aria-busy')==='true'||!musicDuration(response))return;
    if(message.result?.responseKey&&message.result.responseKey!==musicKey(response))return;
    return response;
  }

  async function searchStudioVoice(field,voice){
    if(!globalThis.storyForgePaste)throw new Error('Reload Browser Bridge để áp dụng cách nhập bằng Paste.');
    await globalThis.storyForgePaste.into(field,voice,{validate:()=>{
      checkpoint();
      if(!visible(field)||field.disabled||field.readOnly)throw Object.assign(new Error('Đang chờ ô tìm giọng đọc'),{code:'INPUT_NOT_READY'});
    }});
  }
  function studioProfileSignature(message){
    return JSON.stringify([message.jobId,String(message.media?.voice??message.media?.tts?.voice??'Enzo').trim(),String(message.media?.style??message.media?.tts?.style??'Friendly').trim()]);
  }
  function ttsConfigError(message){return Object.assign(new Error(message),{code:'TTS_CONFIG'})}
  function studioReady(message,speaker,styleBadge){
    owned.studioVerified={signature:studioProfileSignature(message),speaker:label(speaker),style:caption(styleBadge)};
    return {ready:true};
  }
  function studioConfigured(message){
    const saved=owned.studioVerified;
    if(!saved||saved.signature!==studioProfileSignature(message))return false;
    const speaker=controls().find(e=>label(e)===saved.speaker);
    const style=controls().find(e=>/^(Style|Phong cách)$/.test(label(e))&&caption(e)===saved.style)||
      controls().find(e=>caption(e)===saved.style&&!e.closest('[role="menu"],[role="listbox"],.cdk-overlay-pane'));
    const openStyle=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].some(e=>visible(e)&&/describe.*(?:voice|style)/i.test([e.getAttribute('placeholder'),e.getAttribute('aria-label')].join(' ')));
    return !!speaker&&!!style&&!openStyle;
  }
  async function setupStudio(message){
    const voice=String(message.media?.voice??message.media?.tts?.voice??'Enzo').trim();
    const style=String(message.media?.style??message.media?.tts?.style??'Friendly').trim();
    if(!voice||voice.length>100||style.length>2000)throw ttsConfigError('Speaker/Style của dự án không hợp lệ. Kiểm tra thiết lập giọng đọc.');
    const escaped=voice.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const speakerMatches=e=>new RegExp('^(?:Speaker|Người nói) 1\\s*[-–]\\s*'+escaped+'$','i').test(label(e));
    const waitVoice=()=>{
      owned.voiceWaitAt??=Date.now();
      if(Date.now()-owned.voiceWaitAt>20000||controls().some(e=>/No voices found|Không tìm thấy giọng/i.test(label(e))))
        throw ttsConfigError('Không tìm thấy Speaker "'+voice+'" trong Google AI Studio. Kiểm tra tên giọng hoặc chọn giọng khả dụng trong kênh/dự án.');
      throw Object.assign(new Error('Đang tìm Speaker '+voice),{code:'INPUT_NOT_READY'});
    };
    const welcome=[...document.querySelectorAll('[id="g1-welcome-dialog"]')].find(visible);
    if(welcome){
      const proceed=[...welcome.querySelectorAll('button,[role="button"]')].find(e=>visible(e)&&/^Continue$|^Tiếp tục$/i.test(caption(e)));
      if(proceed)return clickOne(proceed,'Đang tiếp tục qua màn hình giới thiệu AI Studio…');
      throw Object.assign(new Error('Đang chờ nút Continue của màn hình giới thiệu AI Studio'),{code:'INPUT_NOT_READY'});
    }
    const create=find(/^Create new dialog$|^Tạo hộp thoại mới$/i);
    if(create)return clickOne(create,'Đang tạo hộp thoại AI Studio…');
    const drawer=[...document.querySelectorAll('[role="dialog"],[id^="mat-mdc-dialog-"],aside,ms-speaker-settings')].find(e=>visible(e)&&
      (e.querySelector('[data-voice-name]')||e.matches('[role="dialog"],[id^="mat-mdc-dialog-"]'))&&/Speaker settings|Cài đặt người nói/.test(e.innerText||e.textContent||''));
    if(drawer){
      const card=[...drawer.querySelectorAll('[data-voice-name]')].find(e=>e.getAttribute('data-voice-name')===voice);
      const selected=card?.classList.contains('selected')||find(new RegExp('^'+escaped+'\\s*\\(Current\\)$','i'),drawer);
      if(selected){
        const close=find(/^Close(?: panel)?$|^close$|^Đóng$|Close speaker settings/,drawer);
        if(close)return clickOne(close,'Đang đóng bảng giọng đọc '+voice+'…');
        throw new Error('Đã chọn '+voice+' nhưng chưa thấy nút đóng bảng giọng đọc.');
      }
      const option=card?.querySelector('button.voice-card-content')||find(new RegExp('^'+escaped+'$'),drawer);
      if(option)return clickOne(option,'Đã chọn '+voice+', đang xác minh…');
      const search=[...drawer.querySelectorAll('input')].find(e=>visible(e)&&/search.*voices|tìm.*giọng/i.test(e.placeholder||''));
      if(search&&search.value!==voice){owned.voiceWaitAt=Date.now();await searchStudioVoice(search,voice);return {ready:false,message:'Đang tìm giọng '+voice+'…'}}
      return waitVoice();
    }
    // Finish the voice picker before inspecting model controls behind it.
    const model=message.media?.tts?.model;
    if(model){
      const settings=[...document.querySelectorAll('aside,ms-run-settings,ms-run-settings-panel,h1,h2,h3,[data-model-id]'),
        ...controls().filter(e=>e.matches('button')&&!e.closest('nav,[role="dialog"],[role="menu"],[role="listbox"],.cdk-overlay-pane')&&
          (label(e).startsWith(model)||caption(e).startsWith(model)))].filter(e=>visible(e)&&!e.closest('textarea,[contenteditable="true"],model-response,user-query'));
      if(!settings.some(e=>norm(e.textContent).includes(model)||e.getAttribute('data-model-id')==='gemini-3.8-flash-tts')){
        const option=find(new RegExp('^'+model.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
        const trigger=option||find(/Gemini.*(?:TTS|Speech)|^(?:Model|Mô hình)$/i)||find(/^Toggle run settings panel$/i);
        if(trigger&&(owned.modelAttempts||0)<3){owned.modelAttempts=(owned.modelAttempts||0)+1;return clickOne(trigger,'Đang xác minh model '+model+'…')}
        throw new Error('Chưa xác minh được model '+model+' trên AI Studio. Kiểm tra model rồi tạo lại đoạn còn thiếu.');
      }
    }
    const speaker=find(/^(?:Speaker|Người nói) 1\s*[-–]\s*/);
    if(!speaker||!speakerMatches(speaker)){
      const option=exact(voice,settingsPanel());
      if(option)return clickOne(option,'Đã chọn '+voice+', đang xác minh…');
      const search=[...document.querySelectorAll('input')].find(e=>visible(e)&&/search.*voices|tìm.*giọng/i.test(e.placeholder||''));
      if(search&&search.value!==voice){owned.voiceWaitAt=Date.now();await searchStudioVoice(search,voice);return {ready:false,message:'Đang tìm giọng '+voice+'…'}}
      if(speaker){owned.voiceWaitAt??=Date.now();return clickOne(speaker,'Đang mở lựa chọn giọng '+voice+'…')}
      return waitVoice();
    }
    delete owned.voiceWaitAt;
    const styleBadge=controls().find(e=>/^(?:Style|Phong cách)$/.test(label(e))&&
      !e.closest('[role="menu"],[role="listbox"],.cdk-overlay-pane')&&e.getAttribute('role')!=='option'&&e.getAttribute('role')!=='menuitem')||
      controls().find(e=>['Neutral','Serious','Casual','Friendly','Whisper','Narration'].includes(label(e))&&!e.closest('[role="menu"],[role="listbox"],.cdk-overlay-pane'));
    if(!styleBadge)throw new Error('Không thấy nút Style trong AI Studio. Kiểm tra khối Speaker/Style.');
    const styleField=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].find(e=>visible(e)&&
      /describe.*(?:voice|style)|style.*(?:instruction|description)|mô tả.*(?:giọng|phong cách)/i.test([e.getAttribute('placeholder'),e.getAttribute('aria-label'),e.getAttribute('data-placeholder')].join(' ')));
    const popup=styleField?.closest('[role="menu"],[role="listbox"],.cdk-overlay-pane,[role="dialog"]')||
      [...document.querySelectorAll('[role="menu"],[role="listbox"],.cdk-overlay-pane')].find(e=>visible(e)&&!e.contains(styleBadge)&&!!exact(style,e));
    // A selected preset can be verified directly without reopening its menu.
    if(style&&caption(styleBadge)===style){
      if(popup||styleField)return clickOne(styleBadge,'Đang đóng menu style…');
      return studioReady(message,speaker,styleBadge);
    }
    const signature=JSON.stringify([message.jobId,voice,style]);
    const state=owned.studioStyle?.signature===signature?owned.studioStyle:(owned.studioStyle={signature,phase:'open',started:Date.now()});
    if(!['verified','ready'].includes(state.phase)&&Date.now()-state.started>20000)throw ttsConfigError('Không xác minh được Style đã lưu trong AI Studio. Kiểm tra ô Describe the voice style.');
    if(styleField){
      const value=styleField.isContentEditable?styleField.textContent:styleField.value;
      if(String(value||'').trim()!==style){
        if(!globalThis.storyForgePaste)throw new Error('Reload Browser Bridge để nhập Style bằng Paste.');
        await globalThis.storyForgePaste.into(styleField,style,{validate:()=>{
          checkpoint();if(!visible(styleField)||styleField.disabled||styleField.readOnly)throw new Error('Ô Style chưa sẵn sàng.');
        }});
        state.phase='written';return {ready:false,message:'Đã nhập Style, đang kiểm tra…'};
      }
      // Close and reopen once to verify the provider retained the custom text.
      state.phase=state.phase==='verify'?'verified':'closed';
      return clickOne(styleBadge,'Đang lưu và xác minh Style…');
    }
    if(state.phase==='verified'||state.phase==='ready'){
      if(state.phase==='ready'&&state.caption!==caption(styleBadge)){state.phase='open'}
      else {state.phase='ready';state.caption=caption(styleBadge);return studioReady(message,speaker,styleBadge)}
    }
    if(state.phase==='closed')state.phase='verify';
    const option=style?exact(style,settingsPanel()):null;
    if(option&&popup)return clickOne(option,'Đang chọn Style '+style+'…');
    return clickOne(styleBadge,'Đang mở ô mô tả Style…');
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
    if(provider==='lyria')return musicPlayers().map(musicKey);
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
      // Flow's gallery also contains uploaded images. Stop at the prompt's
      // own controls rather than counting gallery/picker previews as uploads.
      if([...candidate.querySelectorAll('button,[role="button"]')].some(e=>
        /^(?:Bắt đầu tạo|Generate|Send message|Gửi tin nhắn|Thêm thành phần vào ô nhập câu lệnh|Add ingredients to (?:the )?prompt)$/i.test(label(e))))return candidate;
      candidate=candidate.parentElement;
    }
    return result;
  }
  const previews=root=>[...root.querySelectorAll('img')].filter(e=>visible(e)&&
    !e.closest('model-response,user-query,nav,aside,[role="dialog"]')&&!/icon|logo|avatar|generated video thumbnail|Hình thu nhỏ của video đã tạo/i.test(e.alt||e.className||''));
  const flowPromptAdd=/^(?:Thêm (?:thành phần )?vào (?:ô nhập )?(?:câu lệnh|lời nhắc)|Add (?:ingredients? )?to (?:the )?prompt)$/i;
  const flowUpload=/^(?:Upload(?: (?:files?|images?|media|assets|content))?|Tải (?:tệp|ảnh|nội dung(?: nghe nhìn)?)(?: lên|\s*\.{3}|\s*…)?|Tải lên)$/i;
  const matches=(e,pattern)=>pattern.test(label(e))||pattern.test(caption(e));
  function flowProjectUrl(){
    const match=location.pathname.match(/\/projects?\/[^/]+/);
    return match?location.origin+location.pathname.slice(0,match.index+match[0].length):undefined;
  }
  function savedFlowReferences(message){
    const page=flowProjectUrl();if(!page)return [];
    const saved=owned.flowReferenceLibrary||=[];
    for(const entry of (message.referenceLibrary||[]).slice(0,3)){
      if(entry?.projectUrl!==page||!/^sf_ref_[a-f0-9]{16}\.jpg$/.test(entry.name)||
        typeof entry.url!=='string'||entry.url.length>5000||! /^(?:https:\/\/|blob:)/.test(entry.url))continue;
      if(!saved.some(e=>e.projectUrl===page&&e.name===entry.name))saved.push({...entry});
    }
    return saved.filter(e=>e.projectUrl===page);
  }
  function rememberFlowReference(name,choice){
    const url=source(choice.querySelector('img')),projectUrl=flowProjectUrl();
    if(!url||!projectUrl)return;
    owned.flowReferenceLibrary=[...(owned.flowReferenceLibrary||[]).filter(e=>e.projectUrl!==projectUrl||e.name!==name),{name,url,projectUrl}].slice(-12);
  }
  function flowReferencePicker(){
    const pickers=[...document.querySelectorAll('[role="dialog"]')].filter(e=>{
      const title=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||e.querySelector('h1,h2,[role="heading"]')?.textContent||'';
      return visible(e)&&(/^(?:Thêm thành phần vào dự án|Add ingredients to (?:the )?project)$/i.test(norm(title))||
        [...e.querySelectorAll('input')].some(f=>/Tìm kiếm thành phần|Search ingredients/i.test(f.placeholder||f.getAttribute('aria-label')||''))&&
        [...e.querySelectorAll('button,[role="button"]')].some(b=>matches(b,flowUpload)));
    });
    if(pickers.length>1)throw new Error('Có nhiều thư viện thành phần Flow đang mở; chưa chọn ảnh tham chiếu.');
    return pickers[0];
  }
  function flowReferenceChoices(picker,name){
    const labels=[name,name+' Hình ảnh',name+'Hình ảnh',name+' Image',name+'Image',name+' image',name+'image'];
    const choices=[...picker.querySelectorAll('[role="option"],button,[role="button"]')].filter(enabled).filter(e=>
      labels.includes(label(e))||labels.includes(caption(e))||labels.includes(norm(e.innerText)));
    return [...new Set(choices.map(e=>e.closest('[role="option"]')||e))].filter(enabled);
  }
  function flowLibrarySnapshot(picker){
    return picker?[...picker.querySelectorAll('[role="option"],button,[role="button"]')].filter(e=>e.querySelector('img')):[];
  }
  function selectFlowReference(message){
    const upload=owned.referenceUpload;
    if(!upload||upload.verified||(upload.jobId!==message.jobId&&!message.recovery))return;
    if(upload.request||upload.loaded<upload.signature.split('|').length)return;
    const names=upload.signature.split('|').slice(0,upload.loaded),selected=upload.flowSelections||=[];
    const picker=flowReferencePicker();let pending=upload.flowPending;
    // Older adapters recorded a library selection as attached and closed its
    // preview. Recover that in-page state during reinjection without uploading
    // the same file again or treating the preview as a prompt attachment.
    if(!pending&&picker&&selected.length&&find(flowPromptAdd,picker)){
      const before=previews(composer(editor(true))),name=selected.at(-1);
      if(before.length<selected.length&&flowReferenceChoices(picker,name).length===1){
        selected.pop();pending=upload.flowPending={name,before};
      }
    }
    if(pending){
      const root=composer(editor(!!picker)),present=previews(root);
      const attached=present.some(e=>!pending.before.includes(e)&&source(e));
      // A card click can attach immediately on the compact layout, or merely
      // open a large preview with a second Add to prompt button on desktop.
      // Library/preview images alone never prove that the prompt has the file.
      if(attached){selected.push(pending.name);delete upload.flowPending}
      else if(picker){
        const choices=flowReferenceChoices(picker,pending.name);
        const chosen=choices.includes(pending.choice)?[pending.choice]:pending.url?choices.filter(e=>source(e.querySelector('img'))===pending.url):choices.length===1?choices:[];
        const other=[...picker.querySelectorAll('[role="option"][aria-selected="true"]')].some(e=>!chosen.includes(e));
        if(other)throw new Error('Ảnh được chọn trong Flow đã thay đổi. Kiểm tra ảnh tham chiếu trước khi tiếp tục.');
        const add=[...picker.querySelectorAll('button,[role="button"]')].find(e=>visible(e)&&matches(e,flowPromptAdd));
        if(add&&enabled(add)&&chosen.length===1&&pending.confirmedAt===undefined){
          pending.confirmedAt=Date.now();return clickOne(add,'Đang thêm ảnh nhân vật tham chiếu vào câu lệnh Flow…');
        }
        return {ready:false,message:'Đang chờ Flow thêm ảnh đã chọn vào câu lệnh…'};
      }else return {ready:false,message:'Đang chờ ảnh tham chiếu xuất hiện trong ô nhập Flow…'};
    }
    if(!picker){
      if(selected.length&&selected.length<names.length){
        const add=find(flowPromptAdd,composer());
        if(add)return clickOne(add,'Đang chọn ảnh nhân vật tham chiếu tiếp theo trong Flow…');
      }
      return;
    }
    for(const name of names){
      if(selected.includes(name))continue;
      const choices=flowReferenceChoices(picker,name);
      const fresh=choices.filter(e=>!upload.libraryBefore?.includes(e)&&
        !(upload.libraryBeforeUrls||[]).includes(source(e.querySelector('img'))));
      const candidates=upload.reusingLibrary?choices.filter(e=>source(e.querySelector('img'))===upload.libraryUrls?.[name]):upload.libraryBefore?fresh:choices;
      if(candidates.length>1)throw new Error('Có nhiều ảnh tham chiếu trùng tên trong Flow. Kiểm tra ảnh trước khi tiếp tục.');
      if(candidates.length===1){
        rememberFlowReference(name,candidates[0]);
        upload.flowPending={name,choice:candidates[0],url:source(candidates[0].querySelector('img')),before:previews(composer(editor(true)))};
        return clickOne(candidates[0],'Đang chọn ảnh nhân vật vừa tải vào scene Flow…');
      }
    }
    if(names.every(name=>selected.includes(name))){
      const close=find(/^(?:Đóng|Close)$/i,picker);
      if(close)return clickOne(close,'Đang đóng thư viện ảnh tham chiếu Flow…');
    }
    return {ready:false,message:'Đang chờ ảnh nhân vật vừa tải xuất hiện trong thư viện Flow…'};
  }
  function referenceInput(root,provider){
    const inputs=[...document.querySelectorAll('input[type="file"]')].filter(e=>
      !e.disabled&&!e.closest('model-response,user-query,nav,aside')&&(!e.accept||/image|\.png|\.jpe?g/i.test(e.accept)));
    const picker=provider==='flow'?flowReferencePicker():undefined;
    const local=inputs.filter(e=>picker?picker.contains(e):root.contains(e)),choices=local.length?local:inputs;
    if(!choices.length){
      const dialog=picker||[...document.querySelectorAll('[role="dialog"],[role="menu"]')].find(visible);
      const uploadButton=dialog&&[...dialog.querySelectorAll('button,[role="button"],[role="menuitem"]')].filter(enabled).find(e=>matches(e,flowUpload));
      if(provider==='flow'&&uploadButton)return {uploadButton};
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
  function requestFlowUpload(button,files,upload){
    const ticket=crypto.randomUUID();button.setAttribute('data-storyforge-reference-upload',ticket);
    upload.request={ticket,names:files.map(file=>file.name)};
    return {ready:false,referenceUpload:upload.request,message:'Đang gửi ảnh tham chiếu qua ô chọn tệp Flow…'};
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
    if(!files.length){
      if(message.provider==='flow'){
        const picker=flowReferencePicker(),close=picker&&find(/^(?:Đóng|Close)$/i,picker);
        if(close)return clickOne(close,'Đang đóng thư viện để nhập câu lệnh Flow…');
      }
      delete owned.referenceUpload;owned.referencesReady=message.jobId;return {ready:true};
    }
    if(files.length>3||files.some(f=>!/^sf_ref_[a-f0-9]{16}\.jpg$/.test(f.name)||f.mime!=='image/jpeg'||!f.data))
      throw new Error('Ảnh tham chiếu không hợp lệ');
    // Reuse only images whose exact library URL was recorded during our own
    // upload, in this same Flow project. A matching filename alone is not proof.
    if(message.provider==='flow'&&!upload&&!present.length){
      const saved=savedFlowReferences(message),entries=files.map(f=>saved.find(e=>e.name===f.name));
      if(entries.every(Boolean)){
        const picker=flowReferencePicker();
        if(!picker){
          const add=find(flowPromptAdd,root);
          if(add)return clickOne(add,'Đang mở ảnh tham chiếu đã tải của dự án Flow…');
        }else{
          const matches=entries.map(entry=>flowReferenceChoices(picker,entry.name).filter(e=>source(e.querySelector('img'))===entry.url));
          if(matches.some(choices=>choices.length>1))throw new Error('Có nhiều bản của ảnh tham chiếu đã lưu trong Flow. Kiểm tra ảnh trước khi tiếp tục.');
          if(matches.every(choices=>choices.length===1)){
            upload=owned.referenceUpload={jobId:message.jobId,signature,before:present,loaded:files.length,stableAt:Date.now(),
              reusingLibrary:true,libraryUrls:Object.fromEntries(entries.map(e=>[e.name,e.url]))};
          }
          // A deleted/replaced library file is uploaded again from the verified
          // local bytes; do not select a different image with the same name.
        }
      }
    }
    if(upload?.signature===signature){
      if(upload.request)return {ready:false,referenceUpload:upload.request,message:'Đang gửi ảnh tham chiếu qua ô chọn tệp Flow…'};
      if(message.provider==='flow'&&upload.loaded<files.length){
        const picker=flowReferencePicker();
        if(picker&&!files.slice(0,upload.loaded).every(file=>flowReferenceChoices(picker,file.name).some(choice=>
          !upload.libraryBefore?.includes(choice)&&!(upload.libraryBeforeUrls||[]).includes(source(choice.querySelector('img'))))))
          return {ready:false,message:'Đang chờ ảnh vừa tải xuất hiện trong thư viện Flow…'};
        const selected=referenceInput(root,message.provider),remaining=files.slice(upload.loaded);
        if(selected.uploadButton)return requestFlowUpload(selected.uploadButton,remaining,upload);
        if(!selected.input)return selected;
        const next=selected.input.multiple?remaining:remaining.slice(0,1);
        upload.loaded+=next.length;attachReferences(selected.input,next);
        return {ready:false,message:'Đang tải ảnh nhân vật tham chiếu tiếp theo…'};
      }
      if(message.provider==='flow'){
        const choice=selectFlowReference(message);if(choice)return choice;
      }
      const loaded=upload.loaded??files.length;
      const added=present.filter(e=>!upload.before?.includes(e));
      const names=files.slice(0,loaded).every(f=>norm(root.textContent).includes(f.name)||root.querySelector('[data-file-name="'+f.name+'"]'));
      const progressing=[...root.querySelectorAll('[role="progressbar"],[aria-busy="true"]')].some(visible);
      if(present.length>loaded)throw new Error('Ô nhập có thêm ảnh ngoài các ảnh tham chiếu đã chọn. Kiểm tra ảnh trước khi tiếp tục.');
      const proof=(names||added.length>=loaded||upload.verified&&present.length>=loaded)&&
        (message.provider!=='flow'||present.length===loaded&&present.every(e=>source(e)&&e.naturalWidth>0));
      if(!proof||progressing)return {ready:false,message:'Đang chờ tải đủ ảnh nhân vật tham chiếu…'};
      const urls=present.map(source).join('|');
      if(upload.previewSignature!==urls){upload.previewSignature=urls;upload.stableAt=Date.now();return {ready:false}}
      if(Date.now()-upload.stableAt<2000)return {ready:false,message:'Đang chờ ảnh tham chiếu sẵn sàng…'};
      if(loaded<files.length){
        const selected=referenceInput(root,message.provider);if(!selected.input)return selected;
        const next=files.slice(loaded,selected.input.multiple?files.length:loaded+1);
        upload.loaded=loaded+next.length;delete upload.previewSignature;
        attachReferences(selected.input,next);return {ready:false,message:'Đang tải ảnh nhân vật tham chiếu tiếp theo…'};
      }
      upload.verified=true;upload.names=files.map(f=>f.name);upload.nodes=present;upload.urls=present.map(source);upload.jobId=message.jobId;owned.referencesReady=message.jobId;
      return {ready:true};
    }
    if(present.length)throw new Error('Ô nhập có ảnh bạn đã thêm. Bridge không thay ảnh đó.');
    const selected=referenceInput(root,message.provider);
    if(selected.uploadButton){
      const picker=flowReferencePicker(),libraryBefore=flowLibrarySnapshot(picker);
      const state=owned.referenceUpload={jobId:message.jobId,signature,before:present,loaded:0,stableAt:Date.now(),libraryBefore,
        libraryBeforeUrls:libraryBefore?.map(e=>source(e.querySelector('img'))).filter(Boolean)};
      return requestFlowUpload(selected.uploadButton,files,state);
    }
    if(!selected.input)return selected;
    const first=selected.input.multiple?files:files.slice(0,1);
    const libraryBefore=message.provider==='flow'?flowLibrarySnapshot(flowReferencePicker()):undefined;
    owned.referenceUpload={jobId:message.jobId,signature,before:present,loaded:first.length,stableAt:Date.now(),libraryBefore,
      libraryBeforeUrls:libraryBefore?.map(e=>source(e.querySelector('img'))).filter(Boolean)};
    attachReferences(selected.input,first);
    return {ready:false,message:'Đang tải ảnh nhân vật tham chiếu vào '+(message.provider==='flow'?'Flow':'Gemini')+'…'};
  }
  function referencesIntact(message){
    if(owned.referencesReady!==message.jobId)return false;
    const root=composer(),present=previews(root),upload=owned.referenceUpload;
    if(!upload)return present.length===0;
    if(message.provider==='flow'&&(!upload.nodes?.length||present.length!==upload.names?.length||present.some(e=>!e.naturalWidth)))return false;
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
  const executeMedia=async message=>{
    checkpoint();
    const {provider,action}=message;
    const allowed={aistudio:['aistudio.google.com'],gemini:['gemini.google.com'],lyria:['aistudio.google.com'],flow:['flow.google.com','labs.google']}[provider];
    if(!allowed?.includes(location.hostname))throw new Error('Không đúng dịch vụ tạo media');
    if(document.readyState!=='complete'){
      if(provider==='gemini')resetEditorStability();return {ready:false,message:'Đang chờ trang tải xong…'};
    }
    if(action==='media-reference-uploaded'){
      const state=owned.referenceUpload,result=message.upload;
      if(provider!=='flow'||state?.jobId!==message.jobId||!state.request||result?.ticket!==state.request.ticket||
        !Array.isArray(result.names)||!result.names.length||result.names.some((name,i)=>name!==state.request.names[i]))
        throw new Error('Chưa xác minh được ảnh đã gửi vào ô chọn tệp Flow');
      state.loaded+=result.names.length;state.uploadMode=result.mode;delete state.request;delete state.previewSignature;
      return {uploaded:true};
    }
    if(action==='media-setup'){
      if(owned.setupJobId!==message.jobId){
        if(provider==='gemini')resetEditorStability();
        owned.setupJobId=message.jobId;
        delete owned.flowConfigured;delete owned.flowVerified;delete owned.flowChoices;
        delete owned.recoverySignature;delete owned.modelAttempts;delete owned.referencesReady;
        delete owned.lyriaSettingsOpened;delete owned.voiceWaitAt;delete owned.studioStyle;delete owned.studioVerified;
      }
      if(busy(provider)){if(provider==='gemini')resetEditorStability();delete owned.recoverySignature;return {ready:false,message:'Dịch vụ đang tạo nội dung trước, đang chờ hoàn tất…'}}
      if(message.recovery){
        const signature=JSON.stringify(snapshot(provider));
        if(signature!==owned.recoverySignature){owned.recoverySignature=signature;owned.recoveryAt=Date.now();return {ready:false}}
        if(Date.now()-owned.recoveryAt<5000)return {ready:false,message:'Đang chờ kết quả cũ ổn định trước scene tiếp theo…'};
      }
      if(provider==='aistudio'){const setup=await setupStudio(message);if(!setup.ready)return setup}
      if(provider==='lyria'){const setup=setupLyria(message);if(!setup.ready)return setup}
      if(provider==='flow'){
        const reference=selectFlowReference(message);if(reference)return reference;
        // The library can already be open before Bridge starts, or while its
        // Upload button materializes the file input. Prepare handles that UI;
        // do not try to focus/configure the inert editor behind this dialog.
        if(flowReferencePicker())return {ready:true,message:'Đang chuẩn bị tải ảnh tham chiếu trong thư viện Flow…'};
        if(!owned.flowConfigured){const setup=flowSetup();if(!setup.ready)return setup}
      }
      let field;
      try{field=editor()}catch(error){if(provider==='gemini')resetEditorStability();throw error}
      const currentText=text(field);
      if(field!==stableEditor||(provider==='gemini'&&currentText!==stableText)){stableEditor=field;stableText=currentText;stableAt=Date.now();return {ready:false}}
      return {ready:Date.now()-stableAt>=(provider==='gemini'?500:2000)};
    }
    if(action==='media-prepare'){
      if(busy(provider))throw Object.assign(new Error('Dịch vụ vẫn đang tạo media'),{code:'INPUT_NOT_READY'});
      if(provider==='lyria'&&!musicConfigured(message))throw Object.assign(new Error('Chưa có ô nhập Text của Lyria 3 Pro Preview; chưa Paste.'),{code:'INPUT_NOT_READY'});
      const picker=provider==='flow'?flowReferencePicker():undefined;
      const field=editor(!!picker),existing=text(field);
      if(existing&&existing!==norm(message.prompt)&&existing!==owned.lastPrompt&&existing!==norm(message.previousPrompt))
        throw new Error('Ô nhập có nội dung bạn đang soạn. Bridge không xóa nội dung đó.');
      if(provider==='gemini'||provider==='flow'){
        const upload=referenceUploads(message,field);if(!upload.ready)return upload;
      }
      if(provider==='flow'&&(flowReferencePicker()||!visible(field)))return {ready:false,message:'Đang chờ thư viện đóng và ô nhập Flow sẵn sàng…'};
      const baseline=snapshot(provider);
      owned.baselineNodes=provider==='lyria'?[]:mediaItems(provider);
      await setEditor(field,message.prompt,provider);
      if(text(field)!==norm(message.prompt))throw Object.assign(new Error('Ô nhập chưa nhận đủ nội dung'),{code:'INPUT_NOT_READY'});
      owned.lastPrompt=norm(message.prompt);
      return {baseline};
    }
    if(action==='media-ready')return {ready:!busy(provider)&&text(editor())===norm(message.prompt)&&!!run(provider)&&
      (provider!=='aistudio'||studioConfigured(message))&&
      (provider!=='lyria'||musicConfigured(message))&&
      (!(provider==='gemini'||provider==='flow')||referencesIntact(message))};
    if(action==='media-send'){
      if(owned.sent?.includes(message.jobId))return {submitted:true};
      if(busy(provider)||text(editor())!==norm(message.prompt))throw new Error('Ô nhập đã thay đổi trước khi tạo media');
      if(provider==='aistudio'&&!studioConfigured(message))throw ttsConfigError('Speaker hoặc Style đã thay đổi trước khi tạo TTS; chưa gửi lời kể.');
      if(provider==='lyria'&&!musicConfigured(message))throw new Error('Mô hình Lyria hoặc ô nhập Text đã thay đổi trước khi gửi; chưa gửi prompt.');
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
        return {ready:Date.now()-owned.resultAt>=4000,result:{jobId:message.jobId,responseKey:key,expectedDuration:musicDuration(response)}};
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
        return {direct:false,referrer:location.href,expectedDuration:musicDuration(response)};
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
        // Prefer the player's assembled Download. If it opens a format menu,
        // choose only MP3/WAV audio, never video, artwork or another output.
        if(!owned.musicDownload){
          const response=lyriaResponse(message);
          if(!response||musicKey(response)!==message.result?.responseKey)return {clicked:false};
          owned.musicDownload={jobId:message.jobId,responseKey:musicKey(response)};
        }
        if(owned.musicDownload.jobId!==message.jobId||owned.musicDownload.responseKey!==message.result?.responseKey)return {clicked:false};
        const menus=[...document.querySelectorAll('[role="menu"]')].filter(visible);
        if(menus.length!==1)return {clicked:false};
        const audio=find(/^(?:Chỉ riêng âm thanh|Audio only|Audio|Download (?:audio|MP3|WAV)|MP3|WAV)(?:\s|$)/i,menus[0]);
        if(!audio||!/(?:MP3|WAV)/i.test(label(audio)+caption(audio))||/video|cover|artwork|ảnh|bìa/i.test(label(audio)+caption(audio)))return {clicked:false};
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
  globalThis.storyForgeMediaExecute=async message=>{
    const result=await executeMedia(message);
    if(message.provider!=='flow'||!['media-setup','media-prepare'].includes(message.action))return result;
    const upload=owned.referenceUpload;
    const active=upload?.jobId===message.jobId||message.recovery&&upload;
    const stage=active?upload.verified?'verified':upload.flowPending?.confirmedAt!==undefined?'confirmed':
      upload.flowPending?'selected':'uploaded':owned.flowVerified?'configured':undefined;
    return {...result,referenceLibrary:savedFlowReferences(message),...(stage?{preparationProgress:
      stage+':'+(active?upload.signature+':'+(upload.flowSelections?.length||0)+':'+upload.loaded:'')}:{})};
  };
})();
