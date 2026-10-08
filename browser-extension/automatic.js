// One persisted state machine, independent of the popup's lifetime.
import {withTabReadDeadline} from './transport.js';
export function parseResult(text) {
  const candidates = [text.trim(), ...Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g), m=>m[1].trim())];
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start>=0&&end>start)candidates.push(text.slice(start,end+1));
  for(const candidate of candidates){try{const value=JSON.parse(candidate);if(value&&typeof value==='object'&&!Array.isArray(value))return value}catch{}}
  throw new Error('Câu trả lời chưa phải JSON hợp lệ. Kiểm tra tab AI rồi tiếp tục lấy kết quả; không gửi lại prompt.');
}

export async function parseBridgeResult(text,request,job) {
  try{return parseResult(text)}catch{
    // The app owns conservative syntax recovery and still validates the result
    // contract on completion. Valid JSON never needs this extra request.
    const response=await request('/jobs/'+job.id+'/parse-result','POST',{result:text,attempt:job.attempt});
    if(!response.result||typeof response.result!=='object'||Array.isArray(response.result))throw new Error('Câu trả lời chưa phải JSON hợp lệ.');
    return response.result;
  }
}

export function createAutomaticBridge({chrome,request,ensureContent,captureRaw,now=()=>Date.now(),readTimeoutMs=12000,pageSettleMs=5000}) {
  let busy=false,storageQueue=Promise.resolve();
  const read=async()=> (await chrome.storage.local.get('autoBridge')).autoBridge||{enabled:false,phase:'idle',message:'Tự động đang tắt.'};
  const write=(state,explicit=false)=>{
    const operation=storageQueue.then(async()=>{
      const current=(await chrome.storage.local.get('autoBridge')).autoBridge;
      if(current&&!explicit)state={...state,enabled:current.enabled};
      await chrome.storage.local.set({autoBridge:state});return state;
    });
    storageQueue=operation.catch(()=>{});return operation;
  };
  const stillEnabled=async()=>{if(!(await read()).enabled)throw new Error('Tự động đã tắt. Bật lại để tiếp tục; không tự gửi lại prompt.')};
  const textJob=job=>['chatgpt','gemini'].includes(job.provider)&&!['image_generation','video_generation','tts_context'].includes(job.kind);
  const collectionWindow=state=>Math.min(30*60*1000,Math.max(15*60*1000,(state.timeout||180)*1000));
  const collectingMessage='AI đang tạo nội dung. Đang tiếp tục chờ và lấy kết quả; không gửi lại prompt.';
  const recoverablePreparation=error=>['INPUT_NOT_READY','EDITOR_CHANGED','TAB_READ_TIMEOUT'].includes(error.code)||
    /Prompt field not found|message channel closed|message port closed|Response port closed|Receiving end does not exist|Could not establish connection|frame was removed/i.test(error.message||'');
  async function waitForComposer(state){
    const prepareChecks=(state.prepareChecks||0)+1;
    if(prepareChecks>8||now()>state.deadline)return false;
    const message='Đang chờ ô nhập AI/kết nối tab sẵn sàng ('+prepareChecks+'/8); chưa gửi yêu cầu.';
    await write({...state,phase:'opening',prepareChecks,prepareRetryAt:now()+2000,message});
    try{await request('/jobs/'+state.jobId+'/status','POST',{step:message})}catch{}
    return true;
  }
  const retryCode=state=>state.retryStopped?null:state.retryCode||(/chưa phải JSON hợp lệ/.test(state.message||'')?'INVALID_JSON':/Chưa có nút gửi khả dụng/.test(state.message||'')?'SEND_NOT_READY':null);
  const collectionExpired=state=>now()>(state.collectionDeadline||(state.deadline+collectionWindow(state)));
  const collectionTimeout=()=>new Error('Đã hết thời gian chờ tối đa để lấy kết quả. Kiểm tra tab AI rồi bấm Tiếp tục; không gửi lại prompt.');
  async function queueRetry(state,code){
    const reason={INVALID_JSON:'câu trả lời không phải JSON.',SEND_NOT_READY:'chưa có nút gửi khả dụng.',RETENTION_EVIDENCE:'trích dẫn chưa khớp mốc thời gian; sẽ đánh giá lại từng khoảng.'};
    const message='Tự động chờ 30 giây rồi thử lại bằng yêu cầu mới: '+reason[code];
    await write({...state,phase:'retry_wait',retryCode:code,retryAt:now()+30000,retryId:crypto.randomUUID(),message});
    try{await request('/jobs/'+state.jobId+'/status','POST',{step:message})}catch{}
  }
  async function setEnabled(enabled){
    const state=await read();
    await write({...state,enabled,message:enabled?'Đã bật tự động. Đang kiểm tra hàng đợi…':'Tự động đã tắt. Các tác vụ được giữ nguyên.'},true);
    return read();
  }
  async function resume(){
    const state=await read();
    const phase=state.phase==='paused'?(state.resumePhase||'idle'):state.phase;
    // A prepared job has never authorized Send. Retry filling in a fresh tab,
    // preserving any draft in the previous tab (including one filled by 1.1.0).
    const reset=phase==='prepared'?{phase:'opening',tabId:undefined,baseline:undefined}:{phase};
    return write({...state,...reset,enabled:true,deadline:now()+Math.max(30000,(state.timeout||180)*1000),collectionDeadline:phase==='submitted'?now()+collectionWindow(state):undefined,previous:'',stable:0,sendChecks:0,jsonChecks:0,jsonRetryAt:0,prepareChecks:0,prepareRetryAt:0,message:'Đang tiếp tục. Prompt đã gửi sẽ không được gửi lại.'},true);
  }
  async function tick(){
    if(busy)return;
    busy=true;let state;
    try{
      state=await read();
      // A saved result is final even when closing its dedicated tab fails.
      if(state.phase==='closing'){
        try{
          const tab=await chrome.tabs.get(state.tabId);
          if(state.ownedTab&&tab.url===state.resultUrl&&(!tab.pendingUrl||tab.pendingUrl===tab.url))await chrome.tabs.remove(state.tabId);
        }catch{/* The tab may already be closed. Never resubmit an accepted result. */}
        await write({enabled:true,phase:'idle',message:'Đã nhận và lưu kết quả. Đang kiểm tra tác vụ tiếp theo…'});
        return;
      }
      if(!state.enabled)return;
      const {items}=await request('/jobs');
      let job=items.find(j=>j.id===state.jobId&&j.attempt===state.attempt);
      if(state.jobId&&!job){state=await write({enabled:true,phase:'idle',message:'Tác vụ trước đã hoàn tất hoặc đã hủy.'})}
      if(state.phase==='paused'){
        // Read the already-sent answer once after upgrading a legacy retention
        // pause. The app will accept valid evidence or authorize a bounded retry.
        if(!state.retentionRecovered&&job?.kind==='retention_audit'&&state.owner&&state.tabId&&state.baseline&&
           state.resumePhase==='submitted'&&/Retention (?:(?:issue )?evidence does not belong|judgments need exact evidence)/.test(state.message||'')){
          const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
          if(claim.phase==='sent')await write({...state,phase:'submitted',retentionRecovered:true,previous:'',stable:0,
            deadline:now()+Math.max(30000,(state.timeout||180)*1000),collectionDeadline:now()+collectionWindow(state),
            message:'Đang kiểm tra lại trích dẫn theo thời gian sau bản sửa lỗi; chưa gửi yêu cầu mới.'});
          return;
        }
        // Recover collection once with the updated renderer, even if an older
        // version already extended its timeout. A sent claim resumes reads only.
        if(!state.rendererRecovered&&job&&textJob(job)&&state.owner&&state.tabId&&state.baseline&&
           state.resumePhase==='submitted'&&/hết thời gian chờ|message channel closed|message port closed|Response port closed/i.test(state.message||'')){
          const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
          if(claim.phase==='sent'){
            const message='Đang tiếp tục lấy câu trả lời đã gửi sau bản sửa lỗi; không gửi lại prompt.';
            await write({...state,phase:'submitted',rendererRecovered:true,collectionRecovered:true,deadline:now()+Math.max(30000,(state.timeout||180)*1000),
              collectionDeadline:now()+collectionWindow(state),previous:'',stable:0,jsonChecks:0,jsonRetryAt:0,message});
            try{await request('/jobs/'+job.id+'/status','POST',{step:message})}catch{}
          }
          return;
        }
        // Repair a previously paused 1.1.5 pre-send failure once on upgrade.
        // The backend must confirm Send has NEVER been authorized for this attempt.
        if(!state.preparationRecovered&&job&&textJob(job)&&state.owner&&
           ['opening','prepared'].includes(state.resumePhase)&&recoverablePreparation({message:state.message})){
          const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
          if(claim.phase==='claimed')await write({...state,phase:'opening',preparationRecovered:true,prepareChecks:0,
            prepareRetryAt:0,deadline:now()+Math.max(30000,(state.timeout||180)*1000),message:'Đang kết nối lại ô nhập AI sau bản sửa lỗi.'});
          return;
        }
        // Upgrade an already-paused 1.1.4 job without requiring a popup click.
        const code=retryCode(state);
        if(job&&textJob(job)&&state.owner&&code)await queueRetry(state,code);
        return;
      }
      if(state.phase==='retry_wait'){
        if(now()<state.retryAt)return;
        await stillEnabled();
        await request('/jobs/'+job.id+'/retry','POST',{owner:state.owner,attempt:state.attempt,retry_id:state.retryId,reason:state.retryCode});
        await write({enabled:true,phase:'idle',message:'Đã tự thử lại. Đang mở tab để gửi yêu cầu mới…'});
        return;
      }
      if(!job){
        job=items.find(textJob);
        if(!job){await write({...state,message:items.length?'Công việc còn lại cần tạo/tải media thủ công.':'Đang chờ tác vụ văn bản mới…'});return}
        const data=await chrome.storage.local.get('autoClientId');
        const owner=data.autoClientId||crypto.randomUUID();
        if(!data.autoClientId)await chrome.storage.local.set({autoClientId:owner});
        const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner,attempt:job.attempt});
        state=await write({enabled:true,phase:'opening',jobId:job.id,attempt:job.attempt,owner,timeout:job.timeout||180,deadline:now()+Math.max(30000,(job.timeout||180)*1000),message:'Đang mở tab AI cho '+job.kind});
        if(claim.phase==='sent')throw new Error('Tác vụ này đã được gửi trước đó nhưng thiếu trạng thái tab. Hãy lấy kết quả thủ công, không gửi lại.');
      }
      const status=async message=>{await request('/jobs/'+job.id+'/status','POST',{step:message});await write({...await read(),message})};
      const message=async(action,extra={})=>{
        const tab=await chrome.tabs.get(state.tabId);
        if(new URL(tab.url).origin!==new URL(job.url).origin)throw new Error('Tab AI đã chuyển trang. Mở lại đúng nhà cung cấp rồi tiếp tục.');
        const readOnly=['auto-poll','auto-ready'].includes(action);
        const send=()=>chrome.tabs.sendMessage(state.tabId,{type:'storyforge',action,jobKey:job.id+':'+job.attempt,...(readOnly?{}:{prompt:job.prompt}),...extra});
        const result=await (readOnly?withTabReadDeadline(send,readTimeoutMs):send());
        if(!result?.ok)throw Object.assign(new Error(result?.error||'Tab AI chưa sẵn sàng. Kiểm tra trang rồi tiếp tục.'),{code:result?.code||(!result&&readOnly?'TAB_READ_TIMEOUT':undefined)});
        return {...result,tabUrl:tab.url};
      };
      await stillEnabled();
      if(state.phase==='opening'){
        if(now()>state.deadline)throw new Error('Trang AI chưa tải ổn định trong thời gian chờ. Kiểm tra tab rồi bấm Tiếp tục; chưa gửi yêu cầu.');
        if(state.prepareRetryAt&&now()<state.prepareRetryAt)return;
        if(!state.tabId){
          // Dedicated job tabs never overwrite an existing user draft/conversation.
          const tab=await chrome.tabs.create({url:job.url,active:true});
          state=await write({...state,tabId:tab.id,ownedTab:true,pageCompleteAt:undefined,pageCompleteUrl:undefined});
          await chrome.storage.local.set({['tab_'+job.id]:tab.id});
        }
        const tab=await chrome.tabs.get(state.tabId);
        if(tab.status!=='complete'||tab.pendingUrl){
          state=await write({...state,pageCompleteAt:undefined,pageCompleteUrl:undefined});
          return;
        }
        if(state.pageCompleteAt==null||state.pageCompleteUrl!==tab.url){
          state=await write({...state,pageCompleteAt:now(),pageCompleteUrl:tab.url});
        }
        if(now()-state.pageCompleteAt<pageSettleMs){
          const waiting='Trang AI đã tải. Đang chờ thêm 5 giây để giao diện ổn định; chưa điền prompt.';
          if(state.message!==waiting)await status(waiting);
          return;
        }
        await ensureContent(state.tabId);
        const readiness=await message('auto-ready');
        if(!readiness.ready){
          const waiting='Đang chờ ô nhập AI ổn định ít nhất 2 giây; chưa điền prompt.';
          if(state.message!==waiting)await status(waiting);
          return;
        }
        await stillEnabled();
        const prepared=await message('auto-prepare');
        if(prepared.ready===false){
          if(state.message!==prepared.message)await status(prepared.message||'Đang chờ Paste prompt hoàn tất; chưa gửi.');
          return;
        }
        const {baseline}=prepared;
        state=await write({...state,phase:'prepared',baseline});
        await status('Đã điền prompt. Đang gửi tự động…');
      }
      if(state.phase==='prepared'){
        await stillEnabled();
        try{await message('auto-check-send',{baseline:state.baseline})}catch(error){
          if(error.code!=='SEND_NOT_READY')throw error;
          const sendChecks=(state.sendChecks||0)+1;
          if(sendChecks>=5||now()>state.deadline)throw Object.assign(new Error('Chưa có nút gửi khả dụng sau các lần kiểm tra.'),{code:'SEND_NOT_READY'});
          state=await write({...state,sendChecks});
          await status('Đang chờ nút gửi khả dụng ('+sendChecks+'/5); yêu cầu chưa được gửi.');
          return;
        }
        // Persist uncertainty BEFORE authorizing/clicking. A worker restart must
        // collect or pause, never click Send a second time.
        state=await write({...state,phase:'submitted',deadline:now()+Math.max(30000,state.timeout*1000),collectionDeadline:now()+collectionWindow(state),previous:'',stable:0});
        const permit=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt,authorize_send:true});
        if(!permit.send)throw new Error('Lượt gửi đã được ghi nhận. Chỉ tiếp tục lấy kết quả; không tự gửi lại.');
        await stillEnabled();
        await message('auto-send',{baseline:state.baseline});
        await status('Đã gửi tự động. Đang chờ câu trả lời mới…');
        return;
      }
      if(state.phase==='submitted'){
        if(collectionExpired(state))throw collectionTimeout();
        if(state.pollRetryAt&&now()<state.pollRetryAt)return;
        await ensureContent(state.tabId);
        const result=await message('auto-poll',{baseline:state.baseline});
        const collectionDeadline=state.collectionDeadline||(state.deadline+collectionWindow(state));
        if(now()>collectionDeadline)throw collectionTimeout();
        state=await write({...state,pollRetryAt:0,pollErrors:0,lastPollAt:now(),
          // Diagnostic counters only; no prompt or response content in logs.
          capture:result.capture||{characters:result.text?.length||0,busy:!!result.busy}});
        // Extend the inactivity deadline while the provider is actively working
        // or the response grows. The hard limit above prevents an endless wait.
        if(result.busy||(result.text&&result.text!==state.previous)){
          state=await write({...state,collectionDeadline,deadline:now()+Math.max(30000,(state.timeout||180)*1000)});
          if(result.busy&&state.message!==collectingMessage){await status(collectingMessage);state=await read()}
        }
        if(result.text&&!result.busy){
          const stable=result.text===state.previous?(state.stable||0)+1:0;
          state=await write({...state,previous:result.text,stable,stableSince:result.text===state.previous?state.stableSince:now()});
          if(stable===0){await status('Đã đọc được câu trả lời ('+result.text.length+' ký tự). Đang kiểm tra nội dung hoàn chỉnh…');state=await read()}
          if(stable>=3&&now()-(state.stableSince||0)>=4500){
            if(state.jsonRetryAt&&now()<state.jsonRetryAt&&now()<state.deadline)return;
            let output;
            try{
              try{output=parseResult(result.text)}catch(error){
                let text=result.text;
                // Prefer the provider's source text when rendering consumed
                // escapes. A failed/stale Copy still stops this collection.
                if(captureRaw&&result.copyTarget)text=(await captureRaw(state.tabId,result.copyTarget)).text;
                output=await parseBridgeResult(text,request,{id:job.id,attempt:state.attempt});
              }
            }catch(error){
              const jsonChecks=(state.jsonChecks||0)+1;
              if(jsonChecks>=5||now()>state.deadline)throw Object.assign(new Error('Câu trả lời vẫn chưa phải JSON hợp lệ sau các lần chờ.'),{code:'INVALID_JSON'});
              state=await write({...state,jsonChecks,jsonRetryAt:now()+5000});
              await status('Đang chờ câu trả lời JSON hoàn chỉnh ('+jsonChecks+'/5); không gửi lại yêu cầu.');
              return;
            }
            await stillEnabled();
            await request('/jobs/'+job.id+'/result','POST',{result:output,attempt:state.attempt});
            await write({...state,phase:'closing',resultUrl:result.tabUrl,message:'Đã lưu kết quả. Đang đóng tab AI của tác vụ…'});
            return;
          }
        }else if(state.stable||state.previous){state=await write({...state,stable:0,previous:''})}
        if(now()>state.deadline){
          const waiting='Đang tiếp tục chờ câu trả lời trong giới hạn thu kết quả; không gửi lại prompt.';
          if(state.message!==waiting)await status(waiting);
        }
      }
    }catch(error){
      const current=await read();
      // Reconnect reads in the SAME tab/attempt. A closed message channel after
      // Send is not a reason to require a popup click or issue another prompt.
      if(current.phase==='submitted'&&!collectionExpired(current)&&
         (['TAB_READ_TIMEOUT','TAB_READ_UNAVAILABLE'].includes(error.code)||recoverablePreparation(error))){
        const message='Tab AI đang chậm hoặc mất kết nối. Tự kết nối lại để lấy câu trả lời; không gửi lại prompt.';
        await write({...current,pollErrors:(current.pollErrors||0)+1,pollRetryAt:now()+5000,
          previous:'',stable:0,message});
        if(current.message!==message){try{await request('/jobs/'+current.jobId+'/status','POST',{step:message})}catch{}}
        return;
      }
      if(['opening','prepared'].includes(current.phase)&&recoverablePreparation(error)){
        if(await waitForComposer(current))return;
        // One bounded wait sequence; further attempts require the user's Resume.
        await write({...current,phase:'paused',preparationRecovered:true,resumePhase:current.phase,
          message:'Chưa kết nối được ô nhập AI sau các lần chờ. Kiểm tra tab ChatGPT, tải lại trang rồi bấm Tiếp tục.'});
        if(current.jobId){try{await request('/jobs/'+current.jobId+'/status','POST',{step:'Tự động tạm dừng: Chưa kết nối được ô nhập AI sau các lần chờ. Tải lại tab rồi tiếp tục.'})}catch{}}
        return;
      }
      if(['INVALID_JSON','SEND_NOT_READY','RETENTION_EVIDENCE'].includes(error.code)){
        await queueRetry(current,error.code);return;
      }
      // Missing/local app connection is recoverable without re-sending anything.
      const message=error.message||String(error);
      await write({...current,phase:'paused',rendererRecovered:current.phase==='submitted'?true:current.rendererRecovered,collectionRecovered:current.phase==='submitted'?true:current.collectionRecovered,retryStopped:current.phase==='retry_wait'||current.retryStopped,resumePhase:current.phase==='paused'?current.resumePhase:current.phase,message});
      if(current.jobId){try{await request('/jobs/'+current.jobId+'/status','POST',{step:'Tự động tạm dừng: '+message})}catch{}}
    }finally{busy=false}
  }
  return {read,setEnabled,resume,tick};
}
