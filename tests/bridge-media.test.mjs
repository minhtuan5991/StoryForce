import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMediaBridge} from '../browser-extension/media-automatic.js';

function fixture(){
  const storage={autoBridge:{enabled:true}},messages=[],downloads=[];
  let time=1000,tabCount=0,runs=0,imports=0;const claims={};
  const makeJob=i=>({id:'media'+i,attempt:1,provider:'aistudio',url:'https://aistudio.google.com/generate-speech',prompt:'Audio '+i,
    media:{batch_id:'batch',folder:'Project',filename:'tts_00'+i+'.wav'}});
  const state={jobs:[makeJob(1)],tabStatus:'complete',ready:true,generated:true,lostRun:false};
  const chrome={storage:{local:{get:async k=>({[k]:structuredClone(storage[k])}),set:async values=>Object.assign(storage,structuredClone(values))}},
    tabs:{create:async()=>({id:++tabCount,url:makeJob(1).url,status:state.tabStatus}),get:async id=>({id,url:makeJob(1).url,status:state.tabStatus}),
      sendMessage:async(id,m)=>{
        messages.push(m.action);
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
