import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMediaBridge} from '../browser-extension/media-automatic.js';
import {providerPage,projectSessionKey} from '../browser-extension/media-sessions.js';

function fixture(provider='gemini'){
  const storage={autoBridge:{enabled:true}},tabs=new Map(),claims={},sessions={},actions=[],opens=[],downloads=[];
  let time=1000,nextId=0;
  const state={jobs:[],fail:false};
  const base=provider==='gemini'?'https://gemini.google.com/app':provider==='flow'?'https://flow.google.com/':'https://aistudio.google.com/generate-speech';
  const page=id=>provider==='gemini'?'https://gemini.google.com/app/'+id:provider==='flow'?'https://flow.google.com/project/'+id:'https://aistudio.google.com/prompts/'+id;
  const job=(project,id)=>({id,project_id:project,provider,attempt:1,url:base,prompt:'Prompt '+id,
    media:{project_id:project,folder:'Same title',filename:'scene_001.'+(provider==='flow'?'mp4':provider==='gemini'?'png':'wav')},media_session:sessions[project]||{}});
  const chrome={storage:{local:{get:async key=>({[key]:structuredClone(storage[key])}),set:async value=>Object.assign(storage,structuredClone(value))}},
    tabs:{create:async options=>{const tab={id:++nextId,url:options.url,status:'complete'};tabs.set(tab.id,tab);opens.push(options.url);return {...tab}},
      get:async id=>{if(!tabs.has(id))throw Error('No tab with id');return {...tabs.get(id)}},
      update:async(id,options)=>{Object.assign(tabs.get(id),options);return {...tabs.get(id)}},
      sendMessage:async(id,message)=>{
        actions.push({id,...message});
        if(message.action==='media-setup'||message.action==='media-ready')return {ok:true,ready:true};
        if(message.action==='media-prepare')return {ok:true,baseline:[]};
        if(message.action==='media-send'){tabs.get(id).url=page(message.media.project_id);return {ok:true}}
        if(message.action==='media-poll')return {ok:true,ready:!state.fail,result:{url:'blob:result-'+message.jobId}};
        if(message.action==='media-download-info')return {ok:true,direct:true,url:'https://media.test/'+message.jobId};
        return {ok:true};
      }},downloads:{download:async options=>{const id=downloads.length+1;downloads.push({id,state:'complete',url:options.url,filename:'C:/Downloads/'+options.filename});return id},
        search:async options=>downloads.filter(item=>!options.id||item.id===options.id)}};
  const request=async(path,method,body)=>{
    if(path==='/jobs')return {items:state.jobs.map(j=>({...j,media_session:sessions[j.project_id]||j.media_session}))};
    const id=path.split('/')[2],current=state.jobs.find(j=>j.id===id);
    if(path.endsWith('/claim')){
      const claim=claims[id]||={owner:body.owner,attempt:1,phase:'claimed'};
      assert.equal(body.owner,claim.owner);
      const send=!!body.authorize_send&&claim.phase!=='sent';if(send)claim.phase='sent';return {claim,send};
    }
    if(path.endsWith('/session')){sessions[current.project_id]={url:body.url,...(claims[id].phase==='sent'?{last_prompt:current.prompt}:{})};return {saved:true}}
    if(path.endsWith('/references'))return {files:[]};
    if(path.endsWith('/result')||path.endsWith('/failure')){state.jobs=state.jobs.filter(j=>j.id!==id);return {accepted:true}}
    return {updated:true};
  };
  const create=()=>createMediaBridge({chrome,request,ensureContent:async()=>{},now:()=>time,pageSettleMs:0});
  let engine=create();
  const tick=async(count=1)=>{for(let i=0;i<count;i++){time+=2000;await engine.tick()}};
  return {state,storage,tabs,sessions,opens,actions,job,page,tick,create,engine:()=>engine,restart:()=>engine=create(),advance:ms=>time+=ms};
}

test('project identity isolates equal titles and reuses the original Gemini chat after A -> B -> A',async()=>{
  const f=fixture();
  for(const [project,id] of [['A','a1'],['B','b1'],['A','a2']]){f.state.jobs=[f.job(project,id)];await f.tick(8);assert.equal((await f.engine().read()).phase,'idle')}
  assert.equal(f.opens.length,2);
  const sends=f.actions.filter(a=>a.action==='media-send');
  assert.deepEqual(sends.map(a=>a.jobId),['a1','b1','a2']);
  assert.equal(sends[0].id,sends[2].id);assert.notEqual(sends[0].id,sends[1].id);
  assert.equal(f.sessions.A.url,f.page('A'));assert.equal(f.sessions.B.url,f.page('B'));
});

test('a failed submitted scene preserves the chat, restores it for the next scene and never resends the failed prompt',async()=>{
  const f=fixture();f.state.jobs=[f.job('A','failed')];f.state.fail=true;await f.tick(4);
  assert.equal((await f.engine().read()).phase,'submitted');
  f.advance(30*60*1000);await f.tick();assert.equal((await f.engine().read()).phase,'idle');
  assert.equal(f.sessions.A.url,f.page('A'));
  f.state.fail=false;f.state.jobs=[f.job('A','next')];await f.tick(9);
  assert.deepEqual(f.actions.filter(a=>a.action==='media-send').map(a=>a.jobId),['failed','next']);
  assert.equal(f.opens.length,1);
  assert.ok(f.actions.some(a=>a.action==='media-setup'&&a.jobId==='next'&&a.recovery));
});

test('server saved page and previous prompt recover a closed dialog after browser storage is lost',async()=>{
  const f=fixture('aistudio');f.state.jobs=[f.job('A','one')];await f.tick(8);
  delete f.storage.mediaBridge;f.tabs.clear();f.restart();f.state.jobs=[f.job('A','two')];await f.tick(8);
  assert.equal(f.opens[1],f.page('A'));
  const prepare=f.actions.find(a=>a.action==='media-prepare'&&a.jobId==='two');
  assert.equal(prepare.previousPrompt,'Prompt one');
  assert.deepEqual(f.actions.filter(a=>a.action==='media-send').map(a=>a.jobId),['one','two']);
});

test('Gemini adopts the durable chat URL appearing after Send; Flow discards only clip editor suffixes',()=>{
  assert.equal(providerPage('gemini','https://gemini.google.com/app'),undefined);
  assert.equal(providerPage('gemini','https://gemini.google.com/app/story?account=1#anchor'),'https://gemini.google.com/app/story');
  assert.equal(providerPage('flow','https://labs.google/fx/tools/flow/project/story/edit/clip?x=1'),'https://labs.google/fx/tools/flow/project/story');
  assert.equal(providerPage('flow','https://flow.google.com/'),undefined);
  assert.equal(providerPage('gemini','https://gemini.google.com.evil.test/app/story'),undefined);
  assert.notEqual(projectSessionKey({project_id:'A',provider:'gemini',media:{folder:'Same'}}),projectSessionKey({project_id:'B',provider:'gemini',media:{folder:'Same'}}));
});
