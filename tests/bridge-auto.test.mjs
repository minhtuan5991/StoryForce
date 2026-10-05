import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticBridge,parseResult,parseBridgeResult} from '../browser-extension/automatic.js';
import {withTabReadDeadline} from '../browser-extension/transport.js';

function fixture(options={pageSettleMs:0}){
  const db={};const calls=[];const closed=[];let time=1000;let sent=0;let saved=0;let claim;let created=0;
  const job={id:'job1',attempt:1,kind:'premise_mini_test',provider:'chatgpt',url:'https://chatgpt.com/',prompt:'Test prompt',timeout:30};
  const state={jobs:[job],poll:{text:'{"answer":"new response"}',busy:false},lostSend:false,rejectResult:false,retries:0};
  const chrome={storage:{local:{get:async key=>structuredClone({[key]:db[key]}),set:async values=>Object.assign(db,structuredClone(values))}},tabs:{remove:async id=>{assert.ok(saved>0);if(state.closeError)throw Error('Cannot close');closed.push(id)},create:async()=>({id:9+created++}),get:async()=>({id:9,url:state.tabUrl||job.url,status:state.tabStatus||'complete'}),sendMessage:async(id,message)=>{
    calls.push(message.action);
    if(message.action==='auto-ready'){if(state.hungReady)return new Promise(()=>{});return {ok:true,ready:state.editorReady!==false}}
    if(message.action==='auto-prepare'){
      if(state.prepareError)return {ok:false,error:state.prepareError,code:state.prepareCode};
      return {ok:true,baseline:{count:1,last:'Old answer'}};
    }
    if(message.action==='auto-check-send'&&state.checkError)return {ok:false,error:state.checkError,code:state.checkCode};
    if(message.action==='auto-send'){sent++;if(state.lostSend)throw Error('Response port closed');return {ok:true,submitted:true}}
    if(message.action==='auto-poll'&&state.hungPoll)return new Promise(resolve=>{state.finishPoll=resolve});
    if(message.action==='auto-poll'&&state.pollError)throw Error(state.pollError);
    return {ok:true,...state.poll};
  }}};
  const request=async(path,method,body)=>{
    if(path==='/jobs')return {items:state.jobs};
    if(path.endsWith('/parse-result')){
      state.parseReads=(state.parseReads||0)+1;
      assert.equal(body.attempt,state.jobs[0].attempt);
      if(!state.parsedResult)throw Error('Invalid JSON syntax');
      assert.equal(body.result,state.rawText||state.poll.text);
      return {result:state.parsedResult};
    }
    if(path.endsWith('/claim')){
      if(claim&&claim.owner!==body.owner)throw Error('Another browser claimed this job');
      claim??={owner:body.owner,attempt:body.attempt,phase:'claimed'};
      if(body.authorize_send){if(claim.phase==='sent')return {send:false,claim};claim={...claim,phase:'sent'};return {send:true,claim}}
      return {send:false,claim};
    }
    if(path.endsWith('/retry')){
      assert.equal(body.attempt,state.jobs[0].attempt);
      if(state.retries>=3)throw Error('Đã tự gửi lại 3 lần. Kiểm tra tab AI rồi tiếp tục thủ công hoặc bấm Thử lại.');
      state.retryReasons??=[];state.retryReasons.push(body.reason);
      state.retries++;state.jobs=[{...job,attempt:body.attempt+1}];claim=undefined;
      if(state.loseRetryResponse){state.loseRetryResponse=false;throw Error('Response lost')}
      return {accepted:true,retry_count:state.retries};
    }
    if(path.endsWith('/result')){
      if(state.rejectResult)throw Object.assign(Error('Invalid result schema'),{code:state.resultCode});
      assert.equal(body.result.answer,'new response');saved++;state.jobs=[];return {accepted:true};
    }
    return {updated:true};
  };
  const create=()=>{const engine=createAutomaticBridge({chrome,request,ensureContent:async()=>{if(state.connectionError)throw Error(state.connectionError)},captureRaw:async(tabId,target)=>{state.rawReads=(state.rawReads||0)+1;assert.equal(tabId,9);assert.deepEqual(target,state.poll.copyTarget);if(state.rawError)throw Error(state.rawError);return {text:state.rawText}},now:()=>time,readTimeoutMs:20,...options});const tick=engine.tick;engine.tick=async()=>{time+=2000;return tick()};return engine};
  return {state,db,calls,closed,create,created:()=>created,counts:()=>({sent,saved}),advance:(ms=31000)=>{time+=ms}};
}

test('retention evidence rejection waits before one corrected request and never saves a false pass',async()=>{
  const f=fixture(),a=f.create();f.state.jobs[0].kind='retention_audit';
  f.state.rejectResult=true;f.state.resultCode='RETENTION_EVIDENCE';
  await a.setEnabled(true);for(let i=0;i<6;i++)await a.tick();
  assert.equal((await a.read()).phase,'retry_wait');
  assert.deepEqual(f.counts(),{sent:1,saved:0});
  await a.tick();assert.equal(f.state.retries,0);
  f.advance();await a.tick();
  assert.deepEqual(f.state.retryReasons,['RETENTION_EVIDENCE']);
  f.state.rejectResult=false;for(let i=0;i<7;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:2,saved:1});assert.equal(f.state.retries,1);
});

test('legacy retention pause rereads the existing result and disabled retry never sends',async()=>{
  const f=fixture();let a=f.create();f.state.jobs[0].kind='retention_audit';
  await a.setEnabled(true);await a.tick();
  f.db.autoBridge={...f.db.autoBridge,phase:'paused',resumePhase:'submitted',
    message:'Retention evidence does not belong to the reported time zone'};
  a=f.create();await a.tick();
  assert.equal((await a.read()).phase,'submitted');assert.equal(f.counts().sent,1);
  f.state.rejectResult=true;f.state.resultCode='RETENTION_EVIDENCE';
  for(let i=0;i<6;i++)await a.tick();
  assert.equal((await a.read()).phase,'retry_wait');
  await a.setEnabled(false);f.advance();await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:0});assert.equal(f.state.retries,0);
});

test('waits after complete, resets on reload and preserves the wait across worker restarts',async()=>{
  const f=fixture({});let a=f.create();f.state.tabStatus='loading';await a.setEnabled(true);await a.tick();
  assert.deepEqual(f.calls,[]);
  f.state.tabStatus='complete';await a.tick();await a.tick();assert.deepEqual(f.calls,[]);
  f.state.tabStatus='loading';await a.tick();f.state.tabStatus='complete';await a.tick();
  a=f.create();await a.tick();await a.tick();assert.deepEqual(f.calls,[]);
  f.state.editorReady=false;await a.tick();assert.deepEqual(f.calls,['auto-ready']);
  f.state.editorReady=true;await a.tick();assert.equal(f.counts().sent,1);assert.equal(f.created(),1);
});

test('unready or frozen pages wait without filling and pause at the existing deadline',async()=>{
  for(const frozen of [false,true]){
    const f=fixture(),a=f.create();f.state.editorReady=false;f.state.hungReady=frozen;
    await a.setEnabled(true);await a.tick();assert.equal(f.counts().sent,0);
    assert.ok(!f.calls.includes('auto-prepare'));
    f.advance();await a.tick();assert.equal((await a.read()).phase,'paused');
    assert.equal(f.state.retries,0);assert.equal(f.created(),1);
  }
});

test('cancel or disable during page settling never fills or sends',async()=>{
  for(const cancel of [false,true]){
    const f=fixture({}),a=f.create();await a.setEnabled(true);await a.tick();
    if(cancel)f.state.jobs=[];else await a.setEnabled(false);
    for(let i=0;i<6;i++)await a.tick();assert.deepEqual(f.calls,[]);assert.equal(f.counts().sent,0);
  }
});

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

test('source Copy is only used for stable invalid rendered JSON and saves once without resending',async()=>{
  const f=fixture();let a=f.create();
  f.state.poll={text:'{"answer":"new response","quote":"He said "hello"."}',busy:true,copyTarget:{messageId:'reply',text:'rendered'}};
  f.state.rawText=JSON.stringify({answer:'new response',quote:'He said "hello".'});
  await a.setEnabled(true);for(let i=0;i<6;i++)await a.tick();
  assert.equal(f.state.rawReads||0,0);assert.equal(f.counts().saved,0);
  f.state.poll.busy=false;for(let i=0;i<3;i++)await a.tick();
  assert.equal(f.state.rawReads||0,0);
  a=f.create();for(let i=0;i<5;i++)await a.tick();
  assert.equal(f.state.rawReads,1);assert.deepEqual(f.counts(),{sent:1,saved:1});
  assert.equal(f.state.retries,0);assert.deepEqual(f.closed,[9]);
});

test('valid rendered JSON does not use Copy and failed Copy never saves invalid content',async()=>{
  const f=fixture(),a=f.create();f.state.poll.copyTarget={messageId:'reply'};
  await a.setEnabled(true);for(let i=0;i<7;i++)await a.tick();
  assert.equal(f.state.rawReads||0,0);assert.equal(f.counts().saved,1);
  const g=fixture(),b=g.create();g.state.poll={text:'Invalid JSON',busy:false,copyTarget:{messageId:'reply'}};g.state.rawError='Response changed before copy';
  await b.setEnabled(true);for(let i=0;i<7;i++)await b.tick();
  assert.ok(g.state.rawReads>0);assert.deepEqual(g.counts(),{sent:1,saved:0});assert.deepEqual(g.closed,[]);
});

test('stable malformed source quotes use app recovery once and never resend the prompt',async()=>{
  for(const copy of [false,true]){
    const f=fixture(),a=f.create();
    f.state.poll={text:'{"answer":"new response","evidence":"He said "hello"."}',busy:false};
    if(copy){f.state.poll.copyTarget={messageId:'reply'};f.state.rawText=f.state.poll.text;}
    f.state.parsedResult={answer:'new response',evidence:'He said "hello".'};
    await a.setEnabled(true);for(let i=0;i<9;i++)await a.tick();
    assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.state.parseReads,1);
    assert.equal(f.state.rawReads||0,copy?1:0);assert.equal(f.state.retries,0);
    assert.deepEqual(f.closed,[9]);
  }
});

test('manual Bridge capture uses the same recovery; valid JSON needs no extra app request',async()=>{
  const expected={issues:[],summary:'He said "hello".'};let calls=0;
  const request=async(path,method,body)=>{calls++;assert.equal(path,'/jobs/audit/parse-result');assert.equal(method,'POST');assert.equal(body.attempt,2);return {result:expected}};
  assert.deepEqual(await parseBridgeResult(JSON.stringify(expected),request,{id:'audit',attempt:2}),expected);
  assert.equal(calls,0);
  assert.deepEqual(await parseBridgeResult('{"issues":[],"summary":"He said "hello"."}',request,{id:'audit',attempt:2}),expected);
  assert.equal(calls,1);
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
test('uncertain send response resumes reading automatically and never sends twice',async()=>{
  const f=fixture(),a=f.create();f.state.lostSend=true;await a.setEnabled(true);await a.tick();
  assert.equal((await a.read()).phase,'submitted');f.advance(6000);
  for(let i=0;i<4;i++)await a.tick();assert.deepEqual(f.counts(),{sent:1,saved:1});
});

test('hung renderer reads time out and a late callback cannot save or block the next read',async()=>{
  const f=fixture();let a=f.create();await a.setEnabled(true);await a.tick();
  f.state.hungPoll=true;await a.tick();
  const waiting=await a.read();assert.equal(waiting.phase,'submitted');assert.equal(waiting.pollErrors,1);
  assert.deepEqual(f.counts(),{sent:1,saved:0});
  f.state.finishPoll({ok:true,text:'{"answer":"stale callback"}',busy:false});
  f.state.hungPoll=false;f.advance(6000);a=f.create();
  for(let i=0;i<6;i++)await a.tick();
  assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.created(),1);assert.equal(f.state.retries,0);
});

test('disconnected response collection reconnects across worker restarts without a popup',async()=>{
  for(const mode of ['poll','ping']){
    const f=fixture();let a=f.create();await a.setEnabled(true);await a.tick();
    if(mode==='poll')f.state.pollError='A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';
    else f.state.connectionError='Could not establish connection. Receiving end does not exist.';
    await a.tick();assert.equal((await a.read()).phase,'submitted');
    a=f.create();f.state.pollError=null;f.state.connectionError=null;f.advance(6000);
    for(let i=0;i<6;i++)await a.tick();
    assert.deepEqual(f.counts(),{sent:1,saved:1});assert.equal(f.created(),1);assert.equal(f.state.retries,0);
  }
});

test('repeated collection disconnects respect the original hard deadline',async()=>{
  const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();
  const deadline=(await a.read()).collectionDeadline;
  f.state.pollError='Response port closed';
  for(let i=0;i<3;i++){f.advance(3*60*1000);await a.tick();assert.equal((await a.read()).collectionDeadline,deadline)}
  f.advance(7*60*1000);await a.tick();
  assert.equal((await a.read()).phase,'paused');assert.deepEqual(f.counts(),{sent:1,saved:0});
  assert.equal(f.calls.filter(x=>x==='auto-poll').length,3);
  for(let i=0;i<5;i++)await a.tick();assert.equal((await a.read()).phase,'paused');
});

test('cancel or disable during read reconnection does not collect or resend',async()=>{
  for(const cancel of [true,false]){
    const f=fixture(),a=f.create();await a.setEnabled(true);await a.tick();
    f.state.hungPoll=true;await a.tick();
    if(cancel)f.state.jobs=[];else await a.setEnabled(false);
    f.state.hungPoll=false;f.advance(6000);for(let i=0;i<6;i++)await a.tick();
    assert.deepEqual(f.counts(),{sent:1,saved:0});assert.equal(f.created(),1);
  }
});

test('tab read deadline also bounds a hung ping/injection and clears after success',async()=>{
  await assert.rejects(withTabReadDeadline(()=>new Promise(()=>{}),10),{code:'TAB_READ_TIMEOUT'});
  assert.deepEqual(await withTabReadDeadline(async()=>({version:'test'}),10),{version:'test'});
  await assert.rejects(withTabReadDeadline(async()=>{throw Error('Disconnected')},10),/Disconnected/);
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
  f.db.autoBridge={...f.db.autoBridge,phase:'paused',collectionRecovered:true,resumePhase:'submitted',message:'Đã hết thời gian chờ. Kiểm tra tab AI rồi bấm Tiếp tục lấy kết quả; prompt không được gửi lại.'};
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
