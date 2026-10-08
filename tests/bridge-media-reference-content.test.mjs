import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';
import {installPasteFixture} from './helpers/media-paste-fixture.mjs';
const adapter='('+installPasteFixture.toString()+')(window);\n'+readFileSync(new URL('../browser-extension/media-content.js',import.meta.url),'utf8');

function fixture(provider='gemini'){
  const {window}=new JSDOM('<main id="history"></main><form><input type="file" accept="image/*" multiple><div id="attachments"></div><textarea></textarea><button type="button" aria-label="'+(provider==='flow'?'Generate':'Send message')+'">Send</button></form>',
    {url:provider==='flow'?'https://flow.google.com/project/one':'https://gemini.google.com/app/one',runScripts:'outside-only'});
  const d=window.document;window.HTMLElement.prototype.getClientRects=function(){return this.style.display==='none'?[]:[{}]};
  Object.defineProperty(d,'readyState',{value:'complete'});
  Object.defineProperty(window.HTMLImageElement.prototype,'naturalWidth',{get:()=>512});
  window.DataTransfer=class {constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}};
  const input=d.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[],writable:true});
  let time=1000,uploads=0,sends=0;window.Date.now=()=>time;
  input.onchange=()=>{uploads++;d.querySelector('#attachments').innerHTML='<div role="progressbar"></div>'};
  d.querySelector('button').onclick=()=>sends++;
  window.eval(adapter);
  const ref={name:'sf_ref_0123456789abcdef.jpg',mime:'image/jpeg',data:'aW1hZ2U='};
  const message={provider,jobId:'scene-two',prompt:'A person beside a bridge.',references:[ref]};
  const execute=(action,extra={})=>window.storyForgeMediaExecute({...message,action:'media-'+action,...extra});
  const complete=()=>{d.querySelector('#attachments').innerHTML='<img src="blob:reference"><button type="button" aria-label="Remove file '+ref.name+'">Remove</button>';d.querySelector('#attachments button').onclick=()=>d.querySelector('#attachments').replaceChildren()};
  const turn=(prompt,url)=>{const container=d.createElement('div');container.innerHTML='<user-query></user-query><model-response><section><img><button type="button" aria-label="Download">Download</button></section></model-response>';
    container.querySelector('user-query').textContent=prompt;container.querySelector('img').src=url;d.querySelector('#history').append(container);return container};
  return {window,d,input,ref,message,execute,complete,turn,advance:ms=>time+=ms,counts:()=>({uploads,sends})};
}

test('references upload once and Send waits for completed previews; a removed reference prevents Send',async()=>{
  const f=fixture();
  assert.equal((await f.execute('prepare')).ready,false);
  assert.equal(f.input.files[0].name,f.ref.name);assert.equal(f.input.files[0].type,'image/jpeg');
  assert.equal((await f.execute('prepare')).ready,false);assert.equal(f.counts().uploads,1);
  assert.equal((await f.execute('ready')).ready,false);
  f.complete();await f.execute('prepare');f.advance(2200);
  const prepared=await f.execute('prepare');assert.deepEqual(Array.from(prepared.baseline),[]);
  assert.equal((await f.execute('ready')).ready,true);
  await f.execute('send');assert.equal(f.counts().sends,1);
  await f.execute('send');assert.equal(f.counts().sends,1);
  f.d.querySelector('#attachments').replaceChildren();
  assert.equal((await f.execute('ready')).ready,false);
});

test('single-file pickers attach three references sequentially and never send a partly attached set',async()=>{
  const f=fixture();f.input.multiple=false;
  const references=[f.ref,{...f.ref,name:'sf_ref_aaaaaaaaaaaaaaaa.jpg'},{...f.ref,name:'sf_ref_bbbbbbbbbbbbbbbb.jpg'}];
  let uploads=0;
  f.input.onchange=()=>{uploads++;const image=f.d.createElement('img');image.src='blob:ref-'+uploads;f.d.querySelector('#attachments').append(image)};
  const prepare=()=>f.execute('prepare',{references});
  await prepare();assert.equal(uploads,1);assert.equal((await f.execute('ready')).ready,false);
  for(let i=0;i<3;i++){await prepare();f.advance(2100);await prepare()}
  assert.equal(uploads,3);assert.equal((await f.execute('ready')).ready,true);
  await f.execute('send');assert.equal(f.counts().sends,1);
});

test('Flow receives the same reference bytes and only replaces an attachment that Bridge owns',async()=>{
  const f=fixture('flow');await f.execute('prepare');f.complete();await f.execute('prepare');f.advance(2200);await f.execute('prepare');
  const contents=await new Promise(resolve=>{const reader=new f.window.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(f.input.files[0])});
  assert.equal(contents,'image');
  assert.equal(f.input.files[0].name,f.ref.name);
  await f.execute('send');assert.equal(f.counts().sends,1);
  assert.equal((await f.execute('prepare',{jobId:'thumbnail',prompt:'Thumbnail',previousPrompt:f.message.prompt,references:[]})).ready,false);
  const ready=await f.execute('prepare',{jobId:'thumbnail',prompt:'Thumbnail',previousPrompt:f.message.prompt,references:[]});
  assert.ok(ready.baseline);
  f.d.querySelector('#attachments').innerHTML='<img src="blob:my-person">';
  await assert.rejects(f.execute('prepare',{jobId:'another',prompt:'Next scene',previousPrompt:'Thumbnail'}),/ảnh bạn đã thêm/);
});

test('Gemini only collects the answer following this scene prompt and ignores a late failed answer or another user query',async()=>{
  const f=fixture();f.turn('An older failed prompt.','https://images.test/late-old.png');
  assert.equal((await f.execute('poll',{references:[],baseline:[]})).ready,false);
  const current=f.turn(f.message.prompt,'https://images.test/current.png');
  f.turn('Some other manual prompt.','https://images.test/unrelated.png');
  assert.equal((await f.execute('poll',{references:[],baseline:[]})).ready,false);f.advance(4500);
  const output=await f.execute('poll',{references:[],baseline:[]});
  assert.equal(output.ready,true);assert.equal(output.result.url,'https://images.test/current.png');assert.equal(output.result.jobId,f.message.jobId);
  const info=await f.execute('download-info',{result:output.result});assert.equal(info.url,output.result.url);
  await assert.rejects(f.execute('download-click',{result:{...output.result,jobId:'wrong'}}),/Nút tải đã thay đổi/);
  current.querySelector('user-query').textContent='A modified prompt';
  await assert.rejects(f.execute('download-info',{result:output.result}),/không còn/);
});

test('recovery waits for localized Stop and for old results to stop changing before preparing a new scene',async()=>{
  const f=fixture();const old=f.turn('Previous','https://images.test/old.png');
  const stop=f.d.createElement('button');stop.setAttribute('aria-label','Ngừng tạo câu trả lời');f.d.body.append(stop);
  assert.equal((await f.execute('setup',{recovery:true})).ready,false);stop.remove();
  await f.execute('setup',{recovery:true});f.advance(4900);assert.equal((await f.execute('setup',{recovery:true})).ready,false);
  old.querySelector('img').src='https://images.test/late.png';await f.execute('setup',{recovery:true});f.advance(5100);
  assert.equal((await f.execute('setup',{recovery:true})).ready,false);f.advance(2100);
  assert.equal((await f.execute('setup',{recovery:true})).ready,true);assert.equal(f.counts().sends,0);
});

test('Gemini refuses multiple images for a scene and unbound image results',async()=>{
  const f=fixture();f.turn(f.message.prompt,'https://images.test/first.png');
  const another=f.d.createElement('img');another.src='https://images.test/second.png';f.d.querySelector('model-response').append(another);
  await assert.rejects(f.execute('poll',{baseline:[]}),/nhiều ảnh/);
  f.d.querySelector('user-query').remove();assert.equal((await f.execute('poll',{baseline:[]})).ready,false);
});

test('AI Studio verifies the requested model before accepting its speech settings',async()=>{
  const {window}=new JSDOM('<aside><h2>Gemini 3.8 Flash TTS</h2></aside><button>Speaker 1 - Enzo</button><button aria-label="Style">Friendly</button><textarea></textarea><button>Run</button>',
    {url:'https://aistudio.google.com/prompts/dialog',runScripts:'outside-only'});
  window.HTMLElement.prototype.getClientRects=()=>[{}];Object.defineProperty(window.document,'readyState',{value:'complete'});let now=1000;window.Date.now=()=>now;window.eval(adapter);
  const message={provider:'aistudio',action:'media-setup',jobId:'audio',media:{tts:{model:'Gemini 3.8 Flash TTS'}}};
  assert.equal((await window.storyForgeMediaExecute(message)).ready,false);now+=2200;
  assert.equal((await window.storyForgeMediaExecute(message)).ready,true);
  window.document.querySelector('h2').textContent='Gemini other model';
  await assert.rejects(window.storyForgeMediaExecute(message),/Chưa xác minh được model/);
});
