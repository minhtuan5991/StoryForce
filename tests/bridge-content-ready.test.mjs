import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';
import {createContentConnection} from '../browser-extension/content-connection.js';

const manifest=JSON.parse(readFileSync(new URL('../browser-extension/manifest.json',import.meta.url),'utf8'));
const hosts=['chatgpt.com','gemini.google.com','aistudio.google.com','labs.google','flow.google.com'];
function fixture(host='chatgpt.com') {
  const dom=new JSDOM('<main><div id="prompt-textarea" role="textbox" contenteditable="true"></div></main>',
    {url:'https://'+host+'/',runScripts:'outside-only'});
  const w=dom.window,listeners=new Set();let time=0,version=manifest.version,injections=0;
  w.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent},configurable:true});
  Object.defineProperty(w.HTMLElement.prototype,'isContentEditable',{get(){return this.getAttribute('contenteditable')==='true'}});
  Object.defineProperty(w.document,'readyState',{value:'complete',configurable:true});
  w.performance.now=()=>time;
  const invoke=message=>new Promise((resolve,reject)=>{
    if(!listeners.size)return reject(Error('Receiving end does not exist'));
    for(const listener of listeners)listener({type:'storyforge',...message},{},resolve);
  });
  const install=files=>files.forEach(file=>w.eval(readFileSync(new URL('../browser-extension/'+file,import.meta.url),'utf8')));
  const chrome={runtime:{getManifest:()=>({...manifest,version}),onMessage:{
    addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},
    tabs:{get:async()=>({url:w.location.href}),sendMessage:async(id,message)=>invoke(message)},
    scripting:{executeScript:async({files})=>{injections++;install(files)}}};
  w.chrome=chrome;
  install(['adapters.js','content.js']);
  const ensure=createContentConnection({chrome,allowedHosts:hosts,readTimeoutMs:20});
  return {w,chrome,ensure,invoke,install,listeners,dom,advance:ms=>{time+=ms},injections:()=>injections,
    setVersion:value=>{version=value}};
}

test('different selector and extension versions preserve the editor stability window across worker ticks',async()=>{
  const f=fixture();try {
    assert.notEqual(f.w.STORYFORGE_ADAPTERS.version,manifest.version);
    await f.ensure(9);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    f.advance(2100);await f.ensure(9);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,true);
    for(let i=0;i<4;i++)await f.ensure(9);
    assert.equal(f.injections(),0);assert.equal(f.listeners.size,1);
  } finally {f.dom.window.close()}
});

test('a genuine extension upgrade reinjects once and then allows the same editor to become ready',async()=>{
  const f=fixture();try {
    f.setVersion('1.1.29');f.install(['content.js']);f.setVersion(manifest.version);
    await f.ensure(9);assert.equal(f.injections(),1);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    f.advance(2100);await f.ensure(9);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,true);
    assert.equal(f.injections(),1);assert.equal(f.listeners.size,1);
  } finally {f.dom.window.close()}
});

test('a disconnected same-version listener is repaired once without accumulating listeners',async()=>{
  const f=fixture();try {
    f.listeners.clear();await f.ensure(9);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    f.advance(2100);await f.ensure(9);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,true);
    assert.equal(f.injections(),1);assert.equal(f.listeners.size,1);
  } finally {f.dom.window.close()}
});

test('an unresponsive renderer never receives additional script injections',async()=>{
  const f=fixture();try {
    f.chrome.tabs.sendMessage=()=>new Promise(()=>{});
    await assert.rejects(f.ensure(9),error=>error.code==='TAB_READ_TIMEOUT');
    assert.equal(f.injections(),0);
  } finally {f.dom.window.close()}
});

test('loading, changed editors and an active AI response reset readiness instead of allowing a premature fill',async()=>{
  const f=fixture();try {
    await f.invoke({action:'auto-ready'});f.advance(2100);
    const field=f.w.document.querySelector('#prompt-textarea');field.textContent='My draft';
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    f.advance(2100);assert.equal((await f.invoke({action:'auto-ready'})).ready,true);
    Object.defineProperty(f.w.document,'readyState',{value:'loading',configurable:true});
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    Object.defineProperty(f.w.document,'readyState',{value:'complete',configurable:true});
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    f.advance(2100);assert.equal((await f.invoke({action:'auto-ready'})).ready,true);
    f.w.document.querySelector('main').insertAdjacentHTML('beforeend','<button data-testid="stop-button">Stop</button>');
    assert.equal((await f.invoke({action:'auto-ready'})).ready,false);
    assert.equal(field.textContent,'My draft');
  } finally {f.dom.window.close()}
});

for(const host of ['chatgpt.com','gemini.google.com']){
test(host+' requires 500ms of an unchanged usable editor and resets on remount, draft edits or busy state',async()=>{
  const f=fixture(host);try {
    const observe=()=>f.invoke({action:'auto-ready'});
    assert.equal((await observe()).ready,false);
    f.advance(499);assert.equal((await observe()).ready,false);
    f.advance(1);await f.ensure(9);assert.equal((await observe()).ready,true);
    let field=f.w.document.querySelector('#prompt-textarea');
    const replacement=field.cloneNode(true);field.replaceWith(replacement);field=replacement;
    assert.equal((await observe()).ready,false);
    f.advance(499);field.textContent='My unsent draft';assert.equal((await observe()).ready,false);
    f.advance(500);assert.equal((await observe()).ready,true);
    field.setAttribute('aria-disabled','true');assert.equal((await observe()).ready,false);
    f.advance(1000);field.removeAttribute('aria-disabled');assert.equal((await observe()).ready,false);
    f.advance(500);assert.equal((await observe()).ready,true);
    const busy=f.w.document.createElement('button');busy.setAttribute(host==='chatgpt.com'?'data-testid':'data-test-id','stop-button');
    f.w.document.querySelector('main').append(busy);assert.equal((await observe()).ready,false);
    f.advance(1000);busy.remove();assert.equal((await observe()).ready,false);
    f.advance(500);assert.equal((await observe()).ready,true);
    assert.equal(field.textContent,'My unsent draft');assert.equal(f.injections(),0);
  } finally {f.dom.window.close()}
});
}

test('a page that resumes loading after readiness never starts Paste',async()=>{
  const f=fixture();try {
    await f.invoke({action:'auto-ready'});f.advance(500);
    assert.equal((await f.invoke({action:'auto-ready'})).ready,true);
    Object.defineProperty(f.w.document,'readyState',{value:'loading',configurable:true});
    const result=await f.invoke({action:'auto-prepare',jobKey:'load:1',prompt:'Must not be pasted'});
    assert.equal(result.ok,false);assert.equal(result.code,'INPUT_NOT_READY');
    assert.equal(f.w.document.querySelector('#prompt-textarea').textContent,'');
  } finally {f.dom.window.close()}
});

test('every provider reports the installed extension version without repeated reinjection',async()=>{
  for(const host of hosts){const f=fixture(host);try {
    for(let i=0;i<3;i++)await f.ensure(9);
    assert.equal((await f.invoke({action:'ping'})).version,manifest.version);
    assert.equal(f.injections(),0);
  } finally {f.dom.window.close()}}
});

test('a disconnected tab on an unsupported site cannot receive Bridge scripts',async()=>{
  const f=fixture('example.com');try {
    f.listeners.clear();await assert.rejects(f.ensure(9),/Unsupported provider tab/);
    assert.equal(f.injections(),0);
  } finally {f.dom.window.close()}
});

test('only a new completed assistant turn can report an empty response',async()=>{
  const f=fixture();try {
    const main=f.w.document.querySelector('main');
    main.insertAdjacentHTML('beforeend','<div data-turn="assistant" data-turn-key="a1"><div class="turn-action-controls"><button aria-label="Sao chép"></button></div></div>');
    const result=await f.invoke({action:'auto-poll',baseline:{count:0,last:''}});
    assert.equal(result.emptyResponse,true);assert.equal(result.busy,false);
    assert.equal((await f.invoke({action:'auto-poll',baseline:{count:1,last:''}})).emptyResponse,false);
    main.insertAdjacentHTML('beforeend','<button aria-label="Ngừng"></button>');
    const active=await f.invoke({action:'auto-poll',baseline:{count:0,last:''}});
    assert.equal(active.busy,true);assert.equal(active.emptyResponse,false);
  } finally {f.dom.window.close()}
});

test('user Copy controls and unfinished empty assistant turns never report completion',async()=>{
  const f=fixture();try {
    f.w.document.querySelector('main').insertAdjacentHTML('beforeend','<div data-turn-key="turn"><div data-turn="user"><div class="turn-action-controls"><button aria-label="Sao chép"></button></div></div><div data-turn="assistant"></div></div>');
    const result=await f.invoke({action:'auto-poll',baseline:{count:0,last:''}});
    assert.equal(result.busy,true);assert.equal(result.emptyResponse,false);
  } finally {f.dom.window.close()}
});

test('a distinct completed correction with identical text is read once instead of treated as the old reply',async()=>{
  const f=fixture();try {
    const main=f.w.document.querySelector('main');
    for(const id of ['reply1','reply2'])main.insertAdjacentHTML('beforeend',
      '<div data-turn="assistant" data-turn-key="'+id+'"><div class="markdown">Not JSON</div><div class="turn-action-controls"><button aria-label="Copy"></button></div></div>');
    const baseline={count:1,last:'Not JSON',id:'reply1'};
    const result=await f.invoke({action:'auto-poll',baseline});
    assert.equal(result.text,'Not JSON');assert.equal(result.busy,false);assert.equal(result.capture.fresh,true);
    const old=await f.invoke({action:'auto-poll',baseline:{count:2,last:'Not JSON',id:'reply2'}});
    assert.equal(old.text,'');assert.equal(old.capture.fresh,false);
  } finally {f.dom.window.close()}
});
