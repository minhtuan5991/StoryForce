import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from '../frontend/node_modules/playwright/index.mjs';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';

// Use the real unpacked extension, File/FileList APIs and native Paste in an
// isolated browser. Provider requests are served locally; no AI credits used.
let context,worker,workerBundle;
before(async()=>{
  const bundle=await build({stdin:{contents:"export * from './browser-extension/media-automatic.js';export {uploadFlowReferences} from './browser-extension/reference-upload.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'FixtureMedia'});
  workerBundle=bundle.outputFiles[0].text;
  const extension=path.resolve('browser-extension');
  context=await chromium.launchPersistentContext('',{channel:process.env.STORYFORGE_TEST_BROWSER?undefined:'chromium',executablePath:process.env.STORYFORGE_TEST_BROWSER,headless:true,
    ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  await context.route('**/*',route=>route.request().url().startsWith('chrome-extension://')?route.continue():
    route.request().url().endsWith('.svg')?route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="navy"/></svg>'}):
    route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated fixture</title>'}));
  worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(code=>(0,eval)(code+';globalThis.FixtureMedia=FixtureMedia;'),workerBundle);
});
after(async()=>{await context?.close()});

function fixtureHTML(compact,duplicate=false,chooser='dom',single=false){return `<!doctype html><meta charset="utf-8"><style>[hidden]{display:none!important} img{width:40px;height:40px}</style>
  <main><section><img alt="Ô hiển thị hình ảnh của người dùng" src="/manual.svg"><span>character_reference.png</span></section>
    <section id="composer"><div id="attachments"></div><textarea></textarea><button id="add" aria-label="Thêm thành phần vào ô nhập câu lệnh">+</button>
      <button id="settings" aria-label="Điều kiện kích hoạt cài đặt">Video · 720p · 10 giây · x1</button><button id="send" aria-label="Bắt đầu tạo">arrow_forward</button></section>
    <div role="menu" id="settings-menu" hidden>${['Video','Thành phần','16:9','Omni 1.1 Flash','720p','10 giây','x1'].map(t=>'<button role="radio" aria-checked="true">'+t+'</button>').join('')}</div>
  </main>
  <div role="dialog" aria-label="Thêm thành phần vào dự án" id="picker" hidden><input aria-label="Tìm kiếm thành phần" placeholder="Tìm kiếm thành phần">
    <button id="upload" aria-label="Tải nội dung nghe nhìn lên">Tải nội dung ...</button><div role="list" id="library"></div><section id="preview"></section><button id="close">Đóng</button></div>
  <script>
    window.counts={uploads:0,selections:[],confirmed:[],sends:0};window.pastes=[];window.uploaded=[];
    const composer=document.getElementById('composer'),picker=document.getElementById('picker'),library=document.getElementById('library');
    function openPicker(){picker.hidden=false;composer.inert=true}
    function closePicker(){picker.hidden=true;composer.inert=false}
    document.getElementById('add').onclick=openPicker;document.getElementById('close').onclick=closePicker;
    const unrelated=document.createElement('button');unrelated.setAttribute('role','option');unrelated.innerHTML='<img src="/manual.svg"><span>character_reference.png</span><span>Hình ảnh</span>';unrelated.onclick=()=>{throw Error('Selected an unrelated user file')};library.append(unrelated);
    if(${JSON.stringify(duplicate)}){
      const old=unrelated.cloneNode(true);old.querySelector('span').textContent='sf_ref_0123456789abcdef.jpg';old.querySelector('img').src='/old-copy.svg';
      old.onclick=()=>{throw Error('Selected the old same-name image')};library.append(old);
    }
    window.originalInputClick=HTMLInputElement.prototype.click;window.originalShowPicker=HTMLInputElement.prototype.showPicker;
    window.showOpenFilePicker=()=>{window.counts.nativeChoosers=(window.counts.nativeChoosers||0)+1;throw Error('Native chooser unexpectedly opened')};
    window.originalOpenFilePicker=window.showOpenFilePicker;
    async function addFiles(files){
        for(const file of files){
          window.uploaded.push({name:file.name,type:file.type,bytes:await file.text()});
          const card=document.createElement('button');card.setAttribute('role','option');card.innerHTML='<img src="/'+file.name+'.svg"><span>'+file.name+'</span><span>Hình ảnh</span>';
          const attach=()=>{
            window.counts.confirmed.push(file.name);const image=document.createElement('img');image.src='/'+file.name+'.svg';image.setAttribute('data-file-name',file.name);document.getElementById('attachments').append(image);
            document.getElementById('preview').replaceChildren();closePicker();
          };
          card.onclick=()=>{
            window.counts.selections.push(file.name);library.querySelectorAll('[aria-selected]').forEach(e=>e.removeAttribute('aria-selected'));card.setAttribute('aria-selected','true');
            if(${JSON.stringify(compact)}){attach();return}
            const preview=document.getElementById('preview');preview.innerHTML='<img src="/'+file.name+'.svg"><button>Add to prompt</button>';preview.querySelector('button').onclick=attach;
          };library.append(card);
        }
    }
    document.getElementById('upload').onclick=async()=>{
      window.counts.uploads++;
      if(${JSON.stringify(chooser)}==='file-picker'){
        const handles=await window.showOpenFilePicker({multiple:${JSON.stringify(!single)},types:[{accept:{'image/jpeg':['.jpg']}}]});
        return addFiles(await Promise.all(handles.map(handle=>handle.getFile())));
      }
      const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=${JSON.stringify(!single)};input.hidden=true;
      if(${JSON.stringify(chooser)}==='dom')picker.append(input);
      input.onchange=()=>addFiles(input.files);
      if(${JSON.stringify(chooser)}==='detached')input.click();
      if(${JSON.stringify(chooser)}==='show-picker')input.showPicker();
    };
    document.getElementById('settings').onclick=()=>{const menu=document.getElementById('settings-menu');menu.hidden=!menu.hidden};
    document.addEventListener('paste',e=>window.pastes.push({trusted:e.isTrusted,text:e.clipboardData.getData('text/plain')}));
    document.getElementById('send').onclick=()=>{window.counts.sends++;window.sent={prompt:document.querySelector('textarea').value,names:[...document.querySelectorAll('#attachments img')].map(e=>e.getAttribute('data-file-name'))};document.querySelector('textarea').value='';document.getElementById('attachments').replaceChildren()};
    openPicker();
  </script>`}

for(const compact of [false,true]){
  test('real Flow '+(compact?'compact selection':'preview + Add to prompt')+' uploads the right files before native Paste and one generation',async()=>{
    const url='https://flow.google.com/project/fixture-'+(compact?'compact':'desktop');
    const page=await context.newPage();
    await page.route(url,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:fixtureHTML(compact)}));
    await page.goto(url);
    const invoke=message=>worker.evaluate(async({url,message})=>{
      const [tab]=await chrome.tabs.query({url});const result=await chrome.tabs.sendMessage(tab.id,{type:'storyforge',...message});
      if(result.referenceUpload){
        const request=result.referenceUpload,files=request.names.map(name=>message.references.find(file=>file.name===name));
        const [execution]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:globalThis.FixtureMedia.uploadFlowReferences,args:[request.ticket,files]});
        const accepted=await chrome.tabs.sendMessage(tab.id,{type:'storyforge',action:'media-reference-uploaded',provider:'flow',jobId:message.jobId,upload:execution.result});
        if(!accepted.ok)throw Error(accepted.error);
      }
      return result;
    },{url,message});
    const names=(compact?['0123456789abcdef']:['0123456789abcdef','aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb']).map(k=>'sf_ref_'+k+'.jpg');
    const references=names.map((name,i)=>({name,mime:'image/jpeg',data:Buffer.from('reference bytes '+i).toString('base64')}));
    const message={provider:'flow',jobId:compact?'compact-video':'desktop-video',prompt:'Same characters, realistic light.\nA 10-second opening shot. Tiếng Việt.',references};
    try{
      assert.equal((await invoke({...message,action:'media-setup'})).ready,true);
      assert.equal((await invoke({...message,action:'media-prepare'})).ready,false);
      assert.equal((await invoke({...message,action:'media-prepare'})).ready,false);
      await page.waitForFunction(count=>window.uploaded.length===count,names.length);
      assert.deepEqual(await page.evaluate(()=>window.uploaded),names.map((name,i)=>({name,type:'image/jpeg',bytes:'reference bytes '+i})));
      for(let i=0;i<16;i++){
        const setup=await invoke({...message,action:'media-setup'});assert.equal(setup.ok,true,setup.error);
        assert.equal(await page.evaluate(()=>window.counts.sends),0);
        if(await page.evaluate(()=>window.counts.confirmed.length)===names.length)break;
        await page.waitForTimeout(50);
      }
      assert.deepEqual(await page.evaluate(()=>window.counts.confirmed),names);
      assert.deepEqual(await page.evaluate(()=>window.counts.selections),names);
      assert.equal(await page.evaluate(()=>window.counts.uploads),1);
      assert.deepEqual(await page.evaluate(()=>window.pastes),[]);
      assert.equal(await page.locator('#picker').isVisible(),false);
      // Finish unchanged Flow settings after the picker closes, then verify
      // that the attachment previews settle before filling the prompt.
      for(let i=0;i<6;i++){const setup=await invoke({...message,action:'media-setup'});assert.equal(setup.ok,true,setup.error)}
      assert.equal((await invoke({...message,action:'media-prepare'})).ready,false);
      await page.waitForTimeout(2200);
      const prepared=await invoke({...message,action:'media-prepare'});assert.equal(prepared.ok,true,prepared.error);assert.ok(prepared.baseline);
      assert.equal((await invoke({...message,action:'media-ready'})).ready,true);
      const paste=await page.evaluate(()=>window.pastes);assert.equal(paste.length,1);assert.equal(paste[0].trusted,true);assert.equal(paste[0].text.replace(/\r\n?/g,'\n'),message.prompt);
      await invoke({...message,action:'media-send'});await invoke({...message,action:'media-send'});
      assert.equal(await page.evaluate(()=>window.counts.sends),1);assert.deepEqual(await page.evaluate(()=>window.sent),{prompt:message.prompt,names});
    }finally{await page.close()}
  });
}

for(const [chooser,single] of [['dom',false],['detached',false],['show-picker',false],['file-picker',false],['detached',true]]){
test('actual Flow worker uploads via '+chooser+(single?' one file at a time':'')+' and reuses references after restart',async()=>{
  const url='https://flow.google.com/project/fixture-worker-'+chooser+'-'+single,page=await context.newPage();
  await page.route(url,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:fixtureHTML(false,true,chooser,single)}));await page.goto(url);
  const names=['0123456789abcdef','aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb'].map(k=>'sf_ref_'+k+'.jpg');
  const references=names.map((name,i)=>({name,mime:'image/jpeg',data:Buffer.from('reference bytes '+i).toString('base64')}));
  await worker.evaluate(code=>(0,eval)(code+';globalThis.FixtureMedia=FixtureMedia;'),workerBundle);
  await worker.evaluate(async({url,references})=>{
    const {createMediaBridge}=globalThis.FixtureMedia;
    const [tab]=await chrome.tabs.query({url});
    const storage={autoBridge:{enabled:true},mediaBridge:{phase:'idle',tabs:{},sessions:{'worker-project:flow':{tabId:tab.id,url}}}},claims={},steps=[];
    const makeJob=id=>({id,attempt:1,provider:'flow',url,project_id:'worker-project',prompt:'Same actors '+id,
      media:{project_id:'worker-project',folder:'Worker test',filename:id+'.mp4'}});
    const state={jobs:[makeJob('scene-one')]};
    const fakeChrome={tabs:chrome.tabs,downloads:chrome.downloads,storage:{local:{
      get:async k=>({[k]:structuredClone(storage[k])}),set:async values=>Object.assign(storage,structuredClone(values))}}};
    const request=async(path,method,body)=>{
      if(path==='/jobs')return {items:state.jobs};
      if(path.endsWith('/claim')){
        const id=path.split('/')[2],claim=claims[id]||={owner:body.owner,attempt:body.attempt,phase:'claimed'};
        const send=body.authorize_send&&claim.phase!=='sent';if(send)claim.phase='sent';return {claim,send};
      }
      if(path.endsWith('/references'))return {files:references};
      if(path.endsWith('/status'))steps.push(body.step);
      if(path.endsWith('/failure'))throw Error(body.reason);
      return {updated:true};
    };
    const uploadReferences=async(tabId,ticket,files)=>{
      const [execution]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:globalThis.FixtureMedia.uploadFlowReferences,args:[ticket,files]});return execution.result;
    };
    const create=()=>createMediaBridge({chrome:fakeChrome,request,ensureContent:async()=>{},uploadReferences,now:Date.now,pageSettleMs:0});
    globalThis.flowWorkerFixture={tab,storage,steps,state,makeJob,create,engine:create(),tick:async()=>{await globalThis.flowWorkerFixture.engine.tick()}};
  },{url,references});
  try{
    for(const scene of ['scene-one','scene-two']){
      if(scene==='scene-two'){
        await worker.evaluate(async()=>{
          const f=globalThis.flowWorkerFixture;
          // The completed download normally clears the active job while keeping
          // the project's session. Simulate that boundary without issuing a
          // provider generation or download request in this local fixture.
          const previous=f.storage.mediaBridge;
          f.storage.mediaBridge={phase:'idle',tabs:previous.tabs,pages:previous.pages,folders:previous.folders,
            prompts:previous.prompts,sessions:previous.sessions};
          await chrome.scripting.executeScript({target:{tabId:f.tab.id},func:()=>{delete globalThis.storyForgeMediaOwned}});
          await chrome.scripting.executeScript({target:{tabId:f.tab.id},files:['media-content.js']});
          f.state.jobs=[f.makeJob('scene-two')];f.engine=f.create();
        });
      }
      for(let i=0;i<150;i++){
        await worker.evaluate(()=>globalThis.flowWorkerFixture.tick());
        const state=await worker.evaluate(()=>globalThis.flowWorkerFixture.engine.read());
        assert.notEqual(state.phase,'paused',state.message);
        if(state.phase==='submitted'&&state.jobId===scene)break;
        await page.waitForTimeout(100);
      }
      const final=await worker.evaluate(()=>globalThis.flowWorkerFixture.engine.read());
      assert.equal(final.phase,'submitted',final.message+' '+JSON.stringify(await page.evaluate(()=>window.counts)));
      assert.deepEqual(await page.evaluate(()=>window.sent.names),names);
    }
    assert.equal(await page.evaluate(()=>window.counts.uploads),single?3:1);
    assert.equal(await page.evaluate(()=>window.uploaded.length),3);
    assert.deepEqual(await page.evaluate(()=>window.uploaded),names.map((name,i)=>({name,type:'image/jpeg',bytes:'reference bytes '+i})));
    assert.equal(await page.evaluate(()=>window.counts.sends),2);
    assert.deepEqual(await page.evaluate(()=>window.counts.confirmed),[...names,...names]);
    assert.equal((await page.evaluate(()=>window.pastes)).length,2);
    assert.equal((await worker.evaluate(()=>globalThis.flowWorkerFixture.engine.read())).sessions['worker-project:flow'].referenceLibrary.length,3);
    assert.equal(await page.evaluate(()=>HTMLInputElement.prototype.click===window.originalInputClick&&
      HTMLInputElement.prototype.showPicker===window.originalShowPicker&&window.showOpenFilePicker===window.originalOpenFilePicker),true);
    assert.equal(await page.evaluate(()=>window.counts.nativeChoosers||0),0);
  }finally{await page.close();await worker.evaluate(()=>{delete globalThis.flowWorkerFixture})}
});
}

test('native upload is idempotent after a lost acknowledgement and restores picker APIs after failure',async()=>{
  const url='https://flow.google.com/project/fixture-upload-recovery',page=await context.newPage();
  await page.route(url,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:fixtureHTML(false,false,'detached')}));await page.goto(url);
  const ticket='11111111-2222-4333-8444-555555555555',files=[{name:'sf_ref_0123456789abcdef.jpg',mime:'image/jpeg',data:Buffer.from('owned reference').toString('base64')}];
  const upload=(ticket,files)=>worker.evaluate(async({url,ticket,files})=>{
    const [tab]=await chrome.tabs.query({url});const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:globalThis.FixtureMedia.uploadFlowReferences,args:[ticket,files]});return result.result;
  },{url,ticket,files});
  try{
    await page.locator('#upload').evaluate((button,ticket)=>button.setAttribute('data-storyforge-reference-upload',ticket),ticket);
    const first=await upload(ticket,files);assert.deepEqual(await upload(ticket,files),first);
    await page.waitForFunction(()=>window.uploaded.length===1);
    assert.equal(await page.evaluate(()=>window.counts.uploads),1);
    assert.deepEqual(await page.evaluate(()=>window.uploaded),[{name:files[0].name,type:'image/jpeg',bytes:'owned reference'}]);
    const failedTicket='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await page.locator('#upload').evaluate((button,ticket)=>{button.setAttribute('data-storyforge-reference-upload',ticket);button.onclick=()=>{}},failedTicket);
    // Chrome reports injected script exceptions as a missing result on some
    // versions, so assert the actual page state as well as any rejection.
    try{await upload(failedTicket,files)}catch(error){assert.match(String(error),/Flow|ảnh|script/)}
    assert.equal(await page.evaluate(()=>HTMLInputElement.prototype.click===window.originalInputClick&&
      HTMLInputElement.prototype.showPicker===window.originalShowPicker&&window.showOpenFilePicker===window.originalOpenFilePicker),true);
    assert.equal(await page.locator('[data-storyforge-reference-upload]').count(),0);
    assert.equal(await page.evaluate(()=>window.counts.sends),0);
    assert.equal(await page.evaluate(()=>window.counts.nativeChoosers||0),0);
  }finally{await page.close()}
});
