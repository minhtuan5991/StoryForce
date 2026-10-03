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
