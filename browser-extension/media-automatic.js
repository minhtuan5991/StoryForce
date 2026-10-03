// Durable media queue. Generations are authorized once; downloads are tracked by
// their exact ID/URL, never by whichever file happened to arrive most recently.
import {withTabReadDeadline} from './transport.js';

export function createMediaBridge({chrome,request,ensureContent,armCapture,readCapture,now=()=>Date.now(),pageSettleMs=5000}){
  let busy=false;
  const read=async()=> (await chrome.storage.local.get('mediaBridge')).mediaBridge||{phase:'idle',tabs:{}};
  const write=async state=>{await chrome.storage.local.set({mediaBridge:state});return state};
  const enabled=async()=>!!(await chrome.storage.local.get('autoBridge')).autoBridge?.enabled;
  const call=async(state,action,extra={})=>{
    const result=await withTabReadDeadline(()=>chrome.tabs.sendMessage(state.tabId,{type:'storyforge',action:'media-'+action,
      provider:state.provider,jobId:state.jobId,prompt:state.prompt,previousPrompt:state.prompts?.[state.tabId],media:state.media,baseline:state.baseline,...extra}));
    if(!result?.ok)throw Object.assign(new Error(result?.error||'Không kết nối được tab tạo tài nguyên'),{code:result?.code});
    return result;
  };
  const status=async(state,message)=>{
    if(state.message!==message){await write({...state,message});await request('/jobs/'+state.jobId+'/status','POST',{step:message})}
  };
  async function resume(){
    const s=await read();
    if(s.phase!=='paused')return s;
    let phase=s.resumePhase||'opening',download=s;
    if(phase==='downloading'&&s.downloadId){
      const [item]=await chrome.downloads.search({id:s.downloadId});
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
    if(busy||!await enabled())return;
    busy=true;
    let state=await read();
    try{
      const {items}=await request('/jobs');
      let job=items.find(j=>j.id===state.jobId&&j.attempt===state.attempt&&j.media);
      if(state.jobId&&!job){state=await write({phase:'idle',tabs:state.tabs||{},pages:state.pages||{},folders:state.folders||{},prompts:state.prompts||{},message:'Đã lưu hoặc dừng tác vụ media trước.'})}
      if(state.phase==='paused')return;
      if(!job){
        job=items.find(j=>j.media);
        if(!job)return;
        state=await write({phase:'opening',tabs:state.tabs||{},pages:state.pages||{},folders:state.folders||{},prompts:state.prompts||{},jobId:job.id,attempt:job.attempt,provider:job.provider,
          prompt:job.prompt,media:job.media,owner:crypto.randomUUID(),deadline:now()+30*60*1000,preparationDeadline:now()+180000});
        const {claim}=await request('/media/'+job.id+'/claim','POST',{owner:state.owner,attempt:state.attempt});
        if(claim.phase==='sent')throw new Error('Yêu cầu đã gửi từ một phiên khác. Kiểm tra tab trước khi tiếp tục.');
      }
      const permit={owner:state.owner,attempt:state.attempt};
      // Validate the batch, scene and explicit approval before every UI action.
      await request('/media/'+job.id+'/claim','POST',permit);
      if(now()>state.deadline)throw new Error('Đã hết thời gian chờ media. Kiểm tra tab rồi bấm Tiếp tục; không tạo lại yêu cầu.');
      if(['opening','prepared'].includes(state.phase)&&now()>state.preparationDeadline)throw new Error('Chưa chuẩn bị được tab media sau 3 phút. Kiểm tra cài đặt rồi tiếp tục; chưa tạo yêu cầu mới.');
      if(state.phase==='opening'){
        let tab;
        const key=state.provider;
        if(state.tabId){tab=await chrome.tabs.get(state.tabId)}
        else{
          const saved=state.tabs[key]||state.tabs[state.media.batch_id+':'+state.provider];
          if(saved){try{tab=await chrome.tabs.get(saved)}catch{}}
          if(tab&&state.provider==='flow'){
            const page=state.pages.flow;
            // Return from our own clip player to the same project for the next
            // scene. A different StoryForge project starts a new Flow project.
            if(state.folders.flow!==state.media.folder)tab=await chrome.tabs.update(tab.id,{url:job.url,active:true});
            else if(page&&tab.url?.startsWith(page+'/edit/'))tab=await chrome.tabs.update(tab.id,{url:page,active:true});
          }
          if(!tab)tab=await chrome.tabs.create({url:job.url,active:true});
          state=await write({...state,tabId:tab.id,tabs:{...state.tabs,[key]:tab.id},folders:{...state.folders,[key]:state.media.folder}});
        }
        const host=new URL(tab.url||job.url).hostname;
        const allowed={aistudio:['aistudio.google.com'],gemini:['gemini.google.com'],flow:['flow.google.com','labs.google']}[state.provider];
        if(!allowed.includes(host))throw new Error('Tab media đã chuyển sang trang khác. Mở lại dịch vụ để tiếp tục.');
        if(tab.status!=='complete'||tab.pendingUrl){await write({...state,pageReadyAt:0});return}
        if(!state.pageReadyAt){await write({...state,pageReadyAt:now()});return}
        if(now()-state.pageReadyAt<pageSettleMs)return;
        await ensureContent(state.tabId);
        const setup=await call(state,'setup');
        if(!setup.ready){await status(state,setup.message||'Đang chờ trang và cài đặt media sẵn sàng…');return}
        const prepared=await call(state,'prepare');
        const page=await chrome.tabs.get(state.tabId);
        state=await write({...state,phase:'prepared',baseline:prepared.baseline,pages:{...state.pages,[state.provider]:page.url},
          prompts:{...state.prompts,[state.tabId]:state.prompt},message:'Đã nhập nội dung, đang chờ nút tạo khả dụng…'});
        return;
      }
      if(state.phase==='prepared'){
        await ensureContent(state.tabId);
        const ready=await call(state,'ready');
        if(!ready.ready)return;
        if(!await enabled())return;
        const authorized=await request('/media/'+job.id+'/claim','POST',{...permit,authorize_send:true});
        // Persist BEFORE Run/Send: a lost message acknowledgement is ambiguous,
        // so recovery only polls this tab instead of spending credits twice.
        state=await write({...state,phase:'submitted',sentAt:now(),message:'Đang tạo '+state.media.filename+'…'});
        if(authorized.send)await call(state,'send');
        return;
      }
      if(state.phase==='submitted'){
        await ensureContent(state.tabId);
        const result=await call(state,'poll');
        if(!result.ready){await status(state,result.message||'Đang chờ media tạo xong; không gửi lại yêu cầu.');return}
        state=await write({...state,phase:'download_ready',result:result.result});
        return;
      }
      if(state.phase==='download_ready'){
        if(!await enabled())return;
        // Reloading the extension disconnects the old content listener even
        // though the generated audio/image/video is still present in the tab.
        await ensureContent(state.tabId);
        const download=await call(state,'download-info',{result:state.result});
        state=await write({...state,phase:'downloading',downloadAt:now(),downloadUrl:download.url,referrer:download.referrer,
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
            await armCapture(state.tabId,state.downloadTicket);
          }
          await call(state,'download-click',{result:state.result});
        }
        return;
      }
      if(state.phase==='downloading'){
        if(state.downloadTicket&&readCapture){
          const url=await readCapture(state.tabId,state.downloadTicket);
          if(!url&&state.provider==='flow')await call(state,'download-continue',{result:state.result});
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
          else if(now()-state.downloadAt>90000)throw new Error('Chưa nhận được file tải về. Kiểm tra nút tải trong tab; không tạo lại media.');
          else return;
        }
        const [item]=await chrome.downloads.search({id:state.downloadId});
        if(!item)throw new Error('Không tìm thấy lượt tải media này');
        if(item.state==='interrupted')throw new Error(item.error==='USER_CANCELED'
          ? 'Lượt tải đã bị hủy. Nếu Comet hiện Save As, tắt “Ask where to save each file before downloading” trong Settings → Downloads, rồi bấm Tiếp tục tải tài nguyên. Bridge sẽ tải lại kết quả đã tạo, không gửi lại prompt.'
          : 'Tải bị gián đoạn: '+(item.error||'kiểm tra trình duyệt'));
        if(item.state!=='complete')return;
        await request('/media/'+job.id+'/result','POST',{...permit,download_id:item.id,download_state:item.state,path:item.filename});
        // Only clear our own previous text once the completed file is imported.
        await write({phase:'idle',tabs:state.tabs,pages:state.pages,folders:state.folders,prompts:state.prompts,
          message:'Đã tải và gán '+state.media.filename+'. Đang chuyển sang scene tiếp theo…'});
      }
    }catch(error){
      state=await read();
      const errors=(state.errors||0)+1;
      const transient=['TAB_READ_TIMEOUT','INPUT_NOT_READY'].includes(error.code)||/message.*closed|Receiving end does not exist|Could not establish connection|Failed to fetch/i.test(error.message||'');
      if(transient&&errors<=8&&now()<state.deadline){
        await write({...state,errors,message:'Tab media đang tải hoặc mất kết nối. Đang chờ lại; không gửi trùng.'});
      }else{
        await write({...state,phase:'paused',resumePhase:state.phase,errors,message:error.message||String(error)});
        if(state.jobId){try{await request('/jobs/'+state.jobId+'/status','POST',{step:'Tạo media tạm dừng: '+error.message})}catch{}}
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
