import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';
import {providerPage,projectSessionKey} from '../browser-extension/media-sessions.js';

const adapter=fs.readFileSync(new URL('../browser-extension/media-content.js',import.meta.url),'utf8');
const message={provider:'lyria',jobId:'music-job',prompt:'Instrumental mystery loop, about 150 seconds. No lyrics.',
  media:{lyria:{duration:'full',model:'lyria-3-pro-preview',instrumental:true,surface:'aistudio_music'}}};

function fixture({model='Lyria 3 Pro Preview',collapsed=false,menu=false,url='https://aistudio.google.com/new_music?model=lyria-3-pro-preview'}={}){
  const {window}=new JSDOM(`<main><button id="start"><h2>Describe the music you want to generate with Lyria 3 Pro Preview ...</h2><p>Generate full-length songs</p></button>
    <section id="presets"><button>Big Room EDM</button><audio src="https://samples.test/edm.mp3"></audio><button>Toggle audio playback</button>
    <button>Cinematic Score</button><audio src="https://samples.test/score.mp3"></audio><button>Toggle audio playback</button></section></main>
    <aside id="settings" ${collapsed?'hidden':''}><h3>${model}</h3><p>${model==='Lyria 3 Pro Preview'?'lyria-3-pro-preview':'lyria-3-clip-preview'}</p></aside>`,{url,runScripts:'outside-only'});
  const d=window.document;
  window.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{}]};
  Object.defineProperty(d,'readyState',{value:'complete'});
  let clock=1000,runs=0,downloads=0,pastes=0,resets=0,opens=0;
  window.Date.now=()=>clock;
  const start=()=>{
    d.querySelector('#start')?.remove();
    d.querySelector('main').insertAdjacentHTML('beforeend',`<div role="radiogroup" aria-label="View mode"><button id="text" role="radio" aria-checked="true">Text</button><button id="composer" role="radio" aria-checked="false">Composer</button></div>
      <textarea aria-label="Prompt input" placeholder="Describe your music..."></textarea><button id="panel" aria-label="Toggle run settings panel"></button>
      <button id="new">New session</button><button id="generate">Generate</button>`);
    d.querySelector('#panel').onclick=()=>{opens++;d.querySelector('#settings').hidden=!d.querySelector('#settings').hidden};
    d.querySelector('#generate').onclick=()=>runs++;
    d.querySelector('#text').onclick=()=>{d.querySelector('#text').setAttribute('aria-checked','true');d.querySelector('#composer').setAttribute('aria-checked','false')};
    d.querySelector('#composer').onclick=()=>{d.querySelector('#text').setAttribute('aria-checked','false');d.querySelector('#composer').setAttribute('aria-checked','true')};
    d.querySelector('#new').onclick=()=>{resets++;d.querySelectorAll('[aria-label="Music player"]').forEach(e=>e.remove());d.querySelector('textarea').value=''};
  };
  d.querySelector('#start').onclick=start;
  window.storyForgePaste={into:async(field,prompt,{validate})=>{validate();pastes++;field.value=prompt}};
  const response=(id='generated',seconds=139,disabled=false)=>{
    const player=d.createElement('div');player.setAttribute('role','group');player.setAttribute('aria-label','Music player');player.id=id;
    player.innerHTML=`<audio src="blob:lyria-${id}"></audio><button>Play</button><span>0:00</span><input type="range" aria-label="Seek audio position"/><span>${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}</span><button aria-label="Download" ${disabled?'disabled':''}></button>`;
    d.querySelector('main').append(player);
    player.querySelector('[aria-label="Download"]').onclick=()=>{
      if(!menu){downloads++;return}
      const picker=d.createElement('div');picker.setAttribute('role','menu');picker.innerHTML='<button id="video">Video MP4</button><button id="audio">Audio only WAV</button>';d.body.append(picker);
      picker.querySelector('#video').onclick=()=>{throw Error('Wrong cover video')};
      picker.querySelector('#audio').onclick=()=>{downloads++;picker.remove()};
    };
    return player;
  };
  window.eval(adapter);
  const execute=(action,extra={})=>window.storyForgeMediaExecute({...message,action:'media-'+action,...extra});
  const advance=()=>clock+=4500;
  const setup=async extra=>{let result;for(let i=0;i<8;i++){result=await execute('setup',extra);advance();if(result.ready)return result}return result};
  return {window,d,start,response,execute,advance,setup,counts:()=>({runs,downloads,pastes,resets,opens})};
}

test('AI Studio Lyria opens the landing card, verifies Pro, pastes Text, generates once and downloads the completed player',async()=>{
  const f=fixture({collapsed:true});
  assert.equal((await f.setup()).ready,true);
  assert.equal(f.counts().opens,1);
  const {baseline}=await f.execute('prepare');
  assert.equal(baseline.length,0,'built-in audio samples are never generated results');
  assert.equal((await f.execute('ready')).ready,true);
  assert.equal(f.counts().pastes,1);
  await f.execute('send');await f.execute('send');
  assert.equal(f.counts().runs,1);
  assert.equal((await f.execute('poll',{baseline})).ready,false);
  const player=f.response('finished',139,true);
  assert.equal((await f.execute('poll',{baseline})).ready,false,'disabled Download is not a completed result');
  player.querySelector('[aria-label="Download"]').disabled=false;
  await f.execute('poll',{baseline});f.advance();
  const {ready,result}=await f.execute('poll',{baseline});
  assert.equal(ready,true);assert.equal(result.expectedDuration,139);assert.equal(result.jobId,message.jobId);
  // Playback packet URLs may change while the same completed player remains.
  player.querySelector('audio').src='blob:next-playback-packet';
  const info=await f.execute('download-info',{baseline,result});
  assert.equal(info.direct,false);assert.equal(info.url,undefined);assert.equal(info.expectedDuration,139);
  await f.execute('download-click',{baseline,result});
  assert.equal(f.counts().downloads,1);
});

test('wrong music model, Composer mode or the Gemini host cannot receive a new generation',async()=>{
  const wrong=fixture({model:'Lyria 3 Clip Preview'});wrong.start();
  await wrong.execute('setup');
  await assert.rejects(wrong.execute('setup'),/Lyria 3 Pro Preview/);
  await assert.rejects(wrong.execute('prepare'),/chưa Paste/);
  assert.equal(wrong.counts().runs,0);assert.equal(wrong.counts().pastes,0);
  const f=fixture();await f.setup();await f.execute('prepare');
  f.d.querySelector('#composer').click();
  assert.equal((await f.execute('ready')).ready,false);
  await assert.rejects(f.execute('send'),/thay đổi/);
  assert.equal(f.counts().runs,0);
  f.d.querySelector('#text').click();
  f.d.querySelector('#settings h3').textContent='Lyria 3 Clip Preview';
  f.d.querySelector('#settings p').textContent='lyria-3-clip-preview';
  await assert.rejects(f.execute('send'),/thay đổi/);
  const legacy=fixture({url:'https://gemini.google.com/app/old-music'});
  await assert.rejects(legacy.execute('setup'),/Không đúng dịch vụ/);
});

test('a previous owned music player is reset before the next generation, including tracks with the same duration',async()=>{
  const f=fixture();await f.setup();await f.execute('prepare');await f.execute('send');f.response('old',139);
  const next={jobId:'next-job',prompt:'Another 150-second instrumental loop.',previousPrompt:message.prompt};
  assert.equal((await f.setup(next)).ready,true);
  assert.equal(f.counts().resets,1);
  assert.equal(f.d.querySelector('[aria-label="Music player"]'),null);
  const {baseline}=await f.execute('prepare',next);await f.execute('send',next);
  f.response('new',139);await f.execute('poll',{...next,baseline});f.advance();
  const {ready,result}=await f.execute('poll',{...next,baseline});
  assert.equal(ready,true);assert.equal(result.jobId,'next-job');assert.equal(f.counts().runs,2);
});

test('manual prompt/music is preserved and an old player in the baseline cannot become the new result',async()=>{
  const f=fixture();await f.setup();
  f.d.querySelector('textarea').value='A song the user is currently composing.';f.response('manual',139);
  await assert.rejects(f.execute('setup'),/không thay nội dung/);
  assert.equal(f.counts().resets,0);assert.equal(f.counts().pastes,0);
  assert.match(f.d.querySelector('textarea').value,/currently composing/);
  f.d.querySelector('textarea').value=message.prompt;
  const {baseline}=await f.execute('prepare');await f.execute('send');f.advance();
  assert.equal((await f.execute('poll',{baseline})).ready,false);
});

test('Lyria never downloads another job, an altered player or ambiguous multiple outputs',async()=>{
  const f=fixture();await f.setup();const {baseline}=await f.execute('prepare');await f.execute('send');
  const player=f.response();await f.execute('poll',{baseline});f.advance();
  const {result}=await f.execute('poll',{baseline});
  await assert.rejects(f.execute('download-info',{baseline,result:{...result,jobId:'different-job'}}),/Không thấy nút tải/);
  player.querySelectorAll('span')[1].textContent='2:40';
  await assert.rejects(f.execute('download-click',{baseline,result}),/đã thay đổi/);
  f.response('another',140);
  await assert.rejects(f.execute('poll',{baseline}),/nhiều bản nhạc/);
  assert.equal(f.counts().downloads,0);
});

test('a Download format menu selects audio WAV once and never a video',async()=>{
  const f=fixture({menu:true});await f.setup();const {baseline}=await f.execute('prepare');await f.execute('send');
  f.response();await f.execute('poll',{baseline});f.advance();const {result}=await f.execute('poll',{baseline});
  await f.execute('download-click',{baseline,result});
  await f.execute('download-continue',{baseline,result});await f.execute('download-continue',{baseline,result});
  assert.equal(f.counts().downloads,1);
});

test('Lyria uses an AI Studio music session independent of speech and Gemini image sessions',()=>{
  const base={project_id:'p',media:{project_id:'p',folder:'Project'}};
  for(const provider of ['gemini','aistudio'])assert.notEqual(projectSessionKey({...base,provider}),projectSessionKey({...base,provider:'lyria'}));
  assert.equal(providerPage('lyria','https://aistudio.google.com/music/music-one?account=1#anchor'),'https://aistudio.google.com/music/music-one');
  assert.equal(providerPage('lyria','https://aistudio.google.com/prompts/music-one?model=lyria-3-pro-preview'),'https://aistudio.google.com/prompts/music-one');
  for(const url of ['https://aistudio.google.com/new_music?model=lyria-3-pro-preview','https://aistudio.google.com/generate-speech','https://gemini.google.com/app/music-one','https://aistudio.google.com/prompts/new_chat'])
    assert.equal(providerPage('lyria',url),undefined);
  assert.equal(providerPage('aistudio','https://aistudio.google.com/new_music?model=lyria-3-pro-preview'),undefined);
});
