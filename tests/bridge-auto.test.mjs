import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticBridge,parseResult} from '../browser-extension/automatic.js';

function fixture(){
  const db={};const calls=[];const closed=[];let time=1000;let sent=0;let saved=0;let claim;let created=0;
  const job={id:'job1',attempt:1,kind:'premise_mini_test',provider:'chatgpt',url:'https://chatgpt.com/',prompt:'Test prompt',timeout:30};
  const state={jobs:[job],poll:{text:'{"answer":"new response"}',busy:false},lostSend:false,rejectResult:false,retries:0};
  const chrome={storage:{local:{get:async key=>structuredClone({[key]:db[key]}),set:async values=>Object.assign(db,structuredClone(values))}},tabs:{remove:async id=>{assert.ok(saved>0);if(state.closeError)throw Error('Cannot close');closed.push(id)},create:async()=>({id:9+created++}),get:async()=>({id:9,url:state.tabUrl||job.url,status:'complete'}),sendMessage:async(id,message)=>{
    calls.push(message.action);
    if(message.action==='auto-prepare'){
      if(state.prepareError)return {ok:false,error:state.prepareError,code:state.prepareCode};
      return {ok:true,baseline:{count:1,last:'Old answer'}};
    }
    if(message.action==='auto-check-send'&&state.checkError)return {ok:false,error:state.checkError,code:state.checkCode};
    if(message.action==='auto-send'){sent++;if(state.lostSend)throw Error('Response port closed');return {ok:true,submitted:true}}
    return {ok:true,...state.poll};
  }}};
  const request=async(path,method,body)=>{
    if(path==='/jobs')return {items:state.jobs};
    if(path.endsWith('/claim')){
      if(claim&&claim.owner!==body.owner)throw Error('Another browser claimed this job');
      claim??={owner:body.owner,attempt:body.attempt,phase:'claimed'};
      if(body.authorize_send){if(claim.phase==='sent')return {send:false,claim};claim={...claim,phase:'sent'};return {send:true,claim}}
      return {send:false,claim};
    }
    if(path.endsWith('/retry')){
      assert.equal(body.attempt,state.jobs[0].attempt);
      if(state.retries>=3)throw Error('Đã tự gửi lại 3 lần. Kiểm tra tab AI rồi tiếp tục thủ công hoặc bấm Thử lại.');
      state.retries++;state.jobs=[{...job,attempt:body.attempt+1}];claim=undefined;
      if(state.loseRetryResponse){state.loseRetryResponse=false;throw Error('Response lost')}
      return {accepted:true,retry_count:state.retries};
    }
    if(path.endsWith('/result')){
      if(state.rejectResult)throw Error('Invalid result schema');
      assert.equal(body.result.answer,'new response');saved++;state.jobs=[];return {accepted:true};
    }
    return {updated:true};
  };
  const create=()=>{const engine=createAutomaticBridge({chrome,request,ensureContent:async()=>{if(state.connectionError)throw Error(state.connectionError)},now:()=>time});const tick=engine.tick;engine.tick=async()=>{time+=2000;return tick()};return engine};
  return {state,db,calls,closed,create,created:()=>created,counts:()=>({sent,saved}),advance:(ms=31000)=>{time+=ms}};
}

test('late composer and disconnected content script recover in the same tab, even after worker restart',async()=>{
  for(const mode of ['editor','connection','channel']){
    const f=fixture();let a=f.create();
    if(mode==='editor'){f.state.prepareError='Editor loading';f.state.prepareCode='INPUT_NOT_READY'}
    if(mode==='connection')f.state.connectionError='Could not establish connection. Receiving end does not exist.';
    if(mode==='channel')f.state.prepareError='A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';
    await a.setEnabled(true);await a.tick();
    assert.equal((await a.read()).phase,'opening');assert.equal((await a.read()).prepareChecks,1);
    assert.deepEqual(f.counts(),{sent:0,saved:0});
    a=f.create();f.state.prepareError=null;f.state.connectionError=null;
    for(let i=0;i<7;i++)await a.tick();
    assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.created(),1);assert.equal(f.state.retries,0);
  }
});

test('composer remount during the send check returns to preparation without a new attempt',async()=>{
  const f=fixture(),a=f.create();f.state.checkError='Editor remounted';f.state.checkCode='EDITOR_CHANGED';
  await a.setEnabled(true);await a.tick();assert.equal((await a.read()).phase,'opening');
  f.state.checkError=null;for(let i=0;i<7;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.created(),1);assert.equal(f.state.retries,0);
});

test('missing composer has a bounded wait and stays paused without opening more tabs',async()=>{
  const f=fixture(),a=f.create();f.state.prepareError='Editor missing';f.state.prepareCode='INPUT_NOT_READY';
  await a.setEnabled(true);for(let i=0;i<30;i++)await a.tick();
  assert.equal((await a.read()).phase,'paused');assert.equal((await a.read()).prepareChecks,8);
  assert.equal(f.calls.filter(c=>c==='auto-prepare').length,9);
  assert.deepEqual(f.counts(),{sent:0,saved:0});assert.equal(f.created(),1);assert.equal(f.state.retries,0);
});

test('cancel or disable during composer wait does not fill or send again',async()=>{
  for(const cancel of [true,false]){
    const f=fixture(),a=f.create();f.state.prepareError='Editor missing';f.state.prepareCode='INPUT_NOT_READY';
    await a.setEnabled(true);await a.tick();
    if(cancel)f.state.jobs=[];else await a.setEnabled(false);
    f.state.prepareError=null;for(let i=0;i<5;i++)await a.tick();
    assert.equal(f.calls.filter(c=>c==='auto-prepare').length,1);assert.equal(f.counts().sent,0);
  }
});

test('upgrade repairs only legacy pre-send pauses with an unsent backend claim',async()=>{
  for(const alreadySent of [false,true]){
    const f=fixture(),a=f.create();
    if(!alreadySent){f.state.prepareError='Prompt field not found';f.state.prepareCode='INPUT_NOT_READY'}
    await a.setEnabled(true);await a.tick();
    f.db.autoBridge={...f.db.autoBridge,phase:'paused',resumePhase:'opening',message:'Prompt field not found. Open the correct generation screen.'};
    f.state.prepareError=null;await a.tick();
    assert.equal((await a.read()).phase,alreadySent?'paused':'opening');
    for(let i=0;i<7;i++)await a.tick();
    assert.equal(f.counts().sent,1);assert.equal(f.created(),1);
    assert.equal(f.counts().saved,alreadySent?0:1);
  }
});

test('missing Send retries are bounded and recovery sends exactly once',async()=>{
  const f=fixture(),a=f.create();f.state.checkError='Not ready';f.state.checkCode='SEND_NOT_READY';
  await a.setEnabled(true);await a.tick();await a.tick();
  assert.equal((await a.read()).phase,'prepared');assert.equal(f.counts().sent,0);
  f.state.checkError=null;for(let i=0;i<6;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.created(),1);assert.deepEqual(f.closed,[9]);
  const g=fixture(),b=g.create();g.state.checkError='Not ready';g.state.checkCode='SEND_NOT_READY';
  await b.setEnabled(true);for(let i=0;i<8;i++)await b.tick();
  assert.equal((await b.read()).phase,'retry_wait');assert.equal(g.counts().sent,0);
  assert.equal(g.calls.filter(c=>c==='auto-check-send').length,5);assert.deepEqual(g.closed,[]);
});

test('incomplete JSON is polled again without resending, including across worker restarts',async()=>{
  const f=fixture();let a=f.create();f.state.poll.text='{"answer":';await a.setEnabled(true);
  for(let i=0;i<5;i++)await a.tick();assert.equal((await a.read()).phase,'submitted');
  assert.equal((await a.read()).jsonChecks,1);assert.deepEqual(f.closed,[]);
  a=f.create();f.state.poll.text='{"answer":"new response"}';for(let i=0;i<6;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.deepEqual(f.closed,[9]);
});

test('persistent non-JSON schedules a fresh request after waiting and keeps the failed tab',async()=>{
  const f=fixture(),a=f.create();f.state.poll.text='Not JSON';await a.setEnabled(true);
  for(let i=0;i<22;i++)await a.tick();
  assert.equal((await a.read()).phase,'retry_wait');assert.deepEqual(f.counts(),{sent:1,saved:0});assert.deepEqual(f.closed,[]);
});

test('new request retry persists across restarts, then completes with one send per attempt',async()=>{
  const f=fixture();let a=f.create();f.state.poll.text='Not JSON';await a.setEnabled(true);
  for(let i=0;i<22;i++)await a.tick();
  const before=await a.read();assert.equal(before.phase,'retry_wait');
  a=f.create();await a.tick();assert.equal((await a.read()).retryId,before.retryId);assert.equal(f.state.retries,0);
  f.advance();await a.tick();assert.equal(f.state.retries,1);
  f.state.poll.text='{"answer":"new response"}';for(let i=0;i<8;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:2,saved:1});assert.equal(f.created(),2);assert.deepEqual(f.closed,[10]);
});

test('persistent missing Send stops after three new attempts',async()=>{
  const f=fixture(),a=f.create();f.state.checkError='Not ready';f.state.checkCode='SEND_NOT_READY';await a.setEnabled(true);
  for(let i=0;i<100;i++)await a.tick();
  assert.equal(f.state.retries,3);assert.equal((await a.read()).phase,'paused');assert.equal((await a.read()).retryStopped,true);
  assert.equal(f.created(),4);assert.equal(f.counts().sent,0);
  for(let i=0;i<20;i++)await a.tick();assert.equal(f.state.retries,3);
});

test('cancel and disable during retry wait do not send a new request',async()=>{
  for(const cancel of [true,false]){
    const f=fixture(),a=f.create();f.state.poll.text='Not JSON';await a.setEnabled(true);
    for(let i=0;i<22;i++)await a.tick();
    if(cancel)f.state.jobs=[];else await a.setEnabled(false);
    f.advance();await a.tick();assert.equal(f.state.retries,0);assert.equal(f.counts().sent,1);
  }
});

test('legacy paused JSON error automatically schedules the authorized new retry',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();
  f.db.autoBridge={...f.db.autoBridge,phase:'paused',message:'Câu trả lời vẫn chưa phải JSON hợp lệ sau các lần chờ.',resumePhase:'submitted'};
  await a.tick();assert.equal((await a.read()).phase,'retry_wait');assert.equal(f.state.retries,0);
});

test('lost retry response does not cause a second new attempt',async()=>{
  const f=fixture();let a=f.create();f.state.poll.text='Not JSON';await a.setEnabled(true);
  for(let i=0;i<22;i++)await a.tick();
  f.state.loseRetryResponse=true;f.advance();await a.tick();
  a=f.create();f.state.poll.text='{"answer":"new response"}';for(let i=0;i<8;i++)await a.tick();
  assert.equal(f.state.retries,1);assert.deepEqual(f.counts(),{sent:2,saved:1});
});

test('accepted result cleanup survives restart, skips navigated tabs and tolerates close failure',async()=>{
  for(const mode of ['restart','navigated','closeError']){
    const f=fixture();let a=f.create();await a.setEnabled(true);for(let i=0;i<5;i++)await a.tick();
    assert.equal((await a.read()).phase,'closing');assert.deepEqual(f.closed,[]);
    if(mode==='navigated')f.state.tabUrl='https://chatgpt.com/c/personal-conversation';
    if(mode==='closeError')f.state.closeError=true;
    a=f.create();await a.tick();await a.tick();
    assert.equal((await a.read()).phase,'idle');assert.deepEqual(f.counts(),{sent:1,saved:1});
    assert.deepEqual(f.closed,mode==='restart'?[9]:[]);
  }
});

test('resume of a failed pre-send check refills a fresh tab without changing the old draft',async()=>{
  const f=fixture(),a=f.create();f.state.checkError='Prompt mismatch';
  await a.setEnabled(true);await a.tick();
  assert.equal((await a.read()).resumePhase,'prepared');assert.equal(f.counts().sent,0);
  assert.equal(f.created(),1);
  f.state.checkError=null;await a.resume();
  assert.equal((await a.read()).phase,'opening');assert.equal((await a.read()).tabId,undefined);
  for(let i=0;i<6;i++)await a.tick();
  assert.equal(f.created(),2);assert.deepEqual(f.counts(),{sent:1,saved:1});
  assert.equal(f.calls.filter(a=>a==='auto-prepare').length,2);
});

test('automatic sends once and captures without any popup event',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);
  for(let i=0;i<6;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal((await a.read()).phase,'idle');
});
test('service worker restart resumes collection without re-sending',async()=>{
  const f=fixture();let a=f.create();await a.setEnabled(true);await a.tick();
  a=f.create();for(let i=0;i<4;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});
});

test('paused obsolete job releases the queue but a still-pending invalid result stays paused',async()=>{
  const f=fixture(),a=f.create();f.state.checkError='Invalid result';
  await a.setEnabled(true);await a.tick();
  assert.equal((await a.read()).phase,'paused');
  await a.tick();assert.equal((await a.read()).phase,'paused');
  f.state.jobs=[{...f.state.jobs[0],id:'selected-premise-bible',kind:'story_bible'}];
  f.state.checkError=null;await a.tick();
  assert.equal((await a.read()).jobId,'selected-premise-bible');
  assert.equal((await a.read()).phase,'submitted');
  assert.equal(f.counts().sent,1);
});
test('uncertain send response pauses, and explicit resume never sends twice',async()=>{
  const f=fixture(),a=f.create();f.state.lostSend=true;await a.setEnabled(true);await a.tick();
  assert.equal((await a.read()).phase,'paused');await a.resume();
  for(let i=0;i<4;i++)await a.tick();assert.deepEqual(f.counts(),{sent:1,saved:1});
});
test('timeout, generating state, disable and cancellation cannot auto-submit again',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();f.state.poll.busy=true;f.advance(16*60*1000);await a.tick();
  assert.equal((await a.read()).phase,'paused');assert.equal(f.counts().saved,0);
  await a.setEnabled(false);await a.tick();assert.equal(f.counts().sent,1);
  f.state.jobs=[];await a.resume();await a.tick();assert.equal((await a.read()).phase,'idle');assert.equal(f.counts().saved,0);
});

test('slow generation continues past the initial timeout and saves once after completion across restarts',async()=>{
  const f=fixture();let a=f.create();await a.setEnabled(true);await a.tick();
  f.state.poll={text:'',busy:true};f.advance(4*60*1000);await a.tick();
  assert.equal((await a.read()).phase,'submitted');assert.equal(f.counts().sent,1);
  a=f.create();f.advance(2*60*1000);await a.tick();
  assert.equal((await a.read()).phase,'submitted');
  f.state.poll={text:'{"answer":"new response"}',busy:false};for(let i=0;i<6;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.state.retries,0);
});

test('a completed answer arriving after the old deadline is allowed to stabilize before saving',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();
  f.advance(4*60*1000);for(let i=0;i<6;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.state.retries,0);
});

test('upgrade resumes a legacy collection timeout without another send or new tab',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();
  f.db.autoBridge={...f.db.autoBridge,phase:'paused',resumePhase:'submitted',message:'Đã hết thời gian chờ. Kiểm tra tab AI rồi bấm Tiếp tục lấy kết quả; prompt không được gửi lại.'};
  f.advance(4*60*1000);await a.tick();assert.equal((await a.read()).phase,'submitted');
  for(let i=0;i<6;i++)await a.tick();assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.created(),1);
});

test('no response continues polling until the hard limit, then cannot loop recovery or submit twice',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();
  f.state.poll={text:'',busy:false};f.advance();await a.tick();
  assert.equal((await a.read()).phase,'submitted');
  f.advance(16*60*1000);await a.tick();
  assert.equal((await a.read()).phase,'paused');
  for(let i=0;i<10;i++)await a.tick();
  assert.equal((await a.read()).phase,'paused');assert.deepEqual(f.counts(),{sent:1,saved:0});assert.equal(f.state.retries,0);
});
test('invalid backend result stays paused instead of submitting the prompt again',async()=>{
  const f=fixture(),a=f.create();f.state.rejectResult=true;await a.setEnabled(true);
  for(let i=0;i<8;i++)await a.tick();assert.equal((await a.read()).phase,'paused');assert.deepEqual(f.counts(),{sent:1,saved:0});
});
test('media jobs are not mistaken for text results',async()=>{
  const f=fixture(),a=f.create();f.state.jobs[0].kind='image_generation';await a.setEnabled(true);await a.tick();assert.deepEqual(f.counts(),{sent:0,saved:0});
});
test('off by default, concurrent ticks cannot duplicate sends, and JSON fences parse',async()=>{
  const f=fixture(),a=f.create();await a.tick();assert.equal(f.counts().sent,0);await a.setEnabled(true);
  await Promise.all([a.tick(),a.tick(),a.tick()]);assert.equal(f.counts().sent,1);
  assert.deepEqual(parseResult('Here is the output:\n```json\n{"ok":true}\n```'),{ok:true});
  assert.throws(()=>parseResult('[]'));assert.throws(()=>parseResult('Still generating...'));
});
