import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';

const adapter=readFileSync(new URL('../browser-extension/media-content.js',import.meta.url),'utf8');
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
