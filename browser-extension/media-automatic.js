// Durable media queue. Generations are authorized once; downloads are tracked by
// their exact ID/URL, never by whichever file happened to arrive most recently.
import {withTabReadDeadline} from './transport.js';
import {providerPage,projectSessionKey} from './media-sessions.js';
import {AI_PAGE_SETTLE_MS} from './preparation-timing.js';

export function createMediaBridge({chrome,request,ensureContent,armCapture,readCapture,uploadReferences,now=()=>Date.now(),pageSettleMs}){
  let busy=false;
  const read=async()=> (await chrome.storage.local.get('mediaBridge')).mediaBridge||{phase:'idle',tabs:{}};
  const write=async state=>{await chrome.storage.local.set({mediaBridge:state});return state};
  const enabled=async()=>!!(await chrome.storage.local.get('autoBridge')).autoBridge?.enabled;
  const idle=(s,message)=>({phase:'idle',tabs:s.tabs||{},pages:s.pages||{},folders:s.folders||{},prompts:s.prompts||{},sessions:s.sessions||{},message});
  async function remember(state,job){
    const tab=await chrome.tabs.get(state.tabId),page=providerPage(state.provider,tab.url);
    const key=state.sessionKey||projectSessionKey(job),previous=state.sessions?.[key]||{};
    if(page&&previous.url&&page!==previous.url&&state.provider!=='aistudio')
      throw new Error('Tab đã chuyển sang cuộc trò chuyện hoặc dự án khác; không gửi hay tải tài nguyên ở đó.');
    let session={...previous,tabId:state.tabId,previousPrompt:state.prompts?.[state.tabId]||previous.previousPrompt};
    if(page)session.url=page;
    if(page&&(session.syncedUrl!==page||state.sentAt&&session.syncedSentFor!==job.id)&&(job.project_id||job.media.project_id)){
      await request('/media/'+job.id+'/session','POST',{owner:state.owner,attempt:state.attempt,url:page});
      session.syncedUrl=page;
      if(state.sentAt)session.syncedSentFor=job.id;
    }
    return write({...state,sessionKey:key,sessions:{...state.sessions,[key]:session},
      pages:{...state.pages,...(page?{[state.provider]:page}:{})}});
  }
  const call=async(state,action,extra={})=>{
    const result=await withTabReadDeadline(()=>chrome.tabs.sendMessage(state.tabId,{type:'storyforge',action:'media-'+action,
      provider:state.provider,jobId:state.jobId,prompt:state.prompt,previousPrompt:state.prompts?.[state.tabId],media:state.media,baseline:state.baseline,collection:state.collection,
      referenceLibrary:state.sessions?.[state.sessionKey]?.referenceLibrary,...extra}));
    if(!result?.ok)throw Object.assign(new Error(result?.error||'Không kết nối được tab tạo tài nguyên'),{code:result?.code});
    return result;
  };
  const status=async(state,message)=>{
    if(state.message!==message){await write({...state,message});await request('/jobs/'+state.jobId+'/status','POST',{step:message})}
  };
  async function observePreparation(state,result){
    if(state.provider!=='flow')return state;
    const changes={},progress=result.preparationProgress,seen=state.preparationProgress||[];
    // Allow each actual upload/selection/confirmation milestone its own wait
    // window. Repeated waiting messages cannot keep a frozen page alive.
    if(typeof progress==='string'&&progress.length<512&&!seen.includes(progress)){
      changes.preparationProgress=[...seen,progress].slice(-32);
      changes.preparationMaxDeadline=state.preparationMaxDeadline||Math.min(state.deadline,now()+10*60*1000);
      changes.preparationDeadline=Math.min(changes.preparationMaxDeadline,now()+180000);
    }
    if(Array.isArray(result.referenceLibrary)){
      const context=state.sessions?.[state.sessionKey]||{};
      const page=providerPage('flow',context.url);
      const entries=result.referenceLibrary.filter(e=>page&&e?.projectUrl===page&&/^sf_ref_[a-f0-9]{16}\.jpg$/.test(e.name)&&
        typeof e.url==='string'&&e.url.length<5001&&/^(?:https:\/\/|blob:)/.test(e.url)).slice(-3);
      if(entries.length&&JSON.stringify(entries)!==JSON.stringify(context.referenceLibrary))
        changes.sessions={...state.sessions,[state.sessionKey]:{...context,referenceLibrary:entries}};
    }
    return Object.keys(changes).length?write({...state,...changes}):state;
  }
  async function resume(){
    const s=await read();
    if(s.phase!=='paused')return s;
    const stages=['idle','opening','prepared','submitted','download_ready','downloading'];
    // Older workers overwrote resumePhase with "paused" when the local app
    // stayed offline. Recover from durable evidence without granting a new Send.
    let phase=stages.includes(s.resumePhase)?s.resumePhase:
      s.downloadAt||s.downloadId?'downloading':s.result?'download_ready':s.sentAt?'submitted':s.jobId?'opening':'idle';
    let download=s;
    if(phase==='downloading'){
      let item;
      if(s.downloadId)[item]=await chrome.downloads.search({id:s.downloadId});
      else if(s.downloadAt){
        const candidates=(await chrome.downloads.search({startedAfter:new Date(s.downloadAt-1000).toISOString(),limit:50}))
          .filter(item=>matchesDownload({...s,phase:'downloading'},item));
        if(candidates.length===1){item=candidates[0];download={...s,downloadId:item.id}}
        else if(candidates.length>1)throw new Error('Có nhiều lượt tải cho kết quả này. Kiểm tra các lượt tải trước khi tiếp tục.');
      }
      if(!item||item.state==='interrupted'){
        // Retry only the existing output. Reusing the interrupted ID would
        // pause forever, while reopening preparation could spend credits twice.
        phase='download_ready';
        download={...s,downloadId:undefined,downloadInitiated:false,downloadTicket:undefined,downloadAt:undefined,downloadUrl:undefined};
      }
    }
    return write({...download,phase,deadline:now()+30*60*1000,preparationDeadline:now()+180000,errors:0,
      message:'Đang tiếp tục lấy tài nguyên; yêu cầu đã gửi không được gửi lại.'});
  }
  async function tick(){
    if(busy)return;
    if(!await enabled()){
      // Turning Auto off deliberately suspends work, rather than disconnecting
      // the browser. Keep the already-owned job's heartbeat without UI actions
      // or another Send permit, so the app watchdog does not discard its result.
      const paused=await read();
      if(paused.jobId&&paused.owner){
        if(paused.suspendedAt===undefined)await write({...paused,suspendedAt:now()});
        try{await request('/media/'+paused.jobId+'/claim','POST',{owner:paused.owner,attempt:paused.attempt})}catch{}
      }
      return;
    }
    busy=true;
    let state=await read();
    if(state.suspendedAt!==undefined){
      const elapsed=Math.max(0,now()-state.suspendedAt);
      state=await write({...state,suspendedAt:undefined,deadline:state.deadline+elapsed,
        preparationDeadline:state.preparationDeadline+elapsed,
        ...(state.preparationMaxDeadline?{preparationMaxDeadline:state.preparationMaxDeadline+elapsed}:{})});
    }
    let job;
    try{
      const {items}=await request('/jobs');
      job=items.find(j=>j.id===state.jobId&&j.attempt===state.attempt&&j.media);
      if(state.jobId&&!job){
        // The app watchdog may have skipped the job while the browser was hung.
        const key=state.sessionKey;
        if(key)state={...state,sessions:{...state.sessions,[key]:{...state.sessions?.[key],recover:true,submitted:!!state.sentAt}}};
        state=await write(idle(state,'Đã lưu hoặc dừng tác vụ media trước.'));
      }
      if(state.phase==='paused')return;
      if(!job){
        job=items.find(j=>j.media);
        if(!job)return;
        const key=projectSessionKey(job),previous=state.sessions?.[key]||{};
        const server=providerPage(job.provider,job.media_session?.url);
        const legacy=!(job.project_id||job.media.project_id)&&state.folders?.[job.provider]===job.media.folder?
          {url:providerPage(job.provider,state.pages?.[job.provider]),tabId:state.tabs?.[job.provider]}:{};
        const context={...legacy,...previous,...(server?{url:server,syncedUrl:server}:{})};
        if(!context.previousPrompt&&job.media_session?.last_prompt)context.previousPrompt=job.media_session.last_prompt;
        state=await write({phase:'opening',tabs:state.tabs||{},pages:state.pages||{},folders:state.folders||{},prompts:state.prompts||{},sessions:{...state.sessions,[key]:context},sessionKey:key,jobId:job.id,attempt:job.attempt,provider:job.provider,
          prompt:job.prompt,media:job.media,owner:crypto.randomUUID(),deadline:now()+30*60*1000,preparationDeadline:now()+180000,
          preparationMaxDeadline:now()+(job.provider==='flow'?10*60*1000:180000)});
        const {claim}=await request('/media/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
        if(claim.phase==='sent')throw new Error('Yêu cầu đã gửi từ một phiên khác. Kiểm tra tab trước khi tiếp tục.');
      }
      if(!state.sessionKey){
        // Upgrade an in-flight queue saved by older Bridge versions without
        // losing its previously verified page or granting another Send.
        const key=projectSessionKey(job),server=providerPage(job.provider,job.media_session?.url);
        const legacy=state.folders?.[job.provider]===job.media.folder?
          {url:providerPage(job.provider,state.pages?.[job.provider]),tabId:state.tabId||state.tabs?.[job.provider]}:{};
        state=await write({...state,sessionKey:key,sessions:{...state.sessions,[key]:{...legacy,...state.sessions?.[key],...(server?{url:server,syncedUrl:server}:{})}}});
      }
      const permit={owner:state.owner,attempt:state.attempt};
      // Validate the batch, scene and explicit approval before every UI action.
      const {claim}=await request('/media/'+job.id+'/claim','POST',permit);
      if(['opening','prepared'].includes(state.phase)&&(claim.phase==='sent'||state.sentAt))
        throw new Error('Yêu cầu này đã được gửi. Kiểm tra tab lấy kết quả; không mở lại bước tạo media.');
      if(state.provider==='lyria'&&['opening','prepared'].includes(state.phase)&&!state.sentAt){
        const context=state.sessions?.[state.sessionKey]||{};
        let oldTab;
        const saved=state.tabId||context.tabId;
        if(saved){try{oldTab=await chrome.tabs.get(saved)}catch{}}
        const oldGemini=value=>{try{return new URL(value).hostname==='gemini.google.com'}catch{return false}};
        if(oldGemini(context.url)||oldGemini(oldTab?.url)){
          // An unsent v1.1.38 music job can migrate to AI Studio. Leave its
          // Gemini tab intact, and never migrate/re-send a submitted job.
          state=await write({...state,phase:'opening',tabId:undefined,pageReadyAt:0,baseline:undefined,referencesPrepared:false,
            preparationDeadline:now()+180000,sessions:{...state.sessions,[state.sessionKey]:{}},
            message:'Đang chuyển tác vụ nhạc chưa gửi sang AI Studio Lyria 3 Pro…'});
        }
      }
      if(now()>state.deadline)throw new Error('Đã hết thời gian chờ media; scene này cần tạo lại thủ công.');
      if(['opening','prepared'].includes(state.phase)&&now()>state.preparationDeadline)throw new Error('Chưa chuẩn bị được tab media sau 3 phút không tiến triển; scene này cần tạo lại thủ công.'+(state.message?' Bước đang chờ: '+state.message:''));
      if(state.phase==='opening'){
        let tab;
        const key=state.provider;
        let context=state.sessions?.[state.sessionKey]||{};
        if(state.tabId){try{tab=await chrome.tabs.get(state.tabId)}catch(error){
          if(!/No tab with id|Invalid tab ID/i.test(error.message||''))throw error;
        }}
        if(!tab){
          const saved=context.tabId;
          if(saved){try{tab=await chrome.tabs.get(saved)}catch{}}
          if(tab&&!tab.active)tab=await chrome.tabs.update(tab.id,{active:true});
          if(tab&&state.provider==='flow'){
            const page=context.url;
            // Return from our own clip player to the same project for the next
            // scene. A different StoryForge project starts a new Flow project.
            if(page&&tab.url?.startsWith(page+'/edit/'))tab=await chrome.tabs.update(tab.id,{url:page,active:true});
          }
          if(!tab){
            const savedPage=context.url;
            if(context.submitted&&!savedPage&&!['aistudio','lyria'].includes(state.provider))
              throw new Error('Chưa có đường dẫn phiên đã gửi trước đó. Mở lại phiên cũ để giữ nhân vật; scene này cần xử lý thủ công.');
            // Only reopen a page we recorded for this project before Send.
            // A submitted job always stays on its original result-collection path.
            const hosts={aistudio:['aistudio.google.com'],gemini:['gemini.google.com'],lyria:['aistudio.google.com'],flow:['flow.google.com','labs.google']}[key];
            let url=job.url;
            try{if(savedPage&&hosts.includes(new URL(savedPage).hostname))url=savedPage}catch{}
            tab=await chrome.tabs.create({url,active:true});
          }
          state=await write({...state,tabId:tab.id,pageReadyAt:0,tabs:{...state.tabs,[key]:tab.id},folders:{...state.folders,[key]:state.media.folder},
            prompts:{...state.prompts,...(context.previousPrompt?{[tab.id]:context.previousPrompt}:{})},
            sessions:{...state.sessions,[state.sessionKey]:{...context,tabId:tab.id}}});
        }
        const host=new URL(tab.url||job.url).hostname;
        const allowed={aistudio:['aistudio.google.com'],gemini:['gemini.google.com'],lyria:['aistudio.google.com'],flow:['flow.google.com','labs.google']}[state.provider];
        if(!allowed.includes(host))throw new Error('Tab media đã chuyển sang trang khác. Mở lại dịch vụ để tiếp tục.');
        if(tab.status!=='complete'||tab.pendingUrl){await write({...state,pageReadyAt:0,pageReadyUrl:undefined});return}
        const currentPage=providerPage(state.provider,tab.url);
        if(context.url&&currentPage!==context.url&&context.restoredFor!==job.id){
          tab=await chrome.tabs.update(tab.id,{url:context.url,active:true});
          await write({...state,pageReadyAt:0,sessions:{...state.sessions,[state.sessionKey]:{...context,restoredFor:job.id}}});return;
        }
        if(context.url&&currentPage!==context.url)
          throw new Error('Không khôi phục được phiên cũ của dự án. Kiểm tra đăng nhập hoặc mở lại phiên; không tạo phiên khác.');
        if(context.recover&&context.recoveredFor!==job.id&&context.url){
          await chrome.tabs.update(tab.id,{url:context.url,active:true});
          await write({...state,pageReadyAt:0,sessions:{...state.sessions,[state.sessionKey]:{...context,recoveredFor:job.id}}});return;
        }
        // Setup may create a Flow project before it finishes selecting options.
        // Save that URL now so closing the browser does not lose the project.
        state=await remember(state,job);
        const fastPreparation=state.provider==='gemini';
        if(!state.pageReadyAt||(fastPreparation&&state.pageReadyUrl!==tab.url)){
          state=await write({...state,pageReadyAt:now(),pageReadyUrl:tab.url});
          if(!fastPreparation)return;
        }
        const pageSettling=now()-state.pageReadyAt<(pageSettleMs??(fastPreparation?AI_PAGE_SETTLE_MS:5000));
        if(pageSettling&&!fastPreparation)return;
        await ensureContent(state.tabId);
        const setup=await call(state,'setup',{recovery:!!context.recover});
        state=await observePreparation(state,setup);
        if(pageSettling||!setup.ready){await status(state,setup.message||'Đang chờ trang và cài đặt media sẵn sàng…');return}
        const {files=[]}=await request('/media/'+job.id+'/references','POST',permit);
        const prepared=await call(state,'prepare',{references:files,recovery:!!context.recover});
        state=await observePreparation(state,prepared);
        if(prepared.referenceUpload){
          if(state.provider!=='flow'||!uploadReferences)throw new Error('Reload Browser Bridge để hỗ trợ cửa sổ chọn ảnh tham chiếu Flow.');
          const target=prepared.referenceUpload;
          if(!Array.isArray(target.names)||!target.names.length||target.names.some(name=>!files.some(file=>file.name===name)))
            throw new Error('Lượt tải ảnh Flow không thuộc tài nguyên đã chọn của dự án');
          if(!await enabled())return;
          await request('/media/'+job.id+'/claim','POST',permit);
          const uploaded=await uploadReferences(state.tabId,target.ticket,target.names.map(name=>files.find(file=>file.name===name)));
          await call(state,'reference-uploaded',{upload:uploaded});
          await status(state,'Đã gửi ảnh tham chiếu cho Flow; đang chờ chọn và thêm vào câu lệnh…');return;
        }
        if(prepared.ready===false){await status(state,prepared.message||'Đang tải ảnh nhân vật tham chiếu…');return}
        state=await remember(state,job);
        state=await write({...state,phase:'prepared',baseline:prepared.baseline,
          referencesPrepared:true,prompts:{...state.prompts,[state.tabId]:state.prompt},message:'Đã nhập nội dung, đang chờ nút tạo khả dụng…'});
        return;
      }
      if(state.phase==='prepared'){
        if(!state.referencesPrepared){await write({...state,phase:'opening',pageReadyAt:0});return}
        await ensureContent(state.tabId);
        const ready=await call(state,'ready');
        if(!ready.ready)return;
        if(!await enabled())return;
        const authorized=await request('/media/'+job.id+'/claim','POST',{...permit,authorize_send:true});
        // Persist BEFORE Run/Send: a lost message acknowledgement is ambiguous,
        // so recovery only polls this tab instead of spending credits twice.
        state=await write({...state,phase:'submitted',sentAt:now(),message:'Đang tạo '+state.media.filename+'…'});
        if(authorized.send)await call(state,'send');
        state=await remember(state,job);
        return;
      }
      if(state.phase==='submitted'){
        state=await remember(state,job);
        await ensureContent(state.tabId);
        const result=await call(state,'poll');
        if(result.collection&&JSON.stringify(result.collection)!==JSON.stringify(state.collection))state=await write({...state,collection:result.collection});
        if(!result.ready){await status(state,result.message||'Đang chờ media tạo xong; không gửi lại yêu cầu.');return}
        state=await write({...state,phase:'download_ready',result:result.result});
        return;
      }
      if(state.phase==='download_ready'){
        if(!await enabled())return;
        state=await remember(state,job);
        // Reloading the extension disconnects the old content listener even
        // though the generated audio/image/video is still present in the tab.
        await ensureContent(state.tabId);
        const download=await call(state,'download-info',{result:state.result});
        if(download.collection&&JSON.stringify(download.collection)!==JSON.stringify(state.collection))state=await write({...state,collection:download.collection});
        if(download.ready===false){await status(state,download.message||'Đang chờ trang tải media sẵn sàng…');return}
        state=await write({...state,phase:'downloading',downloadAt:now(),downloadUrl:download.direct?download.url:undefined,referrer:download.referrer,
          expectedDuration:download.expectedDuration||state.result?.expectedDuration,
          prompts:{...state.prompts,[state.tabId]:state.prompt},
          message:'Đang tải '+state.media.filename+'…'});
        if(download.direct){
          const id=await chrome.downloads.download({url:download.url,filename:state.media.folder+'/'+state.media.filename,
            saveAs:false,conflictAction:'uniquify'});
          // Filename listener may already have persisted the same download ID.
          state=await write({...await read(),downloadId:id});
        }else{
          if(armCapture){
            state=await write({...state,downloadTicket:crypto.randomUUID().replaceAll('-','')});
            await armCapture(state.tabId,state.downloadTicket,state.provider);
          }
          const clicked=await call(state,'download-click',{result:state.result});
          if(clicked.ready===false)await write({...state,phase:'download_ready',collection:clicked.collection||state.collection,
            downloadAt:undefined,downloadUrl:undefined,downloadTicket:undefined,message:clicked.message});
        }
        return;
      }
      if(state.phase==='downloading'){
        if(state.downloadTicket&&readCapture){
          const url=await readCapture(state.tabId,state.downloadTicket);
          if(!url&&['flow','lyria'].includes(state.provider))await call(state,'download-continue',{result:state.result});
          if(url&&url!==state.downloadUrl)state=await write({...state,downloadUrl:url});
          if(url&&!state.downloadId&&!state.downloadInitiated){
            state=await write({...state,downloadInitiated:true,downloadUrl:url});
            const id=await chrome.downloads.download({url,filename:state.media.folder+'/'+state.media.filename,saveAs:false,conflictAction:'uniquify'});
            state=await write({...await read(),downloadId:id});
          }
        }
        if(!state.downloadId){
          // Recover a worker restart between initiating and saving a download.
          const candidates=(await chrome.downloads.search({startedAfter:new Date(state.downloadAt-1000).toISOString(),limit:50}))
            .filter(item=>matchesDownload(state,item));
          if(candidates.length===1)state=await write({...state,downloadId:candidates[0].id});
          else if(now()-state.downloadAt>150000)throw new Error('Chưa nhận được file tải về. Kiểm tra nút tải trong tab; không tạo lại media.');
          else return;
        }
        const [item]=await chrome.downloads.search({id:state.downloadId});
        if(!item)throw new Error('Không tìm thấy lượt tải media này');
        if(item.state==='interrupted')throw new Error(item.error==='USER_CANCELED'
          ? 'Lượt tải đã bị hủy. Nếu Comet hiện Save As, tắt “Ask where to save each file before downloading” trong Settings → Downloads, rồi bấm Tiếp tục tải tài nguyên. Bridge sẽ tải lại kết quả đã tạo, không gửi lại prompt.'
          : 'Tải bị gián đoạn: '+(item.error||'kiểm tra trình duyệt'));
        if(item.state!=='complete')return;
        await request('/media/'+job.id+'/result','POST',{...permit,download_id:item.id,download_state:item.state,path:item.filename,
          ...(state.expectedDuration>0?{expected_duration:state.expectedDuration}:{})});
        // Only clear our own previous text once the completed file is imported.
        const context=state.sessions?.[state.sessionKey]||{};
        state={...state,sessions:{...state.sessions,[state.sessionKey]:{...context,recover:false,previousPrompt:state.prompt,submitted:true}}};
        await write(idle(state,'Đã tải và gán '+state.media.filename+'. Đang chuyển sang scene tiếp theo…'));
      }
    }catch(error){
      state=await read();
      // Polling an offline app while already paused must not replace the
      // saved stage with "paused" and make the Continue button a permanent no-op.
      if(state.phase==='paused')return;
      const errors=(state.errors||0)+1;
      const transient=['TAB_READ_TIMEOUT','INPUT_NOT_READY'].includes(error.code)||/message.*closed|Receiving end does not exist|Could not establish connection|Failed to fetch/i.test(error.message||'');
      // A hydrated SPA may still need more than eight short polls to mount its
      // settings/composer. Use the existing three-minute preparation deadline
      // before Send; retain the failure limit while collecting sent media.
      const waitingForInput=['opening','prepared'].includes(state.phase)&&!state.sentAt&&
        ['INPUT_NOT_READY','TAB_READ_TIMEOUT'].includes(error.code)&&now()<state.preparationDeadline;
      if(transient&&(errors<=8||waitingForInput)&&now()<state.deadline){
        await write({...state,errors,message:'Tab media đang tải hoặc mất kết nối. Đang chờ lại; không gửi trùng.'});
      }else{
        // Retry the existing full WAV download once, without another Run.
        // A persistent provider/tab/download failure skips only this item.
        const incomplete=/\[(?:TTS|MUSIC)_INCOMPLETE\]/.test(error.message||'');
        const retry=incomplete?{downloadId:undefined,downloadInitiated:false,downloadTicket:undefined,
          downloadAt:undefined,downloadUrl:undefined}:{};
        if(incomplete&&!state.fullDownloadRetry){
          await write({...state,...retry,phase:'download_ready',fullDownloadRetry:true,errors,
            message:state.provider==='lyria'?'File nhạc chưa đầy đủ. Đang tải lại bản đã tạo, không gửi lại prompt.':
              'WAV chưa đầy đủ. Đang tải lại kết quả đã tạo, không gửi lại nội dung.'});
          return;
        }
        let skipped=false,configurationPaused=false;
        if(state.jobId&&state.owner){
          try{
            if(state.tabId&&job){try{state=await remember(state,job)}catch{}}
            const result=await request('/media/'+state.jobId+'/failure','POST',{owner:state.owner,attempt:state.attempt,
              reason:error.message||String(error),stage:state.phase,code:error.code});
            skipped=result.accepted===true;
            configurationPaused=result.paused===true;
          }catch{}
        }
        if(skipped){
          // Keep the project page and prompt evidence. Recover the same page
          // before preparing the next scene, never spend credits in a new chat.
          const key=state.sessionKey,context=state.sessions?.[key]||{};
          state={...state,sessions:{...state.sessions,[key]:{...context,recover:true,submitted:!!state.sentAt||context.submitted,
            previousPrompt:state.prompts?.[state.tabId]||context.previousPrompt}}};
          await write(idle(state,configurationPaused?'TTS tạm dừng do Speaker/Style chưa hợp lệ. Sửa giọng đọc trong Tổng quan dự án rồi tiếp tục.':
            'Đã bỏ qua '+state.media.filename+'. Giữ phiên của dự án và chuyển scene tiếp theo; xem Tài Nguyên để tạo phần còn thiếu.'));
        }else{
          // A disconnected local app or ownership conflict cannot authorize
          // skipping a job. Keep the exact stage for reconnection/manual resume.
          await write({...state,...retry,phase:'paused',resumePhase:incomplete?'download_ready':state.phase,errors,message:error.message||String(error)});
          if(state.jobId){try{await request('/jobs/'+state.jobId+'/status','POST',{step:'Tạo media tạm dừng: '+error.message})}catch{}}
        }
      }
    }finally{busy=false}
  }
  function matchesDownload(state,item){
    if(state.phase!=='downloading'||!state.downloadUrl||Date.parse(item.startTime)<state.downloadAt-1000)return false;
    return item.url===state.downloadUrl||item.finalUrl===state.downloadUrl;
  }
  async function determineFilename(item,suggest){
    try{
      let state=await read();
      if(state.phase==='downloading'&&state.downloadTicket&&readCapture){
        const url=await readCapture(state.tabId,state.downloadTicket);
        if(url)state=await write({...state,downloadUrl:url});
      }
      if(matchesDownload(state,item)){
        await write({...state,downloadId:item.id});
        suggest({filename:state.media.folder+'/'+state.media.filename,conflictAction:'uniquify'});
      }else suggest();
    }catch{suggest()}
  }
  return {read,tick,resume,determineFilename};
}
