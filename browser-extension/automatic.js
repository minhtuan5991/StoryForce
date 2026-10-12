// One persisted state machine, independent of the popup's lifetime.
import {withTabReadDeadline,isTabEditBusy} from './transport.js';
import {AI_PAGE_SETTLE_MS} from './preparation-timing.js';
import {OUTPUT_REASONS,responseObstacle} from './response-recovery.js';
export function parseResult(text) {
  const candidates = [text.trim(), ...Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g), m=>m[1].trim())];
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(!text.trim().startsWith('[')&&start>=0&&end>start)candidates.push(text.slice(start,end+1));
  for(const candidate of candidates){try{const value=JSON.parse(candidate);if(value&&typeof value==='object'&&!Array.isArray(value))return value}catch{}}
  throw new Error('Câu trả lời chưa phải JSON hợp lệ. Kiểm tra tab AI rồi tiếp tục lấy kết quả; không gửi lại prompt.');
}

export async function parseBridgeResult(text,request,job) {
  try{return parseResult(text)}catch{
    // The app owns conservative syntax recovery and still validates the result
    // contract on completion. Valid JSON never needs this extra request.
    const response=await request('/jobs/'+job.id+'/parse-result','POST',{result:text,attempt:job.attempt,
      ...(job.repairId?{repair_id:job.repairId}:{})});
    if(!response.result||typeof response.result!=='object'||Array.isArray(response.result))throw new Error('Câu trả lời chưa phải JSON hợp lệ.');
    return response.result;
  }
}

export function createAutomaticBridge({chrome,request,ensureContent,captureRaw,captureFile,now=()=>Date.now(),readTimeoutMs=12000,pageSettleMs=AI_PAGE_SETTLE_MS}) {
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
  async function waitForTabEdit(state){
    if(now()>state.deadline)return false;
    const tabEditChecks=(state.tabEditChecks||0)+1;
    const delay=Math.min(8000,2000*2**Math.min(tabEditChecks-1,2));
    const message='Trình duyệt đang tạm khóa thao tác tab. Tự chờ rồi mở lại tab AI; chưa gửi yêu cầu.';
    await write({...state,tabEditChecks,tabEditRetryAt:now()+delay,message});
    if(state.message!==message){try{await request('/jobs/'+state.jobId+'/status','POST',{step:message})}catch{}}
    return true;
  }
  const retryCode=state=>state.retryStopped?null:state.retryCode||(/chưa phải JSON hợp lệ/.test(state.message||'')?'INVALID_JSON':/Chưa có nút gửi khả dụng/.test(state.message||'')?'SEND_NOT_READY':null);
  const collectionExpired=state=>now()>(state.collectionDeadline||(state.deadline+collectionWindow(state)));
  const collectionTimeout=()=>new Error('Đã hết thời gian chờ tối đa để lấy kết quả. Kiểm tra tab AI rồi bấm Tiếp tục; không gửi lại prompt.');
  async function queueRetry(state,code){
    const message=code==='SEND_NOT_READY'?'Tự động chờ 30 giây rồi thử kết nối nút gửi bằng tab mới.':
      'Câu trả lời sau khi sửa vẫn chưa hợp lệ. Đang thử một yêu cầu mới với cùng AI.';
    await write({...state,phase:'retry_wait',retryCode:code,retryAt:now()+(code==='SEND_NOT_READY'?30000:0),retryId:crypto.randomUUID(),message});
    try{await request('/jobs/'+state.jobId+'/status','POST',{step:message})}catch{}
  }
  async function recoverOutput(state,error){
    if(state.responseRetries>=1){
      const message='Đã sửa trong chat cũ và thử yêu cầu mới với cùng AI nhưng kết quả vẫn chưa hợp lệ. Tạm dừng tác vụ: '+error.message;
      await write({...state,phase:'paused',resumePhase:'submitted',retryStopped:true,message});
      try{await request('/jobs/'+state.jobId+'/status','POST',{step:message})}catch{}
      return;
    }
    if(state.repair){await queueRetry(state,error.code);return}
    const message='Câu trả lời chưa hợp lệ. Đang yêu cầu AI viết lại một lần trong đúng cuộc trò chuyện này.';
    await write({...state,phase:'repair_request',repairId:state.repairId||crypto.randomUUID(),repairReason:error.code,message});
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
    const reset=phase==='prepared'?{phase:'opening',...(state.repair?{}:{tabId:undefined,baseline:undefined})}:{phase};
    return write({...state,...reset,enabled:true,deadline:now()+Math.max(30000,(state.timeout||180)*1000),collectionDeadline:phase==='submitted'?now()+collectionWindow(state):undefined,previous:'',stable:0,emptySince:0,emptyChecks:0,sendChecks:0,jsonChecks:0,jsonRetryAt:0,prepareChecks:0,prepareRetryAt:0,tabEditChecks:0,tabEditRetryAt:0,message:'Đang tiếp tục. Prompt đã gửi sẽ không được gửi lại.'},true);
  }
  async function tick(){
    if(busy)return;
    busy=true;let state;
    try{
      state=await read();
      // A saved result is final even when closing its dedicated tab fails.
      if(state.phase==='closing'){
        if(state.closeRetryAt&&now()<state.closeRetryAt)return;
        try{
          const tab=await chrome.tabs.get(state.tabId);
          if(state.ownedTab&&tab.url===state.resultUrl&&(!tab.pendingUrl||tab.pendingUrl===tab.url))await chrome.tabs.remove(state.tabId);
        }catch(error){
          if(isTabEditBusy(error)&&(state.closeEditChecks||0)<5){
            await write({...state,closeEditChecks:(state.closeEditChecks||0)+1,closeRetryAt:now()+2000,
              message:'Đã lưu kết quả. Trình duyệt tạm khóa tab; đang chờ đóng tab của tác vụ.'});
            return;
          }
          // The tab may already be closed. Never resubmit an accepted result.
        }
        await write({enabled:true,phase:'idle',message:state.retryClosing?'Đã đóng tab lỗi. Đang mở yêu cầu mới với cùng AI…':'Đã nhận và lưu kết quả. Đang kiểm tra tác vụ tiếp theo…'});
        return;
      }
      if(!state.enabled)return;
      // Finish an idempotent retry even if its queued/new attempt has replaced
      // the rejected attempt in /jobs after a lost HTTP response.
      if(state.phase==='retry_wait'&&(state.retryCode==='SEND_NOT_READY'||state.repair)){
        if(now()<state.retryAt)return;
        await stillEnabled();
        await request('/jobs/'+state.jobId+'/retry','POST',{owner:state.owner,attempt:state.attempt,retry_id:state.retryId,
          reason:state.retryCode,...(state.repair?{repair_id:state.repair.id}:{})});
        await write({...state,phase:'closing',retryClosing:true,resultUrl:state.responseUrl||state.pageCompleteUrl,
          message:'Đã lưu lỗi và xếp yêu cầu mới. Đang đóng tab AI lỗi của tác vụ…'});
        return;
      }
      const {items}=await request('/jobs');
      let job=items.find(j=>j.id===state.jobId&&j.attempt===state.attempt);
      if(state.jobId&&!job){state=await write({enabled:true,phase:'idle',message:'Tác vụ trước đã hoàn tất hoặc đã hủy.'})}
      if(job)state=await write({...state,responseRetries:job.response_retry_count||0});
      if(state.phase==='paused'){
        // Revalidate the existing metadata answer once after a schema fix. An
        // already-sent claim can authorize collection only, never another Send.
        if(!state.metadataRecovered&&job?.kind==='youtube_metadata'&&state.owner&&state.tabId&&state.baseline&&
           state.resumePhase==='submitted'&&/validation errors? for YouTubeMetadata/.test(state.message||'')){
          const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
          if(claim.phase==='sent'){
            const message='Đang đọc lại thông tin YouTube đã tạo sau bản sửa lỗi; không gửi lại prompt.';
            await write({...state,phase:'submitted',metadataRecovered:true,previous:'',stable:0,jsonChecks:0,jsonRetryAt:0,
              pollRetryAt:0,deadline:now()+Math.max(30000,(state.timeout||180)*1000),collectionDeadline:now()+collectionWindow(state),message});
            try{await request('/jobs/'+job.id+'/status','POST',{step:message})}catch{}
          }
          return;
        }
        // A legacy tab-strip rejection happened before Send. Recover the SAME
        // attempt only after the backend confirms it has never authorized Send.
        if(!state.tabEditRecovered&&job&&textJob(job)&&state.owner&&
           ['opening','prepared'].includes(state.resumePhase)&&isTabEditBusy({message:state.message})){
          const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
          if(claim.phase==='claimed'){
            const message='Đang mở lại tab AI sau bản sửa lỗi khóa tab; chưa gửi yêu cầu.';
            await write({...state,phase:'opening',tabEditRecovered:true,tabEditChecks:0,tabEditRetryAt:0,
              prepareChecks:0,prepareRetryAt:0,deadline:now()+Math.max(30000,(state.timeout||180)*1000),message});
            try{await request('/jobs/'+job.id+'/status','POST',{step:message})}catch{}
          }
          return;
        }
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
        if(job&&textJob(job)&&state.owner&&code){
          if(OUTPUT_REASONS.includes(code)&&state.tabId&&state.baseline){
            await write({...state,phase:'submitted',previous:'',stable:0,jsonChecks:0,jsonRetryAt:0,
              deadline:now()+Math.max(30000,(state.timeout||180)*1000),collectionDeadline:now()+collectionWindow(state),
              message:'Đang đọc lại câu trả lời đã gửi trước khi yêu cầu sửa trong chat cũ.'});
          }else if(code==='SEND_NOT_READY')await queueRetry(state,code);
        }
        return;
      }
      if(state.phase==='retry_wait'){
        // An older Bridge was about to create a new request without correcting
        // the reply. Re-read it once with the new rejection/turn checks first.
        await write({...state,phase:'submitted',previous:'',stable:0,jsonChecks:0,jsonRetryAt:0,
          deadline:now()+Math.max(30000,(state.timeout||180)*1000),collectionDeadline:now()+collectionWindow(state)});
        return;
      }
      if(state.phase==='repair_request'){
        await stillEnabled();
        const {repair}=await request('/jobs/'+job.id+'/repair','POST',{owner:state.owner,attempt:state.attempt,
          repair_id:state.repairId,reason:state.repairReason});
        if(repair.phase==='sent')throw new Error('Yêu cầu sửa đã được gửi nhưng thiếu mốc đọc kết quả. Hãy lấy kết quả thủ công; không tự gửi lại.');
        const tab=await chrome.tabs.get(state.tabId);
        if(tab.url!==state.responseUrl||tab.pendingUrl)throw new Error('Cuộc trò chuyện đã đổi. Mở lại đúng chat của tác vụ để yêu cầu sửa; không tự chuyển chat.');
        await write({...state,phase:'opening',repair,repairUrl:tab.url,baseline:undefined,previous:'',stable:0,
          emptyChecks:0,emptySince:0,sendChecks:0,jsonChecks:0,jsonRetryAt:0,pollRetryAt:0,
          prepareChecks:0,prepareRetryAt:0,deadline:now()+Math.max(30000,(state.timeout||180)*1000),
          pageCompleteAt:undefined,pageCompleteUrl:undefined,message:'Đang điền yêu cầu sửa trong chat cũ…'});
        return;
      }
      if(!job){
        job=items.find(textJob);
        if(!job){await write({...state,message:items.length?'Công việc còn lại cần tạo/tải media thủ công.':'Đang chờ tác vụ văn bản mới…'});return}
        const data=await chrome.storage.local.get('autoClientId');
        const owner=data.autoClientId||crypto.randomUUID();
        if(!data.autoClientId)await chrome.storage.local.set({autoClientId:owner});
        const {claim}=await request('/jobs/'+job.id+'/claim','POST',{owner,attempt:job.attempt});
        state=await write({enabled:true,phase:'opening',jobId:job.id,attempt:job.attempt,owner,responseRetries:job.response_retry_count||0,timeout:job.timeout||180,deadline:now()+Math.max(30000,(job.timeout||180)*1000),message:'Đang mở tab AI cho '+job.kind});
        if(claim.phase==='sent')throw new Error('Tác vụ này đã được gửi trước đó nhưng thiếu trạng thái tab. Hãy lấy kết quả thủ công, không gửi lại.');
      }
      const status=async message=>{await request('/jobs/'+job.id+'/status','POST',{step:message});await write({...await read(),message})};
      const message=async(action,extra={})=>{
        const tab=await chrome.tabs.get(state.tabId);
        if(new URL(tab.url).origin!==new URL(job.url).origin)throw new Error('Tab AI đã chuyển trang. Mở lại đúng nhà cung cấp rồi tiếp tục.');
        if(state.repair&&tab.url!==state.repairUrl)throw new Error('Tab đã chuyển sang cuộc trò chuyện khác. Không gửi yêu cầu sửa hoặc lấy kết quả nhầm chat.');
        const readOnly=['auto-poll','auto-ready'].includes(action);
        const send=()=>chrome.tabs.sendMessage(state.tabId,{type:'storyforge',action,
          jobKey:job.id+':'+job.attempt+(state.repair?':repair:'+state.repair.id:''),
          ...(readOnly?{}:{prompt:state.repair?.prompt||job.prompt}),...extra});
        const result=await (readOnly?withTabReadDeadline(send,readTimeoutMs):send());
        if(!result?.ok)throw Object.assign(new Error(result?.error||'Tab AI chưa sẵn sàng. Kiểm tra trang rồi tiếp tục.'),{code:result?.code||(!result&&readOnly?'TAB_READ_TIMEOUT':undefined)});
        return {...result,tabUrl:tab.url};
      };
      await stillEnabled();
      if(['opening','prepared'].includes(state.phase)&&state.tabEditRetryAt&&now()<state.tabEditRetryAt)return;
      if(state.phase==='opening'){
        if(now()>state.deadline)throw new Error('Trang AI chưa tải ổn định trong thời gian chờ. Kiểm tra tab rồi bấm Tiếp tục; chưa gửi yêu cầu.');
        if(state.prepareRetryAt&&now()<state.prepareRetryAt)return;
        if(!state.tabId){
          if(state.repair)throw new Error('Tab của yêu cầu sửa đã đóng. Hãy lấy kết quả thủ công; không tự gửi thêm.');
          // Dedicated job tabs never overwrite an existing user draft/conversation.
          const tab=await chrome.tabs.create({url:job.url,active:true});
          state=await write({...state,tabId:tab.id,ownedTab:true,tabEditChecks:0,tabEditRetryAt:0,pageCompleteAt:undefined,pageCompleteUrl:undefined});
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
        // Observe the composer during the page guard instead of adding a
        // second full wait after the page has already settled.
        const pageSettling=now()-state.pageCompleteAt<pageSettleMs;
        await ensureContent(state.tabId);
        const readiness=await message('auto-ready');
        if(pageSettling||!readiness.ready){
          const waiting=pageSettling?'Trang AI đã tải. Đang kiểm tra trang và ô nhập sẵn sàng; chưa điền prompt.':
            'Đang chờ ô nhập AI ổn định ít nhất 0,5 giây; chưa điền prompt.';
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
        const permit=state.repair?
          await request('/jobs/'+job.id+'/repair','POST',{owner:state.owner,attempt:state.attempt,
            repair_id:state.repair.id,reason:state.repair.reason,authorize_send:true}):
          await request('/jobs/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt,authorize_send:true});
        if(!permit.send)throw new Error('Lượt gửi đã được ghi nhận. Chỉ tiếp tục lấy kết quả; không tự gửi lại.');
        await stillEnabled();
        await message('auto-send',{baseline:state.baseline});
        await status(state.repair?'Đã gửi yêu cầu sửa trong chat cũ. Đang chờ câu trả lời mới…':'Đã gửi tự động. Đang chờ câu trả lời mới…');
        return;
      }
      if(state.phase==='submitted'){
        if(collectionExpired(state))throw collectionTimeout();
        if(state.pollRetryAt&&now()<state.pollRetryAt)return;
        await ensureContent(state.tabId);
        const result=await message('auto-poll',{baseline:state.baseline});
        const collectionDeadline=state.collectionDeadline||(state.deadline+collectionWindow(state));
        if(now()>collectionDeadline)throw collectionTimeout();
        state=await write({...state,pollRetryAt:0,pollErrors:0,lastPollAt:now(),responseUrl:result.tabUrl,
          // Diagnostic counters only; no prompt or response content in logs.
          capture:result.capture||{characters:result.text?.length||0,busy:!!result.busy}});
        // Extend the inactivity deadline while the provider is actively working
        // or the response grows. The hard limit above prevents an endless wait.
        if(result.busy||(result.text&&result.text!==state.previous)){
          state=await write({...state,collectionDeadline,deadline:now()+Math.max(30000,(state.timeout||180)*1000)});
          if(result.busy&&state.message!==collectingMessage){await status(collectingMessage);state=await read()}
        }
        // Retry only a NEW assistant turn with its own completion control. A
        // missing reply, an old empty turn or active reasoning is not a failure.
        if(result.emptyResponse&&!result.busy&&!result.text){
          const emptyChecks=(state.emptyChecks||0)+1,emptySince=state.emptySince||now();
          state=await write({...state,emptyChecks,emptySince});
          if(emptyChecks>=3&&now()-emptySince>=12000){
            await parseBridgeResult('',request,{id:job.id,attempt:state.attempt,repairId:state.repair?.id});
          }
          if(emptyChecks===1)await status('AI đã hoàn tất nhưng chưa có nội dung. Đang kiểm tra lại trước khi thử lại.');
        }else if(state.emptyChecks){state=await write({...state,emptyChecks:0,emptySince:0})}
        if(result.text&&!result.busy){
          const stable=result.text===state.previous?(state.stable||0)+1:0;
          state=await write({...state,previous:result.text,stable,stableSince:result.text===state.previous?state.stableSince:now()});
          if(stable===0){await status('Đã đọc được câu trả lời ('+result.text.length+' ký tự). Đang kiểm tra nội dung hoàn chỉnh…');state=await read()}
          if(stable>=3&&now()-(state.stableSince||0)>=4500){
            if(responseObstacle(result.text))throw new Error('AI đang báo giới hạn tài khoản hoặc yêu cầu đăng nhập. Kiểm tra tab rồi tiếp tục; không tự yêu cầu viết lại.');
            let output;
            if(result.fileTarget){
              if(!captureFile)throw Object.assign(new Error('Reload Bridge to read the JSON/TXT response file.'),{code:'FILE_RESPONSE_UNAVAILABLE'});
              let file;
              try{file=await captureFile(state.tabId,result.fileTarget)}catch(error){throw Object.assign(error,{code:'FILE_RESPONSE_UNAVAILABLE'})}
              output=await parseBridgeResult(file.text,request,{id:job.id,attempt:state.attempt,repairId:state.repair?.id});
            }else{
              try{output=parseResult(result.text)}catch(error){
                let text=result.text;
                // Prefer the provider's source text when rendering consumed
                // escapes. A failed/stale Copy still stops this collection.
                if(captureRaw&&result.copyTarget)text=(await captureRaw(state.tabId,result.copyTarget)).text;
                output=await parseBridgeResult(text,request,{id:job.id,attempt:state.attempt,repairId:state.repair?.id});
            }
              }
            await stillEnabled();
            await request('/jobs/'+job.id+'/result','POST',{result:output,attempt:state.attempt,
              ...(state.repair?{repair_id:state.repair.id}:{})});
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
      if(current.phase==='retry_wait'&&(!error.status||error.status>=500)&&(current.retryReconnects||0)<3){
        // A lost response may already have queued the new attempt. Reuse its
        // exact retry ID; never allocate a second retry or lose tab cleanup.
        const message='Đang kết nối lại để xác nhận lượt thử mới đã xếp; không tạo thêm yêu cầu.';
        await write({...current,retryAt:now()+3000,retryReconnects:(current.retryReconnects||0)+1,message});
        return;
      }
      if(['opening','prepared'].includes(current.phase)&&isTabEditBusy(error)){
        if(await waitForTabEdit(current))return;
        const message='Trình duyệt vẫn khóa thao tác tab sau thời gian chờ. Thả thao tác kéo tab, kiểm tra trình duyệt rồi bấm Tiếp tục; chưa gửi yêu cầu.';
        await write({...current,phase:'paused',tabEditRecovered:true,resumePhase:current.phase,message});
        if(current.jobId){try{await request('/jobs/'+current.jobId+'/status','POST',{step:'Tự động tạm dừng: '+message})}catch{}}
        return;
      }
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
      if(current.phase==='submitted'&&OUTPUT_REASONS.includes(error.code)){
        await recoverOutput(current,error);return;
      }
      if(error.code==='SEND_NOT_READY'&&!current.repair){
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
