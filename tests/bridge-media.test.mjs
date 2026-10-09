import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMediaBridge} from '../browser-extension/media-automatic.js';

function fixture(provider='aistudio'){
  const storage={autoBridge:{enabled:true}},messages=[],downloads=[];
  let time=1000,tabCount=0,runs=0,imports=0;const claims={};
  const makeJob=i=>({id:'media'+i,attempt:1,provider,url:provider==='flow'?'https://flow.google.com/project/test':'https://aistudio.google.com/generate-speech',prompt:'Audio '+i,
    media:{batch_id:'batch',folder:'Project',filename:(provider==='flow'?'scene_00':'tts_00')+i+(provider==='flow'?'.mp4':'.wav')}});
  const state={jobs:[makeJob(1)],tabStatus:'complete',ready:true,generated:true,lostRun:false};
  const chrome={storage:{local:{get:async k=>({[k]:structuredClone(storage[k])}),set:async values=>Object.assign(storage,structuredClone(values))}},
    tabs:{create:async()=>({id:++tabCount,url:makeJob(1).url,status:state.tabStatus}),get:async id=>({id,url:makeJob(1).url,status:state.tabStatus}),
      update:async(id,options)=>({id,url:options.url||makeJob(1).url,status:state.tabStatus}),
      sendMessage:async(id,m)=>{
        messages.push(m.action);state.lastMessage=m;
        if(m.action==='media-setup'||m.action==='media-ready')return {ok:true,ready:state.ready};
        if(m.action==='media-prepare')return {ok:true,baseline:['old']};
        if(m.action==='media-send'){runs++;if(state.lostRun)throw Error('message channel closed');return {ok:true}}
        if(m.action==='media-poll')return {ok:true,ready:state.generated,result:{url:'blob:new'}};
        if(m.action==='media-download-info')return {ok:true,url:'https://example.test/'+m.jobId+'.wav',direct:true};
        return {ok:true};
      }},
    downloads:{download:async options=>{const id=downloads.length+1;downloads.push({id,state:'in_progress',url:options.url,filename:'C:/Downloads/'+options.filename,startTime:new Date(time).toISOString()});return id},
      search:async options=>options.id?downloads.filter(d=>d.id===options.id):downloads}};
  const request=async(path,method,body)=>{
    if(path==='/jobs')return {items:state.jobs};
    if(path.endsWith('/claim')){
      const id=path.split('/')[2];let claim=claims[id];
      if(claim&&claim.owner!==body.owner)throw Error('Other browser owns media');
      claim??={owner:body.owner,attempt:body.attempt,phase:'claimed'};
      const send=!!body.authorize_send&&claim.phase!=='sent';if(send)claim.phase='sent';claims[id]=claim;return {send,claim};
    }
    if(path.endsWith('/result')){assert.equal(body.download_state,'complete');imports++;state.jobs=imports===1?[makeJob(2)]:[];return {accepted:true}}
    return {updated:true};
  };
  const create=()=>createMediaBridge({chrome,request,ensureContent:async()=>{},now:()=>time,pageSettleMs:5000});
  const tick=async engine=>{time+=2000;await engine.tick()};
  return {storage,state,messages,downloads,chrome,request,create,tick,counts:()=>({tabCount,runs,imports}),advance:ms=>time+=ms};
}

test('a stuck AI tab skips the owned scene, restores its dialog for the next scene, and never resends the failed prompt',async()=>{
  const f=fixture();f.state.ready=false;
  const original=f.state.jobs[0],next={...original,id:'media2',prompt:'Audio 2',media:{...original.media,filename:'tts_002.wav'}};
  let failed=[];
  // A deterministic clock injected separately from download timing.
  let clock=1000;
  const worker=createMediaBridge({chrome:f.chrome,request:async(path,method,body)=>{
    if(path.endsWith('/failure')){failed.push(body);f.state.jobs=[next];return {accepted:true}}
    return f.request(path,method,body);
  },ensureContent:async()=>{},now:()=>clock,pageSettleMs:0});
  await worker.tick();await worker.tick();clock+=181000;await worker.tick();
  assert.equal(failed.length,1);assert.equal((await worker.read()).phase,'idle');assert.equal(f.counts().runs,0);
  f.state.ready=true;
  for(let i=0;i<5;i++)await worker.tick();
  assert.equal(f.counts().runs,1);assert.equal(f.counts().tabCount,1);
  assert.equal((await worker.read()).jobId,'media2');
  assert.ok(f.messages.filter(m=>m==='media-send').length===1);
});

test('a submitted generation timeout reports the missing item instead of reauthorizing Run',async()=>{
  const f=fixture();f.state.generated=false;let clock=1000,failed=0;
  const worker=createMediaBridge({chrome:f.chrome,request:async(path,method,body)=>{
    if(path.endsWith('/failure')){assert.equal(body.stage,'submitted');failed++;f.state.jobs=[];return {accepted:true}}
    return f.request(path,method,body);
  },ensureContent:async()=>{},now:()=>clock,pageSettleMs:0});
  for(let i=0;i<5;i++)await worker.tick();
  assert.equal(f.counts().runs,1);clock+=30*60*1000+1;await worker.tick();
  assert.equal(failed,1);assert.equal(f.counts().runs,1);assert.equal((await worker.read()).phase,'idle');
});

test('slow Flow controls can mount after more than eight readiness errors and still send only once',async()=>{
  const f=fixture('flow'),send=f.chrome.tabs.sendMessage;let attempts=0,failed=0;
  f.chrome.tabs.sendMessage=async(id,message)=>message.action==='media-setup'&&attempts++<12?
    {ok:false,code:'INPUT_NOT_READY',error:'Chưa thấy cài đặt tạo video Flow'}:send(id,message);
  const engine=createMediaBridge({chrome:f.chrome,request:async(path,...rest)=>{
    if(path.endsWith('/failure')){failed++;return {accepted:true}}
    return f.request(path,...rest);
  },ensureContent:async()=>{},now:()=>100000,pageSettleMs:0});
  for(let i=0;i<18;i++)await engine.tick();
  assert.equal(failed,0);assert.equal(f.counts().runs,1);assert.ok(attempts>8);
});

test('unavailable Flow controls stop at the preparation deadline without sending',async()=>{
  const f=fixture('flow');let clock=1000,failed=0;
  f.chrome.tabs.sendMessage=async()=>({ok:false,code:'INPUT_NOT_READY',error:'Chưa thấy cài đặt tạo video Flow'});
  const engine=createMediaBridge({chrome:f.chrome,request:async(path,...rest)=>{
    if(path.endsWith('/failure')){failed++;f.state.jobs=[];return {accepted:true}}
    return f.request(path,...rest);
  },ensureContent:async()=>{},now:()=>clock,pageSettleMs:0});
  for(let i=0;i<15;i++){clock+=2000;await engine.tick()}
  assert.equal(failed,0);assert.equal(f.counts().runs,0);
  clock+=180001;await engine.tick();assert.equal(failed,1);assert.equal(f.counts().runs,0);
});

test('media waits for complete page and stable controls; reuses one tab for all audio segments',async()=>{
  const f=fixture();let engine=f.create();f.state.tabStatus='loading';
  await f.tick(engine);assert.deepEqual(f.messages,[]);
  f.state.tabStatus='complete';await f.tick(engine);await f.tick(engine);assert.deepEqual(f.messages,[]);
  for(let i=0;i<7;i++)await f.tick(engine);
  assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,1);assert.equal(f.counts().imports,0);
  f.downloads[0].state='complete';engine=f.create();
  for(let i=0;i<10;i++)await f.tick(engine);
  assert.equal(f.counts().runs,2);assert.equal(f.counts().tabCount,1);assert.equal(f.downloads.length,2);
  f.downloads[1].state='complete';await f.tick(engine);
  assert.equal(f.counts().imports,2);
});

test('a reused provider tab is activated once when the next media job starts',async()=>{
  const f=fixture();let activated=0;const update=f.chrome.tabs.update;
  f.chrome.tabs.update=async(id,options)=>{if(options.active===true)activated++;return update(id,options)};
  f.storage.mediaBridge={phase:'idle',tabs:{},sessions:{'legacy:Project:aistudio':{tabId:42,url:'https://aistudio.google.com/generate-speech'}}};
  const engine=f.create();for(let i=0;i<5;i++)await f.tick(engine);
  assert.equal(activated,1);assert.equal(f.counts().tabCount,0);assert.equal(f.counts().runs,1);
});

test('AI Studio saves only the captured full WAV and sends its player duration for validation',async()=>{
  const f=fixture(),send=f.chrome.tabs.sendMessage;
  let armed=0,captured='',posted;
  f.chrome.tabs.sendMessage=async(id,m)=>{
    if(m.action==='media-download-info')return {ok:true,url:'blob:40ms-preview',direct:false,expectedDuration:146};
    if(m.action==='media-download-click'){assert.equal(armed,1);captured='blob:complete-wav';return {ok:true,clicked:true}}
    return send(id,m);
  };
  const engine=createMediaBridge({chrome:f.chrome,request:async(path,method,body)=>{
    if(path.endsWith('/result'))posted=body;
    return f.request(path,method,body);
  },ensureContent:async()=>{},armCapture:async()=>armed++,readCapture:async()=>captured,now:()=>100000,pageSettleMs:0});
  for(let i=0;i<5;i++)await engine.tick();
  assert.equal(f.downloads.length,0);
  assert.equal((await engine.read()).downloadUrl,undefined);
  await engine.tick();
  assert.equal(f.downloads[0].url,'blob:complete-wav');
  assert.equal(f.counts().runs,1);
  f.downloads[0].state='complete';await engine.tick();
  assert.equal(posted.expected_duration,146);assert.equal(posted.download_id,1);
  assert.equal(f.counts().imports,1);
});

test('a rejected incomplete WAV automatically retries the existing download once without another Run',async()=>{
  const f=fixture();let rejected=true;
  const engine=createMediaBridge({chrome:f.chrome,request:async(path,method,body)=>{
    if(path.endsWith('/result')&&rejected)throw Error('[TTS_INCOMPLETE] WAV is only a streaming fragment');
    return f.request(path,method,body);
  },ensureContent:async()=>{},now:()=>100000,pageSettleMs:0});
  for(let i=0;i<5;i++)await engine.tick();
  f.downloads[0].state='complete';await engine.tick();
  const state=await engine.read();
  assert.equal(state.phase,'download_ready');assert.equal(state.fullDownloadRetry,true);
  assert.equal(state.downloadId,undefined);assert.equal(f.counts().imports,0);
  rejected=false;await engine.tick();
  assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,2);
  f.downloads[1].state='complete';await engine.tick();assert.equal(f.counts().imports,1);
});

test('lost Run acknowledgment and worker restart only collect; never run again',async()=>{
  const f=fixture();let engine=f.create();f.state.lostRun=true;
  for(let i=0;i<8;i++)await f.tick(engine);
  assert.equal(f.counts().runs,1);
  engine=f.create();for(let i=0;i<6;i++)await f.tick(engine);
  assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,1);
  assert.equal(f.storage.mediaBridge.phase,'downloading');
});

test('unapproved image/video jobs cannot enter the media automation queue',async()=>{
  const f=fixture(),engine=f.create();f.state.jobs=[{id:'manual',attempt:1,kind:'image_generation',provider:'gemini'}];
  for(let i=0;i<10;i++)await f.tick(engine);
  assert.deepEqual(f.counts(),{tabCount:0,runs:0,imports:0});
});

test('disabled automation, stopped job and interrupted downloads never create another generation',async()=>{
  for(const condition of ['disabled','cancelled','interrupted']){
    const f=fixture(),engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
    const before=f.counts().runs;
    if(condition==='disabled')f.storage.autoBridge.enabled=false;
    if(condition==='cancelled')f.state.jobs=[];
    if(condition==='interrupted')f.downloads[0].state='interrupted';
    for(let i=0;i<6;i++)await f.tick(engine);
    assert.equal(f.counts().runs,before);assert.equal(f.counts().imports,0);
    if(condition==='interrupted')assert.equal(f.storage.mediaBridge.phase,'paused');
  }
});

test('filename override matches exact current output URL, not unrelated downloads',async()=>{
  const f=fixture(),engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  const suggestions=[];
  await engine.determineFilename({...f.downloads[0],id:40,url:'https://example.test/unrelated.wav'},value=>suggestions.push(value));
  assert.equal(suggestions[0],undefined);
  await engine.determineFilename(f.downloads[0],value=>suggestions.push(value));
  assert.deepEqual(suggestions[1],{filename:'Project/tts_001.wav',conflictAction:'uniquify'});
});

test('another browser claim or a changed scene stops before any fill or run',async()=>{
  const f=fixture();const engine=createMediaBridge({chrome:f.chrome,request:async(path,...rest)=>{if(path.endsWith('/claim'))throw Error('Other browser owns media');return f.request(path,...rest)},ensureContent:async()=>{}});
  await engine.tick();assert.equal((await engine.read()).phase,'paused');assert.deepEqual(f.messages,[]);assert.equal(f.counts().runs,0);
});

test('lost download acknowledgement recovers the exact download without another generation or download',async()=>{
  const f=fixture();const download=f.chrome.downloads.download;
  f.chrome.downloads.download=async options=>{await download(options);throw Error('message channel closed')};
  let engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  engine=f.create();for(let i=0;i<3;i++)await f.tick(engine);
  assert.equal(f.downloads.length,1);assert.equal(f.counts().runs,1);
  assert.equal((await engine.read()).downloadId,1);
});

test('resume after cancelling Save As downloads the existing result and imports it without generating twice',async()=>{
  const f=fixture();let engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  f.downloads[0].state='interrupted';f.downloads[0].error='USER_CANCELED';
  await f.tick(engine);
  assert.equal((await engine.read()).phase,'paused');
  assert.match((await engine.read()).message,/Settings → Downloads/);
  engine=f.create();await engine.resume();
  assert.equal((await engine.read()).phase,'download_ready');
  await f.tick(engine);
  assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,2);
  assert.equal((await engine.read()).downloadId,2);
  f.downloads[1].state='complete';await f.tick(engine);
  assert.equal(f.counts().imports,1);
});

test('resume preserves a completed download for import and does not replace an in-progress download',async()=>{
  for(const state of ['complete','in_progress']){
    const f=fixture(),engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
    f.storage.mediaBridge={...f.storage.mediaBridge,phase:'paused',resumePhase:'downloading'};
    f.downloads[0].state=state;
    await engine.resume();await f.tick(engine);
    assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,1);
    assert.equal(f.counts().imports,state==='complete'?1:0);
  }
});

test('resume is a no-op during an active download',async()=>{
  const f=fixture(),engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  const before=await engine.read();await engine.resume();
  assert.deepEqual(await engine.read(),before);
});

test('resume retries a timed-out Download click with no matching file, without sending the generation again',async()=>{
  const f=fixture();
  const send=f.chrome.tabs.sendMessage;
  f.chrome.tabs.sendMessage=async(id,m)=>m.action==='media-download-info'?{ok:true,url:'blob:output',direct:false}:send(id,m);
  const engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  f.advance(151000);await f.tick(engine);
  assert.equal((await engine.read()).phase,'paused');
  await engine.resume();
  assert.equal((await engine.read()).phase,'download_ready');
  await f.tick(engine);
  assert.equal(f.messages.filter(m=>m==='media-download-click').length,2);
  assert.equal(f.counts().runs,1);
});

test('resume finds the exact completed download after its ID was lost and imports it once',async()=>{
  const f=fixture(),engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  f.downloads[0].state='complete';
  f.storage.mediaBridge={...f.storage.mediaBridge,phase:'paused',resumePhase:'downloading',downloadId:undefined};
  await engine.resume();
  assert.equal((await engine.read()).downloadId,1);
  await f.tick(engine);
  assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,1);assert.equal(f.counts().imports,1);
});

test('offline app polls preserve the saved resume stage of a paused media job',async()=>{
  const f=fixture(),engine=createMediaBridge({chrome:f.chrome,request:async()=>{throw Error('Failed to fetch')},ensureContent:async()=>{},now:()=>100000});
  f.storage.mediaBridge={phase:'paused',resumePhase:'submitted',jobId:'media1',sentAt:1234,errors:9,message:'Failed to fetch'};
  const before=await engine.read();
  for(let i=0;i<4;i++)await engine.tick();
  assert.deepEqual(await engine.read(),before);
  await engine.resume();
  assert.equal((await engine.read()).phase,'submitted');
  assert.equal(f.counts().runs,0);
});

test('resume repairs legacy paused resumePhase for an idle queue and for an existing download without resending',async()=>{
  const idle=fixture(),idleEngine=idle.create();
  idle.storage.mediaBridge={phase:'paused',resumePhase:'paused',tabs:{},message:'Failed to fetch'};
  await idleEngine.resume();assert.equal((await idleEngine.read()).phase,'idle');
  await idle.tick(idleEngine);assert.equal((await idleEngine.read()).jobId,'media1');
  const f=fixture(),engine=f.create();for(let i=0;i<10;i++)await f.tick(engine);
  f.storage.mediaBridge={...f.storage.mediaBridge,phase:'paused',resumePhase:'paused'};
  f.downloads[0].state='complete';await engine.resume();
  assert.equal((await engine.read()).phase,'downloading');
  await f.tick(engine);assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,1);assert.equal(f.counts().imports,1);
});

test('download recovery reconnects the content script and remembers this tab prompt for the next scene across restarts',async()=>{
  const f=fixture();let connected=true;
  const send=f.chrome.tabs.sendMessage;
  f.chrome.tabs.sendMessage=async(id,m)=>{assert.ok(connected);return send(id,m)};
  const create=()=>createMediaBridge({chrome:f.chrome,request:f.request,ensureContent:async()=>{connected=true},now:()=>100000,pageSettleMs:0});
  let engine=create();
  for(let i=0;i<4;i++)await engine.tick();
  assert.equal((await engine.read()).phase,'download_ready');
  connected=false;engine=create();await engine.tick();
  f.downloads[0].state='complete';await engine.tick();
  assert.equal((await engine.read()).prompts[1],'Audio 1');
  connected=false;engine=create();await engine.tick();await engine.tick();
  assert.equal(f.state.lastMessage.action,'media-prepare');
  assert.equal(f.state.lastMessage.previousPrompt,'Audio 1');
  assert.equal(f.counts().tabCount,1);
});

test('closed unsent tab reopens its saved provider project, waits for loading and sends once',async()=>{
  const f=fixture(),engine=f.create();
  f.state.jobs[0]={...f.state.jobs[0],provider:'flow',url:'https://flow.google.com/'};
  const page='https://flow.google.com/project/our-project';
  f.storage.mediaBridge={phase:'opening',jobId:'media1',attempt:1,owner:'our-owner',provider:'flow',prompt:'Audio 1',
    media:f.state.jobs[0].media,tabId:9,tabs:{flow:9},folders:{flow:'Project'},pages:{flow:page},
    deadline:1000000,preparationDeadline:1000000,pageReadyAt:100};
  f.chrome.tabs.get=async id=>{if(id===9)throw Error('No tab with id: 9.');return {id,url:page,status:'complete'}};
  const create=f.chrome.tabs.create;
  let opened;
  f.chrome.tabs.create=async options=>{opened=options.url;return {...await create(options),url:options.url}};
  await f.tick(engine);
  assert.equal(opened,page);assert.deepEqual(f.messages,[]);
  for(let i=0;i<6;i++)await f.tick(engine);
  assert.equal(f.counts().tabCount,1);assert.equal(f.counts().runs,1);
});

test('closed submitted tab and claimed-sent setup cannot reopen a page or send another request',async()=>{
  const f=fixture(),engine=f.create();for(let i=0;i<5;i++)await f.tick(engine);
  assert.equal((await engine.read()).phase,'submitted');
  f.chrome.tabs.sendMessage=async()=>{throw Error('No tab with id: 1.')};
  await f.tick(engine);await engine.resume();await f.tick(engine);
  assert.equal(f.counts().tabCount,1);assert.equal(f.counts().runs,1);
  const g=fixture();
  g.storage.mediaBridge={phase:'opening',jobId:'media1',attempt:1,owner:'our-owner',provider:'aistudio',
    media:g.state.jobs[0].media,deadline:1000000,preparationDeadline:1000000};
  const guarded=createMediaBridge({chrome:g.chrome,request:async(path,...rest)=>path.endsWith('/claim')?
    {claim:{phase:'sent'}}:g.request(path,...rest),ensureContent:async()=>{},now:()=>100000});
  await guarded.tick();
  assert.equal((await guarded.read()).phase,'paused');assert.equal(g.counts().tabCount,0);assert.deepEqual(g.messages,[]);
});

test('Flow persists its selected clip before Done and passes it back after worker restart without another Send',async()=>{
  const f=fixture('flow'),send=f.chrome.tabs.sendMessage;
  const collection={jobId:'media1',thumbnailUrl:'https://media.test/new.jpg',openedAt:10000,selectedAt:6000};
  let polls=0;
  f.chrome.tabs.sendMessage=async(id,m)=>{
    if(m.action==='media-poll'){
      polls++;
      if(polls===1)return {ok:true,ready:false,collection,message:'Đang mở video Flow vừa tạo…'};
      assert.deepEqual(m.collection,collection);
      return {ok:true,ready:true,collection:{...collection,doneClickedAt:12000},result:{url:collection.thumbnailUrl}};
    }
    return send(id,m);
  };
  let engine=f.create();for(let i=0;i<6;i++)await f.tick(engine);
  assert.equal((await engine.read()).phase,'submitted');
  assert.deepEqual((await engine.read()).collection,collection);
  engine=f.create();await f.tick(engine);
  assert.equal((await engine.read()).phase,'download_ready');
  assert.equal((await engine.read()).collection.doneClickedAt,12000);
  assert.equal(f.counts().runs,1);
});

test('Flow waits for Done and grid readiness before arming a download, including retries of an existing result',async()=>{
  const f=fixture('flow'),send=f.chrome.tabs.sendMessage;
  let infos=0,armed=0;
  f.chrome.tabs.sendMessage=async(id,m)=>{
    if(m.action==='media-download-info'){
      infos++;
      if(infos===1)return {ok:true,ready:false,message:'Đang bấm Xong…',collection:{jobId:'media1',thumbnailUrl:'blob:new',openedAt:9000,doneClickedAt:11000}};
      assert.equal(m.collection.doneClickedAt,11000);
      return {ok:true,url:'blob:video',direct:false};
    }
    return send(id,m);
  };
  let engine=createMediaBridge({chrome:f.chrome,request:f.request,ensureContent:async()=>{},armCapture:async()=>armed++,now:()=>100000,pageSettleMs:0});
  for(let i=0;i<5;i++)await engine.tick();
  assert.equal((await engine.read()).phase,'download_ready');assert.equal(armed,0);
  assert.ok(!f.messages.includes('media-download-click'));assert.equal(f.downloads.length,0);
  f.storage.mediaBridge={...f.storage.mediaBridge,phase:'paused',resumePhase:'download_ready'};
  engine=createMediaBridge({chrome:f.chrome,request:f.request,ensureContent:async()=>{},armCapture:async()=>armed++,now:()=>100000,pageSettleMs:0});
  await engine.resume();await engine.tick();
  assert.equal((await engine.read()).phase,'downloading');assert.equal(armed,1);
  assert.equal(f.counts().runs,1);assert.equal(f.messages.filter(m=>m==='media-download-click').length,1);
});

test('Flow returns to download readiness if the editor changes between inspecting and clicking Download',async()=>{
  const f=fixture('flow'),send=f.chrome.tabs.sendMessage;
  f.chrome.tabs.sendMessage=async(id,m)=>m.action==='media-download-info'?{ok:true,url:'blob:video',direct:false}:
    m.action==='media-download-click'?{ok:true,ready:false,collection:{jobId:'media1',thumbnailUrl:'blob:new',openedAt:9000,doneClickedAt:11000}}:send(id,m);
  const engine=createMediaBridge({chrome:f.chrome,request:f.request,ensureContent:async()=>{},armCapture:async()=>{},now:()=>100000,pageSettleMs:0});
  for(let i=0;i<5;i++)await engine.tick();
  const state=await engine.read();
  assert.equal(state.phase,'download_ready');assert.equal(state.downloadTicket,undefined);assert.equal(state.downloadAt,undefined);
  assert.equal(state.collection.doneClickedAt,11000);assert.equal(f.counts().runs,1);assert.equal(f.downloads.length,0);
});
