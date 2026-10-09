import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';
import {installPasteFixture} from './helpers/media-paste-fixture.mjs';

const adapter='('+installPasteFixture.toString()+')(window);\n'+readFileSync(new URL('../browser-extension/media-content.js',import.meta.url),'utf8');

test('AI Studio downloads the assembled WAV, reads its visible duration, and waits for the total to stop changing',async()=>{
  const dom=new JSDOM(`<main><textarea>At 11:47 p.m., the story begins.</textarea>
    <section><audio src="blob:https://aistudio.google.com/40ms-packet"></audio>
      <span>0:00</span><input type="range" aria-label="Seek audio position"><span id="total">2:26</span>
      <button id="download" aria-label="Download">download</button></section></main>`,
    {url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  const {window}=dom,d=window.document;
  window.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(d,'readyState',{value:'complete'});
  let now=1000,clicks=0;window.Date.now=()=>now;
  d.querySelector('#download').onclick=()=>clicks++;
  window.eval(adapter);
  const message={provider:'aistudio',jobId:'tts-one',baseline:[],prompt:'At 11:47 p.m., the story begins.'};
  const poll=()=>window.storyForgeMediaExecute({...message,action:'media-poll'});
  assert.equal((await poll()).ready,false);
  now+=4500;d.querySelector('#total').textContent='2:30';
  assert.equal((await poll()).ready,false);
  now+=4500;d.querySelector('audio').src='blob:https://aistudio.google.com/next-playback-packet';const output=await poll();
  assert.equal(output.ready,true);assert.equal(output.result.expectedDuration,150);
  d.querySelector('audio').src='blob:https://aistudio.google.com/another-packet';
  const info=await window.storyForgeMediaExecute({...message,action:'media-download-info',result:output.result});
  assert.equal(info.direct,false);assert.equal(info.expectedDuration,150);
  await window.storyForgeMediaExecute({...message,action:'media-download-click',result:output.result});
  assert.equal(clicks,1);
  d.querySelector('textarea').value='A different story.';
  await assert.rejects(window.storyForgeMediaExecute({...message,action:'media-download-click',result:output.result}),/Nút tải đã thay đổi/);
});

test('AI Studio never persists a multi-minute base64 audio baseline, result or preview URL',async()=>{
  const {window}=new JSDOM('<textarea>Previous narration.</textarea><section><audio></audio><span>0:00</span><input type="range" aria-label="Seek audio position"><span>3:08</span><button aria-label="Download">download</button></section>',
    {url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  const d=window.document;window.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(d,'readyState',{value:'complete'});
  let url='data:audio/wav;base64,'+'A'.repeat(12*1024*1024),now=1000;
  Object.defineProperty(d.querySelector('audio'),'currentSrc',{get:()=>url});window.Date.now=()=>now;
  window.eval(adapter);
  const message={provider:'aistudio',jobId:'second',prompt:'Second narration.',previousPrompt:'Previous narration.'};
  const {baseline}=await window.storyForgeMediaExecute({...message,action:'media-prepare'});
  assert.ok(JSON.stringify(baseline).length<100);
  assert.equal((await window.storyForgeMediaExecute({...message,baseline,action:'media-poll'})).ready,false);
  // A different result of the same byte count must not be mistaken for the baseline.
  url=url.slice(0,-1)+'B';await window.storyForgeMediaExecute({...message,baseline,action:'media-poll'});now+=4500;
  const output=await window.storyForgeMediaExecute({...message,baseline,action:'media-poll'});
  assert.equal(output.ready,true);assert.equal(output.result.jobId,'second');
  assert.equal(output.result.expectedDuration,188);assert.equal(output.result.url,undefined);
  assert.ok(JSON.stringify(output).length<200);
  const info=await window.storyForgeMediaExecute({...message,result:output.result,action:'media-download-info'});
  assert.equal(info.direct,false);assert.equal(info.url,undefined);assert.ok(JSON.stringify(info).length<200);
});
function studio(){
  const dom=new JSDOM(`<main id="speech" inert>
    <button id="speaker">Speaker 1 - Fola</button><button id="style" aria-label="Style">Friendly</button>
    <textarea></textarea><button>Run</button>
  </main><div id="mat-mdc-dialog-0" role="group">
    <h2>Speaker settings</h2><button aria-label="Close panel" id="close">close</button>
    <div>Current voice <span>Fola</span></div><input placeholder="Search 2,000+ voices">
    <div data-voice-name="Enzo" class="voice-card"><button class="voice-card-content" aria-label="Enzo">Enzo</button></div>
  </div>`,{url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  const {window}=dom,d=window.document;
  window.HTMLElement.prototype.getClientRects=function(){return this.style.display==='none'?[]:[{}]};
  Object.defineProperty(d,'readyState',{value:'complete'});
  const card=d.querySelector('[data-voice-name="Enzo"]'),option=card.querySelector('button');
  let picks=0,closed=0;
  option.onclick=()=>{picks++;card.classList.add('selected');option.setAttribute('aria-label','Enzo (Current)');d.querySelector('#speaker').textContent='Speaker 1 - Enzo'};
  d.querySelector('#close').onclick=()=>{closed++;d.querySelector('#speech').removeAttribute('inert');d.querySelector('#mat-mdc-dialog-0').remove()};
  window.eval(adapter);
  return {window,card,option,run:()=>window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one'}),counts:()=>({picks,closed})};
}

test('AI Studio closes only its identified welcome notice before inspecting the inert model and creating a dialog',async()=>{
  const {window}=new JSDOM('<main inert><button id="create">Create new dialog</button></main><div id="g1-welcome-dialog"><h2>Welcome to AI Studio</h2><button aria-label="Close dialog" id="continue">Continue</button></div>',{url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  const d=window.document;window.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(d,'readyState',{value:'complete'});
  let continued=0,created=0;
  d.querySelector('#continue').onclick=()=>{continued++;d.querySelector('main').removeAttribute('inert');d.querySelector('#g1-welcome-dialog').remove()};
  d.querySelector('#create').onclick=()=>created++;
  window.eval(adapter);
  const setup=()=>window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one',media:{tts:{model:'Gemini 3.8 Flash TTS'}}});
  assert.equal((await setup()).ready,false);assert.equal(continued,1);assert.equal(created,0);
  assert.equal((await setup()).ready,false);assert.equal(created,1);
});

test('AI Studio waits for its welcome control instead of declaring a missing TTS model or clicking an unrelated Continue',async()=>{
  const {window}=new JSDOM('<div id="g1-welcome-dialog"><h2>Welcome to AI Studio</h2></div><button id="other">Continue</button>',{url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  window.HTMLElement.prototype.getClientRects=()=>[{}];let clicked=0;
  Object.defineProperty(window.document,'readyState',{value:'complete'});
  window.document.querySelector('#other').onclick=()=>clicked++;
  window.eval(adapter);
  await assert.rejects(window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one',media:{tts:{model:'Gemini 3.8 Flash TTS'}}}),e=>e.code==='INPUT_NOT_READY'&&/giới thiệu/.test(e.message));
  assert.equal(clicked,0);
});

test('AI Studio chooses the voice card, closes its still-open picker, then verifies the speech badge',async()=>{
  const f=studio();
  assert.equal((await f.run()).ready,false);
  assert.deepEqual(f.counts(),{picks:1,closed:0});
  assert.equal((await f.run()).ready,false);
  assert.deepEqual(f.counts(),{picks:1,closed:1});
  assert.equal((await f.run()).ready,false); // waits for the real editable control
  assert.deepEqual(f.counts(),{picks:1,closed:1});
});

test('AI Studio already-selected Enzo is closed once instead of selecting it forever behind an inert badge',async()=>{
  const f=studio();f.option.click();
  await f.run();await f.run();
  assert.deepEqual(f.counts(),{picks:1,closed:1});
});

test('AI Studio finishes its inert voice picker before verifying the unchanged TTS model',async()=>{
  const f=studio(),d=f.window.document;
  const settings=d.createElement('ms-run-settings');settings.textContent='Gemini 3.8 Flash TTS';
  d.querySelector('#speech').append(settings);
  const setup=()=>f.window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one',media:{tts:{model:'Gemini 3.8 Flash TTS'}}});
  assert.equal((await setup()).ready,false);
  assert.deepEqual(f.counts(),{picks:1,closed:0});
  assert.equal((await setup()).ready,false);
  assert.deepEqual(f.counts(),{picks:1,closed:1});
  assert.equal((await setup()).ready,false);
  assert.equal(d.querySelector('#speaker').textContent,'Speaker 1 - Enzo');
});

test('AI Studio opens collapsed run settings to verify the model instead of skipping the scene',async()=>{
  const {window}=new JSDOM('<button id="toggle" aria-label="Toggle run settings panel"></button><button>Speaker 1 - Enzo</button><button aria-label="Style">Friendly</button><textarea></textarea><button>Run</button>',{url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  const d=window.document;window.HTMLElement.prototype.getClientRects=()=>[{}];Object.defineProperty(d,'readyState',{value:'complete'});
  let opened=0,now=1000;window.Date.now=()=>now;
  d.querySelector('#toggle').onclick=()=>{opened++;const settings=d.createElement('ms-run-settings');settings.textContent='Gemini 3.8 Flash TTS';d.body.append(settings)};
  window.eval(adapter);
  const setup=()=>window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one',media:{tts:{model:'Gemini 3.8 Flash TTS'}}});
  assert.equal((await setup()).ready,false);assert.equal(opened,1);
  assert.equal((await setup()).ready,false);now+=2500;
  assert.equal((await setup()).ready,true);assert.equal(opened,1);
});

test('AI Studio still refuses to send when the required model is unavailable',async()=>{
  const {window}=new JSDOM('<ms-run-settings><h2>A different TTS model</h2></ms-run-settings><button>Speaker 1 - Enzo</button><button aria-label="Style">Friendly</button><textarea></textarea><button>Run</button>',{url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  window.HTMLElement.prototype.getClientRects=()=>[{}];Object.defineProperty(window.document,'readyState',{value:'complete'});
  window.eval(adapter);
  await assert.rejects(window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one',media:{tts:{model:'Gemini 3.8 Flash TTS'}}}),/Chưa xác minh được model/);
});

test('AI Studio verifies the selected model card using its actual visible button caption',async()=>{
  const {window}=new JSDOM('<button aria-label="Gemini 3.8 Flash TTS gemini-3.8-flash-tts Flagship TTS model">Gemini 3.8 Flash TTS</button><button>Speaker 1 - Enzo</button><button aria-label="Style">Friendly</button><textarea></textarea><button>Run</button>',{url:'https://aistudio.google.com/generate-speech',runScripts:'outside-only'});
  window.HTMLElement.prototype.getClientRects=()=>[{}];Object.defineProperty(window.document,'readyState',{value:'complete'});
  let now=1000,modelClicks=0;window.Date.now=()=>now;window.document.querySelector('button').onclick=()=>modelClicks++;
  window.eval(adapter);
  const setup=()=>window.storyForgeMediaExecute({provider:'aistudio',action:'media-setup',jobId:'tts-one',media:{tts:{model:'Gemini 3.8 Flash TTS'}}});
  assert.equal((await setup()).ready,false);now+=2500;
  assert.equal((await setup()).ready,true);assert.equal(modelClicks,0);
});

test('AI Studio pastes and awaits voice search without confusing it with the narration editor',async()=>{
  const f=studio(),d=f.window.document;
  d.querySelector('[data-voice-name="Enzo"]').remove();
  const search=d.querySelector('input');
  search.addEventListener('input',()=>{if(search.value==='Enzo'&&!d.querySelector('[data-voice-name="Enzo"]')){
    const card=d.createElement('div');card.setAttribute('data-voice-name','Enzo');card.innerHTML='<button class="voice-card-content">Enzo</button>';
    card.querySelector('button').onclick=()=>{card.classList.add('selected');d.querySelector('#speaker').textContent='Speaker 1 - Enzo'};
    d.querySelector('#mat-mdc-dialog-0').append(card);
  }});
  assert.equal((await f.run()).ready,false);assert.equal(search.value,'Enzo');
  assert.equal((await f.run()).ready,false);assert.equal(d.querySelector('#speaker').textContent,'Speaker 1 - Enzo');
  assert.equal((await f.run()).ready,false);assert.equal(d.querySelector('#mat-mdc-dialog-0'),null);
});

test('AI Studio reads Friendly from the visible style caption and closes its auxiliary editor before preparing speech',async()=>{
  const f=studio();f.option.click();await f.run();
  const d=f.window.document,popup=d.createElement('div');
  popup.className='cdk-overlay-pane';popup.innerHTML='<textarea placeholder="Describe the voice style"></textarea><span>Friendly</span>';
  d.body.append(popup);
  let toggles=0;d.querySelector('#style').onclick=()=>{toggles++;popup.remove()};
  assert.equal((await f.run()).ready,false);
  assert.equal(toggles,1);
  await f.run();assert.equal(toggles,1);
  const prepared=await f.window.storyForgeMediaExecute({provider:'aistudio',action:'media-prepare',jobId:'tts-one',prompt:'Hello from our studio.'});
  assert.deepEqual(Array.from(prepared.baseline),[]);
  assert.equal(d.querySelector('textarea').value,'Hello from our studio.');
});

test('after extension reload, the next scene replaces only the exact prompt recorded by the worker for this tab',async()=>{
  const f=studio();f.option.click();await f.run();
  const field=f.window.document.querySelector('textarea');field.value='The first recorded scene.';
  const message={provider:'aistudio',action:'media-prepare',jobId:'tts-two',prompt:'The second recorded scene.',previousPrompt:'The first recorded scene.'};
  await f.window.storyForgeMediaExecute(message);
  assert.equal(field.value,message.prompt);
  field.value='My unsent changes.';
  await assert.rejects(f.window.storyForgeMediaExecute(message),/không xóa/);
  assert.equal(field.value,'My unsent changes.');
});

test('Gemini ignores its offscreen Quill clipboard but still refuses two actual prompt editors',async()=>{
  const dom=new JSDOM('<rich-textarea><div contenteditable="true" class="ql-editor" role="textbox" aria-label="Nhập câu lệnh cho Gemini"></div><div contenteditable="true" class="ql-clipboard" style="position:absolute;left:-100000px;width:0;height:1px"></div></rich-textarea>',{url:'https://gemini.google.com/app',runScripts:'outside-only'});
  const {window}=dom,d=window.document;
  window.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(d,'readyState',{value:'complete'});
  let now=1000;window.Date.now=()=>now;
  window.eval(adapter);
  const setup={provider:'gemini',action:'media-setup',jobId:'image-one'};
  assert.equal((await window.storyForgeMediaExecute(setup)).ready,false);
  now+=2000;assert.equal((await window.storyForgeMediaExecute(setup)).ready,true);
  const second=d.createElement('div');second.setAttribute('contenteditable','true');second.setAttribute('role','textbox');d.body.append(second);
  await assert.rejects(window.storyForgeMediaExecute(setup),/duy nhất/);
});

test('Flow verifies the visible Omni model caption behind its generic accessible label without reopening the model menu',async()=>{
  const dom=new JSDOM(`<textarea></textarea><button id="trigger" aria-label="Điều kiện kích hoạt cài đặt">Video · 720p · 10 giây x1</button>
    <div class="cdk-overlay-pane" id="settings">
      <button aria-checked="true">Video</button><button aria-checked="true">Thành phần</button>
      <button aria-checked="true">16:9</button><button aria-label="Chọn nhóm mô hình" id="model"><span>Omni 1.1 Flash <mat-icon aria-hidden="true">arrow_drop_down</mat-icon></span></button>
      <button>360p</button><button aria-checked="true">720p</button><button aria-checked="true">10 giây</button><button aria-checked="true">x1</button>
    </div>`,{url:'https://flow.google.com/project/test',runScripts:'outside-only'});
  const {window}=dom,d=window.document;
  window.HTMLElement.prototype.getClientRects=()=>[{}];
  Object.defineProperty(d,'readyState',{value:'complete'});
  let now=1000,modelsOpened=0,closed=0;window.Date.now=()=>now;
  d.querySelector('#model').onclick=()=>modelsOpened++;
  d.querySelector('#trigger').onclick=()=>{closed++;d.querySelector('#settings').remove()};
  window.eval(adapter);
  const setup={provider:'flow',action:'media-setup',jobId:'video-one'};
  assert.equal((await window.storyForgeMediaExecute(setup)).ready,false);
  assert.equal(closed,1);assert.equal(modelsOpened,0);
  assert.equal((await window.storyForgeMediaExecute(setup)).ready,false);
  now+=2000;assert.equal((await window.storyForgeMediaExecute(setup)).ready,true);
  assert.equal(closed,1);assert.equal(modelsOpened,0);
});

function flowResult(){
  const dom=new JSDOM('',{url:'https://flow.google.com/project/test',runScripts:'outside-only'});
  const {window}=dom,d=window.document;
  window.HTMLElement.prototype.getClientRects=function(){return this.style.display==='none'?[]:[{}]};
  Object.defineProperty(d,'readyState',{value:'complete'});
  let now=1000,opened=0,done=0,downloaded=0,wrong=0,more=0;
  window.Date.now=()=>now;
  const thumbnail='https://media.test/new.jpg';
  function grid(withControls=false){
    d.body.innerHTML=`<main><article><img alt="Hình thu nhỏ của video đã tạo" src="https://media.test/old.jpg"><button id="old-download">Tải xuống</button></article>
      <article id="new-card"><img id="new" alt="Hình thu nhỏ của video đã tạo" src="${thumbnail}">${withControls?'<button id="more" aria-label="Tuỳ chọn khác">more_vert</button>':''}</article></main>`;
    d.querySelector('#old-download').onclick=()=>wrong++;
    d.querySelector('#new').onclick=()=>{opened++;edit()};
    if(withControls)d.querySelector('#more').onclick=()=>{
      more++;
      const menu=d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button role="menuitem" id="download">Tải xuống</button>';
      d.body.append(menu);menu.querySelector('button').onclick=()=>downloaded++;
    };
  }
  function edit(){
    // Flow's clip editor need not expose a VIDEO element. Its timeline also
    // contains a progressbar, which must not block the owned Done action.
    d.body.innerHTML='<canvas></canvas><div role="progressbar"></div><button id="done">Xong</button>';
    d.querySelector('#done').onclick=()=>{done++;grid(true)};
  }
  grid();window.eval(adapter);
  let collection;
  const message={provider:'flow',jobId:'video-one',baseline:['https://media.test/old.jpg']};
  const run=async(action='media-poll',extra={})=>{
    const result=await window.storyForgeMediaExecute({...message,action,collection,...extra});
    if(result.collection)collection=JSON.parse(JSON.stringify(result.collection));
    return result;
  };
  return {window,d,run,grid,edit,thumbnail,message,advance:ms=>now+=ms,collection:()=>collection,
    reload:()=>{window.storyForgeMediaOwned={};window.eval(adapter)},counts:()=>({opened,done,downloaded,wrong,more})};
}

test('Flow leaves its canvas clip editor with Done, then downloads only the newly generated tile',async()=>{
  const f=flowResult();await f.run();f.advance(4500);
  assert.equal((await f.run()).ready,false);
  assert.equal(f.counts().opened,1);
  assert.equal((await f.run()).ready,false);
  assert.equal(f.counts().done,1);
  let output;for(let i=0;i<4;i++){f.advance(4500);output=await f.run();if(output.ready)break}
  assert.equal(output.ready,true);assert.equal(output.result.url,f.thumbnail);
  const info=await f.run('media-download-info',{result:output.result});
  assert.equal(info.direct,false);assert.equal(info.url,f.thumbnail);
  await f.run('media-download-click',{result:output.result});
  assert.deepEqual(f.counts(),{opened:1,done:1,downloaded:1,wrong:0,more:1});
});

test('Flow remembers the selected thumbnail across adapter reloads, even if its editor has no media element',async()=>{
  const f=flowResult();await f.run();f.advance(4500);await f.run();
  assert.equal(f.collection()?.thumbnailUrl,f.thumbnail);
  f.reload();await f.run();assert.equal(f.counts().done,1);
  f.reload();
  let output;for(let i=0;i<4;i++){f.advance(4500);output=await f.run();if(output.ready)break}
  assert.equal(output.ready,true);assert.equal(output.result.url,f.thumbnail);
  assert.equal(f.counts().opened,1);assert.equal(f.counts().wrong,0);
});

test('Flow recognizes the current icon-only Done control named Đã chỉnh sửa xong and downloads its tile',async()=>{
  const f=flowResult();await f.run();f.advance(4500);await f.run();
  f.d.querySelector('#done').setAttribute('aria-label','Đã chỉnh sửa xong');
  f.d.querySelector('#done').innerHTML='<svg></svg>';
  await f.run();assert.equal(f.counts().done,1);
  let result;for(let i=0;i<4;i++){f.advance(4500);result=await f.run();if(result.ready)break}
  assert.equal(result.ready,true);
  f.d.querySelector('#download').textContent='Tải nội dung nghe nhìn xuống';
  await f.run('media-download-click',{result:result.result});
  assert.equal(f.counts().downloaded,1);assert.equal(f.counts().wrong,0);
});

test('Flow dismisses a download menu opened by the old adapter in its own editor before clicking Done',async()=>{
  const f=flowResult();await f.run();f.advance(4500);await f.run();
  f.window.history.replaceState({},'', '/project/test/edit/new-clip');
  f.collection().menuOpened=true;
  f.d.querySelector('#done').setAttribute('inert','');
  const menu=f.d.createElement('div');menu.setAttribute('role','menu');f.d.body.append(menu);
  const backdrop=f.d.createElement('div');backdrop.className='cdk-overlay-backdrop';f.d.body.append(backdrop);
  let closed=0;backdrop.onclick=()=>{closed++;menu.remove();backdrop.remove();f.d.querySelector('#done').removeAttribute('inert')};
  assert.equal((await f.run()).ready,false);assert.equal(closed,1);assert.equal(f.counts().done,0);
  assert.equal((await f.run()).ready,false);assert.equal(f.counts().done,1);
});

test('Flow opens the compact grid context menu once on its selected result and downloads it without a More button',async()=>{
  const f=flowResult();await f.run();f.advance(4500);await f.run();await f.run();
  f.d.querySelector('#more').remove();let opened=0,downloaded=0;
  f.d.querySelector('#new-card').addEventListener('contextmenu',event=>{
    assert.equal(event.target,f.d.querySelector('#new'));event.preventDefault();opened++;
    const menu=f.d.createElement('div');menu.className='cdk-overlay-pane';menu.setAttribute('role','menu');
    menu.innerHTML='<button role="menuitem">Tải xuống</button>';menu.querySelector('button').onclick=()=>downloaded++;
    f.d.body.append(menu);
  });
  assert.equal((await f.run()).ready,false);assert.equal(opened,1);
  const result=await f.run();assert.equal(result.ready,true);assert.equal(opened,1);
  await f.run('media-download-click',{result:result.result});
  assert.equal(downloaded,1);assert.equal(f.counts().wrong,0);assert.equal(opened,1);
});

test('Flow clicks Done once and waits for the editor to actually close before downloading',async()=>{
  const f=flowResult();await f.run();f.advance(4500);await f.run();
  let done=0;f.d.querySelector('#done').onclick=()=>done++;
  await f.run();f.advance(5000);await f.run();
  assert.equal(done,1);
  assert.equal(f.counts().downloaded,0);
  f.grid(true);f.advance(4500);await f.run();
  assert.equal(f.counts().opened,1);
});

test('Flow does not exit an unrelated editor or choose an older tile download button',async()=>{
  const f=flowResult();f.edit();
  assert.equal((await f.run()).ready,false);assert.equal(f.counts().done,0);
  f.grid();await f.run();f.advance(4500);await f.run();
  assert.equal(f.counts().wrong,0);assert.equal(f.counts().opened,1);
});

test('Flow refuses multiple new results instead of downloading an arbitrary scene',async()=>{
  const f=flowResult(),extra=f.d.createElement('article');
  extra.innerHTML='<img alt="Hình thu nhỏ của video đã tạo" src="https://media.test/another-new.jpg"><button>Tải xuống</button>';
  f.d.querySelector('main').append(extra);
  await assert.rejects(f.run(),/nhiều|duy nhất/i);
  assert.equal(f.counts().wrong,0);assert.equal(f.counts().opened,0);
});

test('Flow does not pin or open a thumbnail while generation is still running',async()=>{
  const f=flowResult(),progress=f.d.createElement('div');progress.setAttribute('role','progressbar');f.d.body.append(progress);
  await f.run();f.advance(5000);await f.run();
  assert.equal(f.collection(),undefined);assert.equal(f.counts().opened,0);
  progress.remove();await f.run();assert.equal(f.collection().thumbnailUrl,f.thumbnail);
});

test('Flow can inspect Download in its owned menu when the background grid becomes inert',async()=>{
  const f=flowResult();f.grid(true);await f.run();f.advance(4500);await f.run();
  f.d.querySelector('main').setAttribute('inert','');
  const output=await f.run();assert.equal(output.ready,true);
  await f.run('media-download-click',{result:output.result});
  assert.equal(f.counts().downloaded,1);assert.equal(f.counts().wrong,0);
  f.d.querySelector('[role="menu"]').remove();
  const menu=f.d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button id="original">720p (Original)</button>';
  let chosen=0;menu.querySelector('button').onclick=()=>chosen++;f.d.body.append(menu);
  await f.run('media-download-continue',{result:output.result});await f.run('media-download-continue',{result:output.result});
  assert.equal(chosen,1);
});

test('Flow waits instead of closing an editor when it did not open the selected result',async()=>{
  const f=flowResult();await f.run();f.edit();f.advance(5000);
  const output=await f.run();assert.equal(output.ready,false);assert.equal(f.counts().done,0);
});

test('Flow stops result collection if the tab moved to a different project',async()=>{
  const f=flowResult();await f.run();f.advance(4500);await f.run();
  f.window.history.replaceState({},'', '/project/another/edit/video');
  await assert.rejects(f.run(),/dự án khác/);assert.equal(f.counts().done,0);
});

test('Flow keeps newer page evidence when a successful open or Done reply was lost',async()=>{
  const f=flowResult();await f.run();const beforeOpen=f.collection();
  f.advance(4500);await f.run();
  const beforeDone=f.collection();let done=0;f.d.querySelector('#done').onclick=()=>done++;
  const output=await f.window.storyForgeMediaExecute({...f.message,action:'media-poll',collection:beforeOpen});
  assert.equal(done,1);assert.ok(output.collection.doneClickedAt);
  f.advance(5000);
  await f.window.storyForgeMediaExecute({...f.message,action:'media-poll',collection:beforeDone});
  assert.equal(done,1);assert.equal(f.counts().opened,1);
});

test('Flow upgrades a canvas editor already opened by the old adapter without waiting for a video element',async()=>{
  const f=flowResult();f.edit();
  Object.assign(f.window.storyForgeMediaOwned,{setupJobId:'video-one',openedThumbnail:f.thumbnail,flowThumbnailAt:1000});
  f.advance(5000);await f.run();
  assert.equal(f.counts().done,1);assert.equal(f.collection().thumbnailUrl,f.thumbnail);
  let output;for(let i=0;i<3;i++){output=await f.run();if(output.ready)break}
  assert.equal(output.ready,true);assert.equal(f.counts().opened,0);
});

test('Flow does not adopt an old editor belonging to another job or a baseline clip',async()=>{
  for(const legacy of [{setupJobId:'another-job',openedThumbnail:'https://media.test/new.jpg'},
    {setupJobId:'video-one',openedThumbnail:'https://media.test/old.jpg'}]){
    const f=flowResult();f.edit();Object.assign(f.window.storyForgeMediaOwned,legacy);
    await f.run();assert.equal(f.counts().done,0);assert.equal(f.collection(),undefined);
  }
});
