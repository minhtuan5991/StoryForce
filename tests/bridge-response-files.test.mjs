import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';

const script=file=>readFileSync(new URL('../browser-extension/'+file,import.meta.url),'utf8');
function fixture({source=JSON.stringify({replacements:[{old_text:'He said "hello".',new_text:'Full text.\nFinal line.'}]}),empty=false}={}){
  const dom=new JSDOM(`<main><div data-turn="assistant" data-turn-key="turn-1" data-message-id="reply-1">
    <div data-chatgpt-selection-message-id="selection-1"><div class="markdown">${empty?'':'The complete JSON is in the file.'}</div>
      <button id="file-card" data-filename="answer.json">answer.json\nCode</button></div>
    <div class="turn-action-controls"><button aria-label="Sao chép">Copy</button></div></div>
    <div id="prompt-textarea" contenteditable="true"></div></main>
    <aside id="panel"><button title="answer.json">Answer</button><button id="download" aria-label="Download">Download</button>
      <div class="monaco-editor"><div class="view-line">Only the last visible line }</div></div></aside>`,
    {url:'https://chatgpt.com/c/file-test',runScripts:'outside-only'});
  const w=dom.window;let listener,loads=0,downloads=0,clicks=0,releases=0;
  w.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent},configurable:true});
  w.TextDecoder=TextDecoder;w.AbortController=AbortController;
  w.chrome={runtime:{getManifest:()=>({version:'1.1.34'}),onMessage:{addListener:fn=>{listener=fn},removeListener:()=>{}}}};
  const original=function(){downloads++};w.HTMLAnchorElement.prototype.click=original;
  const revoke=function(){releases++};w.URL.revokeObjectURL=revoke;
  w.fetch=async()=>{loads++;return new Response(source,{headers:{'content-type':'application/json'}})};
  w.document.querySelector('#download').addEventListener('click',()=>{
    clicks++;const a=w.document.createElement('a');a.href='blob:https://chatgpt.com/native-source';a.download='answer.json';a.click();w.URL.revokeObjectURL(a.href);
  });
  for(const file of ['adapters.js','response-files.js','content.js'])w.eval(script(file));
  const invoke=message=>new Promise(resolve=>listener({type:'storyforge',...message},{},resolve));
  return {w,dom,invoke,source,original,revoke,counts:()=>({loads,downloads,clicks,releases})};
}

test('reads the full native JSON file rather than the scrolled editor or surrounding prose',async()=>{
  const f=fixture();try{
    const result=await f.invoke({action:'auto-poll',baseline:{count:0,last:''}});
    assert.deepEqual(JSON.parse(JSON.stringify(result.fileTarget.files)),['answer.json']);
    assert.equal(result.busy,false);
    const file=await f.w.storyForgeResponseFiles.read(result.fileTarget,500);
    assert.equal(file.text,f.source);assert.equal(file.filename,'answer.json');
    assert.deepEqual(JSON.parse(file.text),JSON.parse(f.source));
    assert.equal(f.counts().clicks,1);assert.equal(f.counts().downloads,0);
    assert.equal(f.w.HTMLAnchorElement.prototype.click,f.original);assert.equal(f.w.URL.revokeObjectURL,f.revoke);
    const cached=await f.w.storyForgeResponseFiles.read(result.fileTarget,500);
    assert.equal(cached.text,f.source);assert.equal(f.counts().loads,1);
    assert.deepEqual((await f.invoke({action:'capture'})).fileTarget.files,result.fileTarget.files);
  }finally{f.dom.window.close()}
});

test('a file-only completed turn is not mistaken for an empty AI response',async()=>{
  const f=fixture({empty:true});try{
    const result=await f.invoke({action:'auto-poll',baseline:{count:0,last:''}});
    assert.equal(result.emptyResponse,false);assert.equal(result.text,'Response file: answer.json');
    assert.equal((await f.w.storyForgeResponseFiles.read(result.fileTarget,500)).text,f.source);
  }finally{f.dom.window.close()}
});

test('reinjection preserves an in-flight reader and does not stack download hooks',async()=>{
  const f=fixture();try{
    const target=(await f.invoke({action:'capture'})).fileTarget;
    let finish;
    f.w.fetch=()=>new Promise(resolve=>{finish=resolve});
    const reader=f.w.storyForgeResponseFiles;
    const first=reader.read(target,500);
    f.w.eval(script('response-files.js'));
    assert.equal(f.w.storyForgeResponseFiles,reader);
    const duplicate=await reader.read(target,500);
    assert.match(duplicate.error,/already in progress/);
    finish(new Response(f.source,{headers:{'content-type':'application/json'}}));
    assert.equal((await first).text,f.source);
    assert.equal(f.counts().clicks,1);
    assert.equal(f.w.HTMLAnchorElement.prototype.click,f.original);
    assert.equal(f.w.URL.revokeObjectURL,f.revoke);
  }finally{f.dom.window.close()}
});

test('stale replies and a canvas with a different filename cannot supply a result',async()=>{
  const f=fixture();try{
    const target=(await f.invoke({action:'capture'})).fileTarget;
    f.w.document.querySelector('#panel button').title='another-project.json';
    const wrong=await f.w.storyForgeResponseFiles.read(target,30);
    assert.equal(wrong.code,'FILE_RESPONSE_UNAVAILABLE');assert.equal(f.counts().clicks,0);
    f.w.document.querySelector('main').insertAdjacentHTML('beforeend','<div data-turn="assistant" data-message-id="new">A newer answer</div>');
    const stale=await f.w.storyForgeResponseFiles.read(target,30);
    assert.match(stale.error,/newer assistant response/);assert.equal(f.counts().clicks,0);
  }finally{f.dom.window.close()}
});

test('rejects oversized or HTML files and restores the page hooks after failures',async()=>{
  const f=fixture();try{
    const target=(await f.invoke({action:'capture'})).fileTarget;
    f.w.fetch=async()=>new Response('too large',{headers:{'content-length':'2000001'}});
    const large=await f.w.storyForgeResponseFiles.read(target,500);assert.match(large.error,/smaller than 2 MB/);
    f.w.fetch=async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}});
    const html=await f.w.storyForgeResponseFiles.read(target,500);assert.match(html.error,/sign-in\/error page/);
    assert.equal(f.w.HTMLAnchorElement.prototype.click,f.original);assert.equal(f.w.URL.revokeObjectURL,f.revoke);
  }finally{f.dom.window.close()}
});

test('never opens an external JSON link or guesses between two JSON files',async()=>{
  const f=fixture();try{
    f.w.document.querySelector('#file-card').outerHTML='<a href="https://example.com/answer.json">Download</a>';
    const target=(await f.invoke({action:'capture'})).fileTarget;
    assert.match((await f.w.storyForgeResponseFiles.read(target,50)).error,/outside the supported provider/);
    assert.equal(f.counts().loads,0);assert.equal(f.counts().downloads,0);
    f.w.document.querySelector('[data-chatgpt-selection-message-id]').insertAdjacentHTML('beforeend','<button data-filename="second.json">second.json</button>');
    const multiple=(await f.invoke({action:'capture'})).fileTarget;
    assert.match((await f.w.storyForgeResponseFiles.read(multiple,50)).error,/multiple files/);
  }finally{f.dom.window.close()}
});

test('reads a TXT download link belonging to the current response',async()=>{
  const f=fixture();try{
    f.w.document.querySelector('#file-card').outerHTML='<a href="blob:https://chatgpt.com/native-source" download="answer.txt">answer.txt</a>';
    f.w.fetch=async()=>new Response('\uFEFF'+f.source,{headers:{'content-type':'text/plain; charset=utf-8'}});
    const target=(await f.invoke({action:'capture'})).fileTarget;
    const file=await f.w.storyForgeResponseFiles.read(target,500);
    assert.equal(file.text,f.source);assert.equal(file.filename,'answer.txt');
    assert.equal(f.counts().clicks,0);assert.equal(f.counts().downloads,0);
  }finally{f.dom.window.close()}
});
