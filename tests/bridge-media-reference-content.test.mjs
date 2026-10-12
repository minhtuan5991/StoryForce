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
  const execute=async(action,extra={})=>{
    const request={...message,action:'media-'+action,...extra};
    const result=await window.storyForgeMediaExecute(request);
    if(result.referenceUpload){
      // This content-only fixture models the MAIN-world upload acknowledgement.
      // Actual native/detached file selectors are covered in the isolated
      // browser by bridge-flow-references.spec.mjs.
      const upload=result.referenceUpload;
      d.querySelector('[data-storyforge-reference-upload="'+upload.ticket+'"]').click();
      const selected=upload.names.map(name=>request.references.find(file=>file.name===name)).slice(0,input.multiple?3:1);
      input.files=selected.map(file=>new window.File([Uint8Array.from(window.atob(file.data),c=>c.charCodeAt(0))],file.name,{type:file.mime}));
      input.dispatchEvent(new window.Event('change',{bubbles:true}));
      const accepted=await window.storyForgeMediaExecute({...message,action:'media-reference-uploaded',jobId:request.jobId,
        upload:{ticket:upload.ticket,names:selected.map(file=>file.name),mode:'file-input'}});
      assert.equal(accepted.uploaded,true);
    }
    return result;
  };
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

test('Gemini opens the localized uploads and tools menu before attaching a reference',async()=>{
  const f=fixture();f.input.remove();let menus=0,pickers=0;
  const form=f.d.querySelector('form'),add=f.d.createElement('button');
  add.type='button';add.setAttribute('aria-label','Nội dung tải lên và công cụ');form.append(add);
  add.onclick=()=>{
    menus++;const menu=f.d.createElement('div');menu.setAttribute('role','menu');
    const upload=f.d.createElement('button');upload.type='button';upload.textContent='Tải tệp lên';
    upload.onclick=()=>{pickers++;form.append(f.input);menu.remove()};menu.append(upload);f.d.body.append(menu);
  };
  assert.equal((await f.execute('prepare')).ready,false);assert.equal(menus,1);assert.equal(pickers,0);
  assert.equal((await f.execute('prepare')).ready,false);assert.equal(menus,1);assert.equal(pickers,1);
  assert.equal((await f.execute('prepare')).ready,false);assert.equal(f.counts().uploads,1);assert.equal(f.counts().sends,0);
  f.complete();await f.execute('prepare');f.advance(2200);await f.execute('prepare');
  assert.equal((await f.execute('ready')).ready,true);await f.execute('send');assert.equal(f.counts().sends,1);
});

test('Flow selects Upload media inside its ingredients dialog instead of toggling the composer add control',async()=>{
  const f=fixture('flow');f.input.remove();let uploads=0,adds=0;
  const form=f.d.querySelector('form'),add=f.d.createElement('button');
  add.type='button';add.setAttribute('aria-label','Thêm thành phần vào ô nhập câu lệnh');add.onclick=()=>adds++;form.append(add);
  const dialog=f.d.createElement('div');dialog.setAttribute('role','dialog');
  const upload=f.d.createElement('button');upload.type='button';upload.setAttribute('aria-label','Tải nội dung nghe nhìn lên');
  upload.onclick=()=>{uploads++;form.append(f.input);dialog.remove()};dialog.append(upload);f.d.body.append(dialog);
  assert.equal((await f.execute('prepare')).ready,false);assert.equal(uploads,1);assert.equal(adds,0);
  assert.equal(f.counts().uploads,1);assert.equal(f.counts().sends,0);
  f.complete();await f.execute('prepare');f.advance(2200);await f.execute('prepare');
  assert.equal((await f.execute('ready')).ready,true);await f.execute('send');assert.equal(f.counts().sends,1);
});

function flowConfirmFixture({multiple=true,locale='vi'}={}){
  const f=fixture('flow'),form=f.d.querySelector('form');f.input.remove();f.input.multiple=multiple;
  let uploads=0,fileUploads=0,selected=[],confirmed=[],userSelections=0;
  const picker=f.d.createElement('div');picker.setAttribute('role','dialog');picker.setAttribute('aria-label','Thêm thành phần vào dự án');
  picker.innerHTML='<input placeholder="Tìm kiếm thành phần"><div role="list"></div><section id="preview"></section><button id="upload" type="button" aria-label="Tải nội dung nghe nhìn lên">Tải nội dung ...</button><button id="close" type="button">Đóng</button>';
  const list=picker.querySelector('[role=list]');
  const card=(name,url,onselect)=>{const e=f.d.createElement('button');e.type='button';e.setAttribute('role','option');e.innerHTML='<img src="'+url+'"><span>'+name+'</span><span>Hình ảnh</span>';e.onclick=()=>onselect(e);return e};
  list.append(card('character_reference.png','blob:manual-board',()=>userSelections++));
  const open=()=>{form.setAttribute('inert','');f.d.body.append(picker)};
  const add=f.d.createElement('button');add.type='button';add.setAttribute('aria-label','Thêm thành phần vào ô nhập câu lệnh');add.onclick=open;form.append(add);
  picker.querySelector('#upload').onclick=()=>{uploads++;picker.append(f.input)};
  picker.querySelector('#close').onclick=()=>{picker.remove();form.removeAttribute('inert')};
  f.input.onchange=()=>{
    fileUploads++;
    for(const file of f.input.files){
      const url='blob:'+file.name;
      list.append(card(file.name,url,e=>{
        selected.push(file.name);list.querySelectorAll('[aria-selected]').forEach(c=>c.removeAttribute('aria-selected'));e.setAttribute('aria-selected','true');
        const preview=picker.querySelector('#preview');preview.innerHTML='<img src="'+url+'"><button type="button">'+(locale==='en'?'Add to prompt':'Thêm vào câu lệnh')+'</button>';
        preview.querySelector('button').onclick=()=>{
          confirmed.push(file.name);const image=f.d.createElement('img');image.src=url;image.setAttribute('data-file-name',file.name);f.d.querySelector('#attachments').append(image);
          preview.replaceChildren();picker.remove();form.removeAttribute('inert');
        };
      }));
    }
  };
  // Keep provider settings out of this upload regression fixture.
  f.window.storyForgeMediaOwned.setupJobId=f.message.jobId;f.window.storyForgeMediaOwned.flowConfigured=true;
  return {...f,picker,open,stats:()=>({uploads,fileUploads,selected,confirmed,userSelections})};
}

test('Flow uploads from an already open inert picker, confirms Add to prompt, then pastes and sends exactly once',async()=>{
  const f=flowConfirmFixture();f.open();
  assert.equal((await f.execute('setup')).ready,true);
  assert.equal((await f.execute('prepare')).ready,false);assert.equal(f.stats().uploads,1);
  await f.execute('setup');await f.execute('prepare');
  assert.equal(f.input.files[0].name,f.ref.name);assert.equal(f.input.files[0].type,'image/jpeg');
  await f.execute('setup');assert.deepEqual(f.stats().selected,[f.ref.name]);
  assert.equal(f.d.querySelector('textarea').value,'');assert.equal(f.counts().sends,0);
  await f.execute('setup');assert.deepEqual(f.stats().confirmed,[f.ref.name]);
  assert.equal(f.stats().userSelections,0);assert.equal(f.stats().uploads,1);
  await f.execute('prepare');f.advance(2200);await f.execute('prepare');
  assert.equal((await f.execute('ready')).ready,true);await f.execute('send');await f.execute('send');
  assert.equal(f.counts().sends,1);assert.equal(f.d.querySelector('textarea').value,f.message.prompt);
});

test('Flow waits for a disabled confirmation and refuses to send after the reference is removed',async()=>{
  const f=flowConfirmFixture({locale:'en'});f.open();await f.execute('prepare');await f.execute('setup');
  const confirm=f.picker.querySelector('#preview button');confirm.disabled=true;
  for(let i=0;i<3;i++){assert.equal((await f.execute('setup')).ready,false);f.advance(2100)}
  assert.deepEqual(f.stats().selected,[f.ref.name]);assert.deepEqual(f.stats().confirmed,[]);assert.equal(f.counts().sends,0);
  confirm.disabled=false;await f.execute('setup');await f.execute('prepare');f.advance(2200);await f.execute('prepare');
  assert.equal((await f.execute('ready')).ready,true);f.d.querySelector('#attachments').replaceChildren();
  assert.equal((await f.execute('ready')).ready,false);await assert.rejects(f.execute('send'),/Chưa xác minh/);
  assert.equal(f.counts().sends,0);
});

test('Flow confirms all three references without reuploading or closing the preview instead of adding it',async()=>{
  const f=flowConfirmFixture(),references=[f.ref,{...f.ref,name:'sf_ref_aaaaaaaaaaaaaaaa.jpg'},{...f.ref,name:'sf_ref_bbbbbbbbbbbbbbbb.jpg'}];
  f.open();await f.execute('prepare',{references});await f.execute('prepare',{references});
  for(let i=0;i<10&&f.stats().confirmed.length<3;i++){await f.execute('setup');assert.equal(f.counts().sends,0)}
  assert.deepEqual(f.stats().confirmed,references.map(r=>r.name));assert.equal(f.stats().uploads,1);assert.equal(f.stats().userSelections,0);
  await f.execute('prepare',{references});f.advance(2200);await f.execute('prepare',{references});
  assert.equal((await f.execute('ready')).ready,true);await f.execute('send');assert.equal(f.counts().sends,1);
});

test('Flow recovers an old adapter selection still in the preview without another upload',async()=>{
  const f=flowConfirmFixture();f.open();await f.execute('prepare');await f.execute('setup');
  assert.deepEqual(f.stats().confirmed,[]);assert.ok(f.picker.querySelector('#preview button'));
  const upload=f.window.storyForgeMediaOwned.referenceUpload;delete upload.flowPending;upload.flowSelections=[f.ref.name];
  await f.execute('setup');assert.deepEqual(f.stats().confirmed,[f.ref.name]);assert.equal(f.stats().uploads,1);
  assert.deepEqual(f.stats().selected,[f.ref.name]);assert.equal(f.counts().sends,0);
  await f.execute('prepare');f.advance(2200);await f.execute('prepare');assert.equal((await f.execute('ready')).ready,true);
});

test('Flow does not confirm a preview when the user selects a different library image',async()=>{
  const f=flowConfirmFixture();f.open();await f.execute('prepare');await f.execute('setup');
  f.picker.querySelectorAll('[aria-selected]').forEach(e=>e.removeAttribute('aria-selected'));
  f.picker.querySelector('[role=option]').setAttribute('aria-selected','true');
  await assert.rejects(f.execute('setup'),/Ảnh được chọn.*thay đổi/);
  assert.deepEqual(f.stats().confirmed,[]);assert.equal(f.counts().sends,0);
});

async function finishFlowReference(f,extra={}){
  for(let i=0;i<18;i++){
    const setup=await f.execute('setup',extra);
    if(setup.ready){
      const result=await f.execute('prepare',extra);
      if(result.baseline)return result;
    }
    f.advance(2100);
  }
  assert.fail('Flow reference preparation did not complete');
}

test('Flow setup/prepare polling completes Upload, preview, Add to prompt and Paste in worker order',async()=>{
  const f=flowConfirmFixture();f.open();
  const result=await finishFlowReference(f);
  assert.deepEqual(f.stats().confirmed,[f.ref.name]);assert.equal(f.stats().uploads,1);
  assert.equal(result.referenceLibrary[0].name,f.ref.name);
  assert.equal(result.referenceLibrary[0].projectUrl,'https://flow.google.com/project/one');
  assert.equal((await f.execute('ready')).ready,true);await f.execute('send');assert.equal(f.counts().sends,1);
});

test('Flow ignores reference-library upload progress as generation busy and still requires the attached image',async()=>{
  const f=flowConfirmFixture();f.open();
  const progress=f.d.createElement('div');progress.setAttribute('role','progressbar');f.picker.append(progress);
  await finishFlowReference(f);
  assert.deepEqual(f.stats().confirmed,[f.ref.name]);assert.equal((await f.execute('ready')).ready,true);
  const videoProgress=progress.cloneNode();f.d.querySelector('main').append(videoProgress);
  assert.equal((await f.execute('ready')).ready,false);await assert.rejects(f.execute('send'),/Ô nhập đã thay đổi/);
  assert.equal(f.counts().sends,0);
});

test('Flow reuses its exact uploaded library image in the next scene without a second upload',async()=>{
  const f=flowConfirmFixture();f.open();await finishFlowReference(f);await f.execute('send');
  f.d.querySelector('#attachments').replaceChildren();f.d.querySelector('textarea').value='';
  const extra={jobId:'scene-three',prompt:'The same actor in another scene.'};
  await f.execute('prepare',extra); // Reopen our library, instead of upload.
  for(let i=0;i<6;i++){await f.execute('prepare',extra);f.advance(2100)}
  assert.equal(f.stats().uploads,1);assert.deepEqual(f.stats().confirmed,[f.ref.name,f.ref.name]);
  assert.equal((await f.execute('ready',extra)).ready,true);await f.execute('send',extra);
  assert.equal(f.counts().sends,2);assert.equal(f.stats().userSelections,0);
});

test('Flow restores library provenance after content reload and rejects a filename-only replacement',async()=>{
  const f=flowConfirmFixture();f.open();const prepared=await finishFlowReference(f);
  f.d.querySelector('#attachments').replaceChildren();f.d.querySelector('textarea').value='';
  delete f.window.storyForgeMediaOwned;f.window.eval(adapter);
  const extra={jobId:'scene-after-reload',prompt:'Same characters after reload.',referenceLibrary:prepared.referenceLibrary};
  for(let i=0;i<7;i++){await f.execute('prepare',extra);f.advance(2100)}
  assert.equal(f.stats().uploads,1);assert.equal((await f.execute('ready',extra)).ready,true);
  f.d.querySelector('#attachments').replaceChildren();f.d.querySelector('textarea').value='';
  f.picker.querySelectorAll('[role=option]')[1].querySelector('img').src='blob:manual-replacement';
  const next={...extra,jobId:'scene-replaced',prompt:'Next.'};
  for(let i=0;i<8;i++){await f.execute('prepare',next);f.advance(2100)}
  assert.equal(f.stats().fileUploads,2);assert.equal((await f.execute('ready',next)).ready,true);
  assert.equal(f.stats().userSelections,0);
});

test('Flow does not reuse another project library even when the reference filename is the same',async()=>{
  const f=flowConfirmFixture();f.open();
  const referenceLibrary=[{name:f.ref.name,url:'blob:'+f.ref.name,projectUrl:'https://flow.google.com/project/other'}];
  await finishFlowReference(f,{referenceLibrary});
  assert.equal(f.stats().uploads,1);assert.equal(f.stats().confirmed.length,1);
});

test('Flow selects only its uploaded reference from the ingredients library before inspecting the inert composer',async()=>{
  const f=fixture('flow');let selections=0,unrelated=0;
  f.input.onchange=()=>{
    f.d.querySelector('form').setAttribute('inert','');
    const picker=f.d.createElement('div');picker.setAttribute('role','dialog');picker.setAttribute('aria-labelledby','ingredients-title');
    picker.innerHTML='<h2 id="ingredients-title">Thêm thành phần vào dự án</h2><div role="list"><button role="option">another-user-image.jpg Hình ảnh</button><button role="option">'+f.ref.name+' Hình ảnh</button></div>';
    const options=picker.querySelectorAll('[role=option]');options[0].onclick=()=>unrelated++;
    options[1].onclick=()=>{selections++;picker.remove();f.d.querySelector('form').removeAttribute('inert');f.complete()};f.d.body.append(picker);
  };
  await f.execute('prepare');assert.equal(f.counts().sends,0);
  assert.equal((await f.execute('setup')).ready,false);assert.equal(selections,1);assert.equal(unrelated,0);
  await f.execute('prepare');f.advance(2200);await f.execute('prepare');
  assert.equal((await f.execute('ready')).ready,true);await f.execute('send');assert.equal(f.counts().sends,1);
});

test('Flow recognizes adjacent filename/type spans and excludes a pre-existing duplicate after its library rerenders',async()=>{
  const f=fixture('flow');let oldSelections=0,newSelections=0;
  const picker=f.d.createElement('div');picker.setAttribute('role','dialog');picker.setAttribute('aria-label','Thêm thành phần vào dự án');
  const option=url=>{const e=f.d.createElement('button');e.setAttribute('role','option');e.innerHTML='<img src="'+url+'"><span>'+f.ref.name+'</span><span>Hình ảnh</span>';return e};
  picker.append(option('https://images.test/old-reference.jpg'));f.d.body.append(picker);
  f.input.onchange=()=>{
    picker.replaceChildren();const old=option('https://images.test/old-reference.jpg'),fresh=option('https://images.test/new-reference.jpg');
    old.onclick=()=>oldSelections++;fresh.onclick=()=>{newSelections++;picker.remove();f.complete()};picker.append(old,fresh);
  };
  await f.execute('prepare');assert.equal((await f.execute('setup')).ready,false);
  assert.equal(oldSelections,0);assert.equal(newSelections,1);assert.equal(f.counts().sends,0);
});

test('Flow selects all three uploaded references across a picker that closes after each choice; Send waits for the full set',async()=>{
  const f=fixture('flow'),refs=[f.ref,{...f.ref,name:'sf_ref_aaaaaaaaaaaaaaaa.jpg'},{...f.ref,name:'sf_ref_bbbbbbbbbbbbbbbb.jpg'}];
  let selected=0;const form=f.d.querySelector('form');
  const open=()=>{
    const picker=f.d.createElement('div');picker.setAttribute('role','dialog');picker.setAttribute('aria-label','Thêm thành phần vào dự án');
    for(const ref of refs){
      const option=f.d.createElement('button');option.setAttribute('role','option');option.textContent=ref.name+' Hình ảnh';
      option.onclick=()=>{selected++;const image=f.d.createElement('img');image.src='blob:'+ref.name;f.d.querySelector('#attachments').append(image);picker.remove()};picker.append(option);
    }
    f.d.body.append(picker);
  };
  const add=f.d.createElement('button');add.type='button';add.setAttribute('aria-label','Thêm thành phần vào ô nhập câu lệnh');add.onclick=open;form.append(add);
  f.input.onchange=open;
  await f.execute('prepare',{references:refs});
  for(let i=0;i<5;i++){assert.equal((await f.execute('setup')).ready,false);assert.equal(f.counts().sends,0)}
  assert.equal(selected,3);assert.equal((await f.execute('ready')).ready,false);
  await f.execute('prepare',{references:refs});f.advance(2200);await f.execute('prepare',{references:refs});
  assert.equal((await f.execute('ready',{references:refs})).ready,true);await f.execute('send',{references:refs});assert.equal(f.counts().sends,1);
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
