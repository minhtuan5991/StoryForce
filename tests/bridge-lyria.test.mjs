import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';
import {providerPage,projectSessionKey} from '../browser-extension/media-sessions.js';

const adapter=fs.readFileSync(new URL('../browser-extension/media-content.js',import.meta.url),'utf8');
function fixture(){
  const {window}=new JSDOM(`<main><textarea></textarea><button id="tools" aria-label="Nội dung tải lên và công cụ"></button><button aria-label="Gửi tin nhắn" id="send"></button></main>`,{url:'https://gemini.google.com/app/music-one',runScripts:'outside-only'});
  const d=window.document;
  window.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{}]};
  Object.defineProperty(d,'readyState',{value:'complete'});
  let clock=1000,runs=0,downloads=0;
  window.Date.now=()=>clock;
  d.querySelector('#tools').onclick=()=>{
    const menu=d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button id="more">Công cụ khác</button>';d.body.append(menu);
    menu.querySelector('#more').onclick=()=>{
      menu.innerHTML='<button id="music">Tạo nhạc</button>';
      menu.querySelector('#music').onclick=()=>{
        menu.remove();d.querySelector('main').insertAdjacentHTML('beforeend','<button aria-label="Bỏ chọn Nhạc"></button><button id="duration">Thời lượng</button><button id="vocals">Có giọng hát</button>');
        d.querySelector('#duration').onclick=()=>{
          const menu=d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button id="short">Ngắn</button>';d.body.append(menu);
          menu.querySelector('#short').onclick=()=>{d.querySelector('#duration').textContent='Thời lượng, Ngắn';menu.remove()};
        };
        d.querySelector('#vocals').onclick=()=>{
          const menu=d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button id="instrumental">Không lời</button>';d.body.append(menu);
          menu.querySelector('#instrumental').onclick=()=>{d.querySelector('#vocals').textContent='Có giọng hát, Không lời';menu.remove()};
        };
      };
    };
  };
  window.storyForgePaste={into:async(field,prompt)=>{field.value=prompt}};
  d.querySelector('#send').onclick=()=>runs++;
  const response=(id,prompt)=>{
    const query=d.createElement('user-query');query.textContent=prompt;d.querySelector('main').prepend(query);
    const result=d.createElement('model-response');result.innerHTML=`<div id="model-response-message-content${id}"><img src="https://example.test/cover.png"/><button aria-label="Tải bản nhạc xuống" id="download-${id}"></button></div>`;query.after(result);
    result.querySelector('button').onclick=()=>{
      const menu=d.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button id="video">Video Âm thanh kèm ảnh bìa</button><button id="audio">Chỉ riêng âm thanh Bản nhạc MP3</button>';d.body.append(menu);
      menu.querySelector('#video').onclick=()=>{throw Error('Wrong cover video')};
      menu.querySelector('#audio').onclick=()=>{downloads++;menu.remove()};
    };
    return result;
  };
  window.eval(adapter);
  return {window,d,response,counts:()=>({runs,downloads}),advance:()=>clock+=4500};
}

test('Lyria selects short instrumental mode, waits for its own result, and downloads MP3 only',async()=>{
  const f=fixture(),execute=message=>f.window.storyForgeMediaExecute(message);
  const message={provider:'lyria',jobId:'music-job',prompt:'Create an instrumental background clip.'};
  let setup;
  for(let i=0;i<14;i++){setup=await execute({...message,action:'media-setup'});f.advance();if(setup.ready)break}
  assert.equal(setup.ready,true);
  const old=f.response('old',message.prompt);
  const {baseline}=await execute({...message,action:'media-prepare'});
  assert.equal((await execute({...message,action:'media-ready'})).ready,true);
  await execute({...message,action:'media-send'});
  await execute({...message,action:'media-send'});
  assert.equal(f.counts().runs,1);
  assert.equal((await execute({...message,baseline,action:'media-poll'})).ready,false);
  old.previousElementSibling.remove();old.remove();
  f.response('new',message.prompt);
  await execute({...message,baseline,action:'media-poll'});f.advance();
  const result=await execute({...message,baseline,action:'media-poll'});
  assert.equal(result.ready,true);assert.equal(result.result.responseKey,'model-response-message-contentnew');
  const download=await execute({...message,baseline,result:result.result,action:'media-download-info'});
  assert.equal(download.direct,false);assert.equal(download.url,undefined);
  await execute({...message,baseline,result:result.result,action:'media-download-click'});
  await execute({...message,baseline,result:result.result,action:'media-download-continue'});
  await execute({...message,baseline,result:result.result,action:'media-download-continue'});
  assert.equal(f.counts().downloads,1);
  f.d.querySelector('#vocals').textContent='Có giọng hát, Có lời';
  assert.equal((await execute({...message,action:'media-ready'})).ready,false);
});

test('Lyria music uses its own session key and cannot share the project image chat',()=>{
  const base={project_id:'p',media:{project_id:'p',folder:'Project'}};
  assert.notEqual(projectSessionKey({...base,provider:'gemini'}),projectSessionKey({...base,provider:'lyria'}));
  assert.equal(providerPage('lyria','https://gemini.google.com/app/music-one?hl=vi'),'https://gemini.google.com/app/music-one');
  assert.equal(providerPage('lyria','https://gemini.google.com/app'),undefined);
});
