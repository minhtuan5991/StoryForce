import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from '../frontend/node_modules/playwright/index.mjs';

// The production extension runs in its real isolated world with manifest
// clipboard permissions. All provider URLs are local DOM fixtures; no AI sends.
let context,worker,counter=0;
before(async()=>{
  const extension=path.resolve('browser-extension');
  context=await chromium.launchPersistentContext('',{channel:process.env.STORYFORGE_TEST_BROWSER?undefined:'chromium',
    executablePath:process.env.STORYFORGE_TEST_BROWSER,headless:true,ignoreDefaultArgs:['--disable-extensions'],
    args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  await context.route('**/*',route=>route.request().url().startsWith('chrome-extension://')?route.continue():
    route.fulfill({contentType:'text/html',body:'<!doctype html><title>Blocked test request</title>'}));
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
});
after(async()=>{await context?.close()});
async function fixture(host,body){
  const url='https://'+host+'/app/paste-fixture-'+(++counter),page=await context.newPage();
  await page.route(url,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8">'+body+`<script>
    window.pastes=[];window.sends=0;
    document.addEventListener('paste',e=>window.pastes.push({trusted:e.isTrusted,characters:e.clipboardData.getData('text/plain').length,text:e.clipboardData.getData('text/plain')}));
    document.querySelector('#send').onclick=()=>window.sends++;
  </script>`}));
  await page.goto(url);
  const invoke=message=>worker.evaluate(async({url,message})=>{
    const [tab]=await chrome.tabs.query({url});
    return chrome.tabs.sendMessage(tab.id,{type:'storyforge',...message});
  },{url,message});
  const tabId=await worker.evaluate(async url=>{
    const [tab]=await chrome.tabs.query({url});
    return tab.id;
  },url);
  return {page,url,tabId,invoke,close:()=>page.close()};
}
const prompt='Scene 001: Tiếng Việt and “quoted dialogue”.\n\n{"line":"A\\\"B","duration":10}\nThe final line.';
test('real extension connection retains the readiness timer instead of reinjecting every tick',async()=>{
  const f=await fixture('chatgpt.com','<main><form><div contenteditable="true" role="textbox" id="prompt-textarea"></div><button type="button" id="send" data-testid="composer-send-button">Send</button></form></main>');
  const connectionPage=await context.newPage();
  try {
    await connectionPage.goto(worker.url().replace(/background\.js$/,'popup.html'));
    const observe=()=>connectionPage.evaluate(async tabId=>{
      const {createContentConnection}=await import(chrome.runtime.getURL('content-connection.js'));
      await createContentConnection({chrome,allowedHosts:['chatgpt.com']})(tabId);
      const ping=await chrome.tabs.sendMessage(tabId,{type:'storyforge',action:'ping'});
      const readiness=await chrome.tabs.sendMessage(tabId,{type:'storyforge',action:'auto-ready'});
      return {ping,readiness,version:chrome.runtime.getManifest().version};
    },f.tabId);
    const first=await observe();assert.equal(first.ping.version,first.version);assert.equal(first.readiness.ready,false);
    await f.page.waitForTimeout(2100);
    assert.equal((await observe()).readiness.ready,true);
    const prepared=await f.invoke({action:'auto-prepare',jobKey:'stable:1',prompt});assert.equal(prepared.ok,true,prepared.error);
    assert.equal(await f.page.evaluate(()=>window.pastes.length),1);
    assert.equal(await f.page.evaluate(()=>window.sends),0);
  } finally {await connectionPage.close();await f.close()}
});
for(const [provider,host,field,button] of [
  ['gemini','gemini.google.com','<rich-textarea><div contenteditable="true" role="textbox" class="ql-editor"></div></rich-textarea>','Send message'],
  ['flow','flow.google.com','<div contenteditable="true" role="textbox"></div>','Generate'],
  ['aistudio','aistudio.google.com','<textarea aria-label="Text"></textarea>','Run'],
]){
  test(provider+' receives a trusted native Paste with all lines, and replaces only its owned previous scene',async()=>{
    const f=await fixture(host,'<main><form>'+field+'<button type="button" id="send" aria-label="'+button+'">'+button+'</button></form></main>');
    try{
      const message={provider,jobId:'first',prompt};
      const prepared=await f.invoke({...message,action:'media-prepare'});
      assert.equal(prepared.ok,true,prepared.error);
      assert.deepEqual(prepared.baseline,[]);
      assert.equal((await f.invoke({...message,action:'media-ready'})).ready,true);
      assert.equal((await f.invoke({...message,action:'media-send'})).submitted,true);
      await f.invoke({...message,action:'media-send'});
      assert.equal(await f.page.evaluate(()=>window.sends),1);
      const next={...message,jobId:'second',prompt:prompt+'\nNext scene.',previousPrompt:prompt};
      assert.equal((await f.invoke({...next,action:'media-prepare'})).ok,true);
      const events=await f.page.evaluate(()=>window.pastes);
      assert.equal(events.length,2);assert.ok(events.every(e=>e.trusted));
      assert.equal(events[0].text.replace(/\r\n?/g,'\n'),prompt);
      assert.equal(events[1].text.replace(/\r\n?/g,'\n'),next.prompt);
      await f.page.locator('textarea,[contenteditable]').evaluate(el=>{'value' in el?el.value='My unsent edit':el.textContent='My unsent edit'});
      const blocked=await f.invoke({...next,jobId:'third',prompt:'Third scene.',previousPrompt:next.prompt,action:'media-prepare'});
      assert.equal(blocked.ok,false);assert.match(blocked.error,/không xóa/);
      assert.equal(await f.page.evaluate(()=>window.pastes.length),2);
    }finally{await f.close()}
  });
}
test('ChatGPT text and Gemini JSON use native Paste and send once after exact verification',async()=>{
  for(const host of ['chatgpt.com','gemini.google.com']){
    const f=await fixture(host,'<main><form><div contenteditable="true" role="textbox" id="prompt-textarea"></div><button type="button" id="send" data-testid="composer-send-button" aria-label="Send message">Send</button></form></main>');
    try{
      const message={jobKey:host+':1',prompt,action:'auto-prepare'};
      const prepared=await f.invoke(message);assert.equal(prepared.ok,true,prepared.error);
      assert.equal((await f.invoke({...message,action:'auto-check-send',baseline:prepared.baseline})).ready,true);
      assert.equal((await f.invoke({...message,action:'auto-send',baseline:prepared.baseline})).submitted,true);
      assert.equal((await f.invoke({...message,action:'auto-send',baseline:prepared.baseline})).ok,false);
      assert.equal(await f.page.evaluate(()=>window.sends),1);
      assert.equal(await f.page.evaluate(()=>window.pastes[0].trusted),true);
    }finally{await f.close()}
  }
});
function fileFixtureHTML(){return `<main><form><div id="prompt-textarea" contenteditable="true" role="textbox"></div><div id="files"></div><button type="button" id="send" data-testid="composer-send-button">Send</button></form></main>
  <script>
    document.querySelector('#prompt-textarea').addEventListener('paste',e=>{
      if(e.clipboardData.getData('text/plain').length<1000)return;
      e.preventDefault();document.querySelector('#files').innerHTML='<div data-testid="attachment"><span id="status">Adding pasted text...</span><span role="progressbar"></span><button type="button" aria-label="Remove file pasted.txt">×</button></div>';
      document.querySelector('[aria-label="Remove file pasted.txt"]').onclick=()=>document.querySelector('#files').replaceChildren();
    });
    window.finishUpload=()=>{document.querySelector('#status').textContent='StoryForge · pasted.txt';document.querySelector('[role="progressbar"]').remove()};
  </script>`}
const largePrompt='# StoryForge US — JSON task\n'+('Story data with Tiếng Việt and JSON.\n'.repeat(16000));
test('large pasted-text conversion waits, adds a short instruction and never pastes or sends the original twice',async()=>{
  const f=await fixture('chatgpt.com',fileFixtureHTML());
  try{
    const message={jobKey:'file:1',prompt:largePrompt,action:'auto-prepare'};
    const first=await f.invoke(message);assert.equal(first.ok,true,first.error);assert.equal(first.ready,false);
    assert.equal((await f.invoke(message)).ready,false);
    assert.equal(await f.page.evaluate(()=>window.pastes.length),1);
    assert.equal(await f.page.evaluate(()=>window.sends),0);
    await f.page.evaluate(()=>window.finishUpload());
    assert.equal((await f.invoke(message)).ready,false);
    await f.page.waitForTimeout(2100);
    const prepared=await f.invoke(message);assert.equal(prepared.ok,true,prepared.error);
    assert.ok(prepared.baseline);assert.equal(await f.page.evaluate(()=>window.pastes.length),2);
    assert.match(await f.page.locator('#prompt-textarea').innerText(),/Read the attached text file in full/);
    assert.equal((await f.invoke({...message,action:'auto-check-send',baseline:prepared.baseline})).ready,true);
    await f.invoke({...message,action:'auto-send',baseline:prepared.baseline});
    assert.equal(await f.page.evaluate(()=>window.sends),1);
    assert.ok(await f.page.evaluate(()=>window.pastes.every(e=>e.trusted)));
    assert.equal(await f.page.evaluate(()=>window.pastes[0].text.replace(/\r\n?/g,'\n').length),largePrompt.length);
  }finally{await f.close()}
});
for(const action of ['removed','failed'])test('a '+action+' pasted text file is never resent or submitted',async()=>{
  const f=await fixture('chatgpt.com',fileFixtureHTML());
  try{
    const message={jobKey:action+':1',prompt:largePrompt,action:'auto-prepare'};
    assert.equal((await f.invoke(message)).ready,false);
    await f.invoke(message);
    await f.page.evaluate(action=>{if(action==='removed')document.querySelector('#files').replaceChildren();else document.querySelector('#status').textContent='Upload failed'},action);
    const blocked=await f.invoke(message);assert.equal(blocked.ok,false);assert.equal(blocked.code,'PASTE_MISMATCH');
    assert.equal(await f.page.evaluate(()=>window.pastes.length),1);assert.equal(await f.page.evaluate(()=>window.sends),0);
  }finally{await f.close()}
});
test('clipboard changes and user edits during Copy are rejected before any content is pasted',async()=>{
  for(const change of ['clipboard','editor']){
    const f=await fixture('aistudio.google.com','<main><textarea></textarea><button type="button" id="send" aria-label="Run">Run</button></main>');
    try{
      await worker.evaluate(async({tabId,change})=>{
        await chrome.scripting.executeScript({target:{tabId},func:change=>{
          const write=navigator.clipboard.writeText.bind(navigator.clipboard);
          navigator.clipboard.writeText=async text=>{await write(change==='clipboard'?'Wrong clipboard text':text);if(change==='editor')document.querySelector('textarea').value='User changed the draft'};
        },args:[change]});
      },{tabId:f.tabId,change});
      const result=await f.invoke({action:'media-prepare',provider:'aistudio',jobId:change,prompt});
      assert.equal(result.ok,false);assert.equal(result.code,'PASTE_MISMATCH');
      assert.equal(await f.page.evaluate(()=>window.sends),0);
      await assert.doesNotReject(()=>f.page.locator('textarea').inputValue());
      assert.equal(await f.page.locator('textarea').inputValue(),change==='editor'?'User changed the draft':'');
    }finally{await f.close()}
  }
});
test('a background AI tab still receives native Copy/Paste without replacing its text with insertText',async()=>{
  const f=await fixture('aistudio.google.com','<main><textarea></textarea><button type="button" id="send" aria-label="Run">Run</button></main>');
  const other=await context.newPage();
  try{
    await other.goto('about:blank');await other.bringToFront();
    const prepared=await f.invoke({action:'media-prepare',provider:'aistudio',jobId:'background',prompt});
    assert.equal(prepared.ok,true,prepared.error);
    assert.equal(await f.page.evaluate(()=>window.pastes[0].trusted),true);
    assert.equal((await f.page.locator('textarea').inputValue()).replace(/\r\n?/g,'\n'),prompt);
  }finally{await other.close();await f.close()}
});
test('clipboard API focus failure uses native Copy; unavailable native Paste never falls back to direct text insertion',async()=>{
  for(const blocked of [false,true]){
    const f=await fixture('flow.google.com','<main><textarea></textarea><button type="button" id="send" aria-label="Generate">Generate</button></main>');
    try{
      await worker.evaluate(async({tabId,blocked})=>{
        await chrome.scripting.executeScript({target:{tabId},func:blocked=>{
          navigator.clipboard.writeText=async()=>{throw new Error('Document is not focused')};
          if(blocked){const command=document.execCommand.bind(document);document.execCommand=(name,...args)=>name==='paste'?false:command(name,...args)};
        },args:[blocked]});
      },{tabId:f.tabId,blocked});
      const prepared=await f.invoke({action:'media-prepare',provider:'flow',jobId:'clipboard-fallback',prompt});
      assert.equal(prepared.ok,!blocked,prepared.error);
      if(blocked){assert.equal(prepared.code,'PASTE_UNAVAILABLE');assert.equal(await f.page.locator('textarea').inputValue(),'')}
      else assert.equal(await f.page.evaluate(()=>window.pastes[0].trusted),true);
      assert.equal(await f.page.evaluate(()=>window.sends),0);
    }finally{await f.close()}
  }
});
test('reinjection keeps pending file proof and removing a ready attachment blocks Send',async()=>{
  const f=await fixture('chatgpt.com',fileFixtureHTML());
  try{
    const message={jobKey:'reinjected:1',prompt:largePrompt,action:'auto-prepare'};
    assert.equal((await f.invoke(message)).ready,false);
    await worker.evaluate(async tabId=>{
      await chrome.scripting.executeScript({target:{tabId},files:['paste.js','content.js']});
    },f.tabId);
    assert.equal((await f.invoke(message)).ready,false);
    assert.equal(await f.page.evaluate(()=>window.pastes.length),1);
    await f.page.evaluate(()=>window.finishUpload());await f.invoke(message);
    await f.page.waitForTimeout(2100);const prepared=await f.invoke(message);
    assert.equal(prepared.ok,true,prepared.error);assert.ok(prepared.baseline);
    await f.page.evaluate(()=>document.querySelector('#files').replaceChildren());
    const blocked=await f.invoke({...message,action:'auto-send',baseline:prepared.baseline});
    assert.equal(blocked.ok,false);assert.equal(await f.page.evaluate(()=>window.sends),0);
    assert.equal(await f.page.evaluate(()=>window.pastes.length),2);
  }finally{await f.close()}
});
test('a file card marked busy cannot become ready just because its spinner and loading label disappeared',async()=>{
  const f=await fixture('chatgpt.com',fileFixtureHTML());
  try{
    const message={jobKey:'busy-card:1',prompt:largePrompt,action:'auto-prepare'};
    assert.equal((await f.invoke(message)).ready,false);
    await f.page.evaluate(()=>{window.finishUpload();document.querySelector('[data-testid="attachment"]').setAttribute('aria-busy','true')});
    assert.equal((await f.invoke(message)).ready,false);
    await f.page.waitForTimeout(2100);assert.equal((await f.invoke(message)).ready,false);
    assert.equal(await f.page.evaluate(()=>window.pastes.length),1);assert.equal(await f.page.evaluate(()=>window.sends),0);
    await f.page.evaluate(()=>document.querySelector('[data-testid="attachment"]').removeAttribute('aria-busy'));
    assert.equal((await f.invoke(message)).ready,false);
    await f.page.waitForTimeout(2100);assert.ok((await f.invoke(message)).baseline);
  }finally{await f.close()}
});
