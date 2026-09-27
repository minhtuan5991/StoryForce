// One persisted state machine, independent of the popup's lifetime.
export function parseResult(text) {
  const candidates = [text.trim(), ...Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g), m=>m[1].trim())];
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start>=0&&end>start)candidates.push(text.slice(start,end+1));
  for(const candidate of candidates){try{const value=JSON.parse(candidate);if(value&&typeof value==='object'&&!Array.isArray(value))return value}catch{}}
  throw new Error('Câu trả lời chưa phải JSON hợp lệ. Kiểm tra tab AI rồi tiếp tục lấy kết quả; không gửi lại prompt.');
}

export function createAutomaticBridge({chrome,request,ensureContent,now=()=>Date.now()}) {
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
  const recoverablePreparation=error=>['INPUT_NOT_READY','EDITOR_CHANGED'].includes(error.code)||
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
  async function queueRetry(state,code){
    const message='Tự động chờ 30 giây rồi thử lại bằng yêu cầu mới: '+(code==='INVALID_JSON'?'câu trả lời không phải JSON.':'chưa có nút gửi khả dụng.');
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
    return write({...state,...reset,enabled:true,deadline:now()+Math.max(30000,(state.timeout||180)*1000),previous:'',stable:0,sendChecks:0,jsonChecks:0,jsonRetryAt:0,prepareChecks:0,prepareRetryAt:0,message:'Đang tiếp tục. Prompt đã gửi sẽ không được gửi lại.'},true);
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
        const result=await chrome.tabs.sendMessage(state.tabId,{type:'storyforge',action,jobKey:job.id+':'+job.attempt,prompt:job.prompt,...extra});
        if(!result?.ok)throw Object.assign(new Error(result?.error||'Tab AI chưa sẵn sàng. Kiểm tra trang rồi tiếp tục.'),{code:result?.code});
        return {...result,tabUrl:tab.url};
      };
      await stillEnabled();
      if(state.phase==='opening'){
        if(state.prepareRetryAt&&now()<state.prepareRetryAt)return;
        if(!state.tabId){
          // Dedicated job tabs never overwrite an existing user draft/conversation.
          const tab=await chrome.tabs.create({url:job.url,active:true});
          state=await write({...state,tabId:tab.id,ownedTab:true});
          await chrome.storage.local.set({['tab_'+job.id]:tab.id});
        }
        const tab=await chrome.tabs.get(state.tabId);
        if(tab.status!=='complete'){
          if(now()>state.deadline)throw new Error('Tab AI tải quá lâu. Kiểm tra kết nối và đăng nhập rồi tiếp tục.');
          return;
        }
        await ensureContent(state.tabId);
        const {baseline}=await message('auto-prepare');
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
        state=await write({...state,phase:'submitted',deadline:now()+Math.max(30000,state.timeout*1000),previous:'',stable:0});
        const permit=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt,authorize_send:true});
        if(!permit.send)throw new Error('Lượt gửi đã được ghi nhận. Chỉ tiếp tục lấy kết quả; không tự gửi lại.');
        await stillEnabled();
        await message('auto-send',{baseline:state.baseline});
        await status('Đã gửi tự động. Đang chờ câu trả lời mới…');
        return;
      }
      if(state.phase==='submitted'){
        await ensureContent(state.tabId);
        const result=await message('auto-poll',{baseline:state.baseline});
        if(result.text&&!result.busy){
          const stable=result.text===state.previous?(state.stable||0)+1:0;
          state=await write({...state,previous:result.text,stable,stableSince:result.text===state.previous?state.stableSince:now()});
          if(stable>=3&&now()-(state.stableSince||0)>=4500){
            if(state.jsonRetryAt&&now()<state.jsonRetryAt&&now()<state.deadline)return;
            let output;
            try{output=parseResult(result.text)}catch(error){
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
        if(now()>state.deadline)throw new Error('Đã hết thời gian chờ. Kiểm tra tab AI rồi bấm Tiếp tục lấy kết quả; prompt không được gửi lại.');
      }
    }catch(error){
      const current=await read();
      if(['opening','prepared'].includes(current.phase)&&recoverablePreparation(error)){
        if(await waitForComposer(current))return;
        // One bounded wait sequence; further attempts require the user's Resume.
        await write({...current,phase:'paused',preparationRecovered:true,resumePhase:current.phase,
          message:'Chưa kết nối được ô nhập AI sau các lần chờ. Kiểm tra tab ChatGPT, tải lại trang rồi bấm Tiếp tục.'});
        if(current.jobId){try{await request('/jobs/'+current.jobId+'/status','POST',{step:'Tự động tạm dừng: Chưa kết nối được ô nhập AI sau các lần chờ. Tải lại tab rồi tiếp tục.'})}catch{}}
        return;
      }
      if(['INVALID_JSON','SEND_NOT_READY'].includes(error.code)){
        await queueRetry(current,error.code);return;
      }
      // Missing/local app connection is recoverable without re-sending anything.
      const message=error.message||String(error);
      await write({...current,phase:'paused',retryStopped:current.phase==='retry_wait'||current.retryStopped,resumePhase:current.phase==='paused'?current.resumePhase:current.phase,message});
      if(current.jobId){try{await request('/jobs/'+current.jobId+'/status','POST',{step:'Tự động tạm dừng: '+message})}catch{}}
    }finally{busy=false}
  }
  return {read,setEnabled,resume,tick};
}
