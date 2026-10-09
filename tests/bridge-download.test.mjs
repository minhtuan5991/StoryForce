import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../frontend/node_modules/jsdom/lib/api.js';
import {armDownloadCapture} from '../browser-extension/download-capture.js';

// Observed Gemini sandbox message; the payload is the final PNG, not its preview.
const downloadCode='var url=URL.createObjectURL(blob);var a=document.createElement("a");if(!("download" in a)){throw new Error("Downloading not supported on this browser");}a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},250);';
function fixture(provider='gemini'){
  const {window}=new JSDOM('',{url:'https://gemini.google.com/app/test',runScripts:'outside-only'});
  const posts=[],revoked=[],blobs=[],timers=[];
  window.MessagePort=class {postMessage(data,...rest){posts.push({data,rest})}};
  window.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:https://gemini.google.com/full-'+blobs.length};
  window.URL.revokeObjectURL=url=>revoked.push(url);
  window.setTimeout=callback=>timers.push(callback);
  window.eval('('+armDownloadCapture.toString()+')(' + JSON.stringify('test-ticket') + ',' + JSON.stringify(provider) + ')');
  const blob=new window.Blob(['full PNG payload'],{type:'image/png'});
  const message={code:downloadCode,paramNames:['blob','filename'],values:[blob,'Gemini_Generated_Image_abcd1234']};
  const send=data=>new window.MessagePort().postMessage(data);
  const captured=()=>window.document.documentElement.getAttribute('data-storyforge-download-test-ticket');
  return {window,posts,revoked,blobs,timers,blob,message,send,captured};
}

test('Gemini captures its exact full-resolution sandbox PNG and acknowledges without a second download',()=>{
  const f=fixture();f.send(f.message);
  assert.equal(f.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(f.blobs[0],f.blob);
  assert.equal(f.posts[0].data.code,'void 0;');
  assert.equal(f.posts[0].data.values,f.message.values);
  // The capture detaches immediately and leaves subsequent messages untouched.
  f.send(f.message);assert.equal(f.posts[1].data,f.message);assert.equal(f.blobs.length,1);
  assert.deepEqual(f.revoked,[]);f.timers[0]();assert.deepEqual(f.revoked,['blob:https://gemini.google.com/full-1']);
});

test('sandbox capture leaves unrelated messages, altered code, wrong file types and names untouched',()=>{
  const mutations=[
    m=>({...m,code:m.code+'doSomethingElse();'}),
    m=>({...m,paramNames:['payload','filename']}),
    m=>({...m,values:[m.values[0],'my-private-file.png']}),
    (m,f)=>({...m,values:[new f.window.Blob(['video'],{type:'video/mp4'}),m.values[1]]}),
    m=>({code:'return account;',values:m.values}),
    m=>({code:7,values:m.values}),
  ];
  for(const mutate of mutations){
    const f=fixture(),message=mutate(f.message,f);f.send(message);
    assert.equal(f.captured(),null);assert.equal(f.posts[0].data,message);assert.equal(f.blobs.length,0);
  }
});

test('other providers do not hook sandbox messages and cleanup preserves another installed hook',()=>{
  const f=fixture('flow');f.send(f.message);
  assert.equal(f.captured(),null);assert.equal(f.posts[0].data,f.message);
  const g=fixture(),other=function(){};g.window.MessagePort.prototype.postMessage=other;g.timers[0]();
  assert.equal(g.window.MessagePort.prototype.postMessage,other);
});

test('top-page anchor capture still captures only the requested download and delays its blob revocation',()=>{
  const f=fixture('flow'),a=f.window.document.createElement('a');
  a.href='blob:https://gemini.google.com/existing-output';a.download='scene.mp4';a.click();
  assert.equal(f.captured(),a.href);
  f.window.URL.revokeObjectURL(a.href);assert.deepEqual(f.revoked,[]);
  f.timers[0]();assert.deepEqual(f.revoked,[a.href]);
});

test('AI Studio captures the complete WAV built by Download and never the streaming audio source',()=>{
  const f=fixture('aistudio'),d=f.window.document;
  d.body.innerHTML='<audio src="blob:https://aistudio.google.com/preview-packet"></audio><button>Download</button>';
  d.querySelector('button').onclick=()=>{
    const full=new f.window.Blob(['assembled WAV with every PCM packet'],{type:'audio/wav'});
    const a=d.createElement('a');a.href=f.window.URL.createObjectURL(full);a.download='Generated Audio.wav';
    a.click();f.window.URL.revokeObjectURL(a.href);
  };
  assert.equal(f.captured(),null);
  d.querySelector('button').click();
  assert.equal(f.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(f.blobs[0].type,'audio/wav');
  assert.notEqual(f.captured(),d.querySelector('audio').src);
  assert.deepEqual(f.revoked,[]);
  f.timers[0]();assert.deepEqual(f.revoked,[f.captured()]);
});

test('AI Studio captures the full WAV in the same pure-download sandbox protocol as Gemini',()=>{
  const f=fixture('aistudio');
  const message={...f.message,values:[new f.window.Blob(['complete WAV'],{type:'audio/wav'}),'Generated Audio October 04, 2026 - 3:08PM.wav']};
  f.send(message);
  assert.equal(f.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(f.posts[0].data.code,'void 0;');
  assert.equal(f.blobs[0],message.values[0]);
  const g=fixture('aistudio');g.send(f.message);assert.equal(g.captured(),null);
});

test('AI Studio keeps a full multi-minute base64 WAV out of extension storage without changing its bytes',()=>{
  const f=fixture('aistudio'),a=f.window.document.createElement('a');
  const pcm=Buffer.alloc(9_027_884,0x35);pcm.write('RIFF',0);pcm.write('WAVE',8);
  a.href='data:audio/wav;base64,'+pcm.toString('base64');a.download='Generated Audio.wav';
  assert.ok(a.href.length>10*1024*1024);
  a.click();
  assert.equal(f.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(f.blobs[0].size,pcm.length);assert.equal(f.blobs[0].type,'audio/wav');
  // JSDOM's Blob implementation stores its bytes behind its implementation symbol.
  const implementation=f.blobs[0][Object.getOwnPropertySymbols(f.blobs[0])[0]];
  assert.deepEqual(implementation._buffer,pcm);
  assert.ok(f.captured().length<200);
  f.timers[0]();assert.deepEqual(f.revoked,[f.captured()]);
});

test('AI Studio accepts its observed untyped complete WAV Blob and preserves the bytes',()=>{
  const f=fixture('aistudio'),payload=Buffer.from('RIFF complete generated audio WAVE');
  const blob=new f.window.Blob([payload]);
  f.send({...f.message,values:[blob,'Generated Audio October 04, 2026 - 3:08PM.wav']});
  assert.equal(f.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(f.blobs[0].type,'audio/wav');assert.equal(f.blobs[0].size,payload.length);
  const implementation=f.blobs[0][Object.getOwnPropertySymbols(f.blobs[0])[0]];
  assert.deepEqual(implementation._buffer,payload);
  assert.equal(f.posts[0].data.code,'void 0;');
  const g=fixture('aistudio');g.send({...g.message,values:[new g.window.Blob([payload]),'unrelated-file.wav']});
  assert.equal(g.captured(),null);
});

test('Lyria captures MP3 only, preserves bytes and rejects cover videos in its download menu',()=>{
  const f=fixture('lyria'),bytes=Buffer.from('ID3 owned synthetic MP3 fixture');
  f.send({...f.message,values:[new f.window.Blob(['cover movie'],{type:'video/mp4'}),'cover.mp4']});
  assert.equal(f.captured(),null);
  f.send({...f.message,values:[new f.window.Blob([bytes],{type:'audio/mpeg'}),'Before_the_Thaw.mp3']});
  assert.equal(f.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(f.posts[1].data.code,'void 0;');
  const implementation=f.blobs[0][Object.getOwnPropertySymbols(f.blobs[0])[0]];
  assert.deepEqual(implementation._buffer,bytes);
  const g=fixture('lyria'),a=g.window.document.createElement('a');
  a.download='bgm.mp3';a.href='data:audio/mpeg;base64,'+bytes.toString('base64');a.click();
  assert.equal(g.captured(),'blob:https://gemini.google.com/full-1');
  assert.equal(g.blobs[0].size,bytes.length);
});
