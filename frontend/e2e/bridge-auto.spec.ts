import {test as base,expect,type Page} from '@playwright/test';
import path from 'node:path';

// Keep Comet's browser-level page lifecycle isolated between fixture cases.
const test=base.extend({
  context:async({playwright,browserName,launchOptions,headless,channel,contextOptions},use)=>{
    const browser=await playwright[browserName].launch({...launchOptions,headless,channel});
    try{await use(await browser.newContext(contextOptions))}finally{await browser.close()}
  },
});

async function chatgptFixture(page:Page,body:string){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8">'+body}));
  await page.addInitScript(()=>{(window as any).chrome={runtime:{onMessage:{addListener:(fn:any)=>{(window as any).bridgeListener=fn},removeListener:()=>{}}}}});
  await page.goto('https://chatgpt.com/');
  await page.addScriptTag({path:path.resolve('../browser-extension/adapters.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/content.js')});
  return (message:any)=>page.evaluate(message=>new Promise<any>(resolve=>(window as any).bridgeListener({type:'storyforge',jobKey:'new-composer:1',prompt:'A complete prompt.\n\nReturn JSON with English and Tiếng Việt.',...message},{},resolve)),message);
}

for(const [name,editor] of [
  ['Vietnamese textarea','<textarea id="current" placeholder="Hỏi ChatGPT"></textarea>'],
  ['rich textbox without the old ID','<div id="current" role="textbox" contenteditable="true"><p><br></p></div>'],
  ['plain text editor','<div id="current" role="textbox" contenteditable="plaintext-only"></div>'],
  ['unique unnamed editor','<div id="current" contenteditable=""></div>'],
]){
  test('fills the '+name+' and sends only after the full prompt is present',async({page})=>{
    const invoke=await chatgptFixture(page,`<aside><textarea>Search history</textarea></aside>
      <textarea id="prompt-textarea" readonly>Read-only copy</textarea>
      <div contenteditable="true" style="display:none">Hidden copy</div>
      <main>${editor}<button data-testid="composer-send-button" disabled>Gửi</button>
      <button aria-label="Start voice mode" onclick="window.wrongClick=true">Voice</button></main>`);
    await page.evaluate(()=>{
      document.getElementById('current')!.addEventListener('input',()=>{(document.querySelector('[data-testid="composer-send-button"]') as HTMLButtonElement).disabled=false});
      document.querySelector('[data-testid="composer-send-button"]')!.addEventListener('click',()=>{(window as any).sentCount=((window as any).sentCount||0)+1});
    });
    const prepared=await invoke({action:'auto-prepare'});
    expect(prepared.ok,prepared.error).toBe(true);
    expect((await invoke({action:'auto-check-send',baseline:prepared.baseline})).ready).toBe(true);
    expect((await invoke({action:'auto-send',baseline:prepared.baseline})).submitted).toBe(true);
    expect((await invoke({action:'auto-send',baseline:prepared.baseline})).ok).toBe(false);
    expect(await page.evaluate(()=>(window as any).sentCount)).toBe(1);
    expect(await page.evaluate(()=>(window as any).wrongClick||false)).toBe(false);
    await expect(page.locator('aside textarea')).toHaveValue('Search history');
    await expect(page.locator('#prompt-textarea')).toHaveValue('Read-only copy');
  });
}

test('a draft that mounts after page load is never overwritten',async({page})=>{
  const invoke=await chatgptFixture(page,'<main></main>');
  await page.evaluate(()=>setTimeout(()=>document.querySelector('main')!.insertAdjacentHTML('beforeend','<textarea placeholder="Hỏi ChatGPT">My existing draft</textarea>'),650));
  const prepared=await invoke({action:'auto-prepare'});
  expect(prepared.ok).toBe(false);expect(prepared.error).toContain('chưa gửi');
  await expect(page.locator('textarea')).toHaveValue('My existing draft');
});

test('an editor remount is detected before sending and the next preparation fills the live editor',async({page})=>{
  const invoke=await chatgptFixture(page,'<main><textarea placeholder="Hỏi ChatGPT"></textarea><button data-testid="send-button">Send</button></main>');
  await page.evaluate(()=>{
    document.querySelector('textarea')!.addEventListener('input',()=>{
      const replacement=document.createElement('textarea');replacement.placeholder='Hỏi ChatGPT';
      document.querySelector('textarea')!.replaceWith(replacement);
    },{once:true});
    document.querySelector('button')!.addEventListener('click',()=>{(window as any).sentCount=((window as any).sentCount||0)+1});
  });
  const remounted=await invoke({action:'auto-prepare'});
  expect(remounted).toMatchObject({ok:false,code:'EDITOR_CHANGED'});
  expect(await page.evaluate(()=>(window as any).sentCount||0)).toBe(0);
  const prepared=await invoke({action:'auto-prepare'});
  expect(prepared.ok,prepared.error).toBe(true);
  expect((await invoke({action:'auto-send',baseline:prepared.baseline})).submitted).toBe(true);
  expect(await page.evaluate(()=>(window as any).sentCount)).toBe(1);
});

test('ambiguous fallback fields are left untouched',async({page})=>{
  const invoke=await chatgptFixture(page,'<main><div contenteditable="true"></div><div contenteditable="true"></div></main>');
  await page.clock.install();
  const pending=invoke({action:'auto-prepare'});
  await page.clock.runFor(8100);
  const prepared=await pending;
  expect(prepared).toMatchObject({ok:false,code:'INPUT_NOT_READY'});
  expect(await page.locator('[contenteditable]').allTextContents()).toEqual(['','']);
});

test('Vietnamese Gemini waits for the enabled send control and never clicks a hidden or stop button',async({page})=>{
  await page.route('https://gemini.google.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8">
    <rich-textarea><div contenteditable="true" role="textbox"></div></rich-textarea>
    <button aria-label="Send message" style="visibility:hidden" onclick="window.wrongClick=true">Hidden</button>
    <button class="send-button" disabled>Disabled copy</button>
    <button id="real-send" aria-label="Gửi tin nhắn" disabled>Send</button>
    <model-response>Old reply</model-response>`}));
  await page.addInitScript(()=>{(window as any).chrome={runtime:{onMessage:{addListener:(fn:any)=>{(window as any).bridgeListener=fn},removeListener:()=>{}}}}});
  await page.goto('https://gemini.google.com/app');
  await page.evaluate(()=>{
    document.querySelector('[contenteditable]')!.addEventListener('input',()=>setTimeout(()=>{(document.querySelector('#real-send') as HTMLButtonElement).disabled=false},500));
    document.querySelector('#real-send')!.addEventListener('click',()=>{
      (window as any).sentCount=((window as any).sentCount||0)+1;
      document.querySelector('#real-send')!.setAttribute('aria-label','Ngừng tạo câu trả lời');
      document.body.insertAdjacentHTML('beforeend','<model-response>{"issues":[],"summary":"Checked"}</model-response>');
    });
  });
  await page.addScriptTag({path:path.resolve('../browser-extension/adapters.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/content.js')});
  const invoke=(message:any)=>page.evaluate(message=>new Promise<any>(resolve=>(window as any).bridgeListener({type:'storyforge',jobKey:'gemini:1',prompt:'Audit this outline',...message},{},resolve)),message);
  const prepared=await invoke({action:'auto-prepare'});
  expect(prepared.ok).toBe(true);
  expect((await invoke({action:'auto-check-send',baseline:prepared.baseline})).ready).toBe(true);
  expect((await invoke({action:'auto-send',baseline:prepared.baseline})).submitted).toBe(true);
  expect(await page.evaluate(()=>(window as any).sentCount)).toBe(1);
  expect(await page.evaluate(()=>(window as any).wrongClick||false)).toBe(false);
  expect((await invoke({action:'auto-poll',baseline:prepared.baseline})).busy).toBe(true);
  expect((await invoke({action:'auto-send',baseline:prepared.baseline})).ok).toBe(false);
  await page.locator('#real-send').evaluate(el=>el.removeAttribute('aria-label'));
  expect((await invoke({action:'auto-poll',baseline:prepared.baseline})).busy).toBe(false);
});

test('multiline prompt survives a rich editor and only matching content can send',async({page})=>{
  await page.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8">
    <div id="prompt-textarea" contenteditable="true" role="textbox"><p><br></p></div>
    <button data-testid="send-button" disabled>Send</button>`}));
  await page.addInitScript(()=>{
    (window as any).chrome={runtime:{onMessage:{addListener:(fn:any)=>{(window as any).bridgeListener=fn},removeListener:()=>{}}}};
  });
  await page.goto('https://chatgpt.com/');
  await page.evaluate(()=>{
    const editor=document.getElementById('prompt-textarea')!;
    editor.addEventListener('input',()=>{
      // Read as a rich editor does, including the browser's block boundaries.
      (window as any).editorModel=[...editor.querySelectorAll('p')].map(p=>p.textContent).join('\n').replace(/\u00a0/g,' ');
      (document.querySelector('button') as HTMLButtonElement).disabled=false;
    });
    document.querySelector('button')!.addEventListener('click',()=>{(window as any).sentCount=((window as any).sentCount||0)+1});
  });
  await page.addScriptTag({path:path.resolve('../browser-extension/adapters.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/content.js')});
  const prompt='Create a story.\n\nReturn JSON:\n{\n  "title": "Tiếng Việt & <story>",\n  "lines": ["first", "second"]\n}\nEnd.';
  const invoke=(message:any)=>page.evaluate(message=>new Promise<any>(resolve=>(window as any).bridgeListener({type:'storyforge',jobKey:'rich:1',...message},{},resolve)),{prompt,...message});
  const prepared=await invoke({action:'auto-prepare'});
  expect(prepared.ok).toBe(true);
  expect((await invoke({action:'auto-check-send',baseline:prepared.baseline})).ready).toBe(true);
  expect(await page.evaluate(()=>(window as any).editorModel.trim())).toBe(prompt);
  await page.locator('#prompt-textarea').fill('A user changed this prompt');
  expect((await invoke({action:'auto-send',baseline:prepared.baseline})).ok).toBe(false);
  expect(await page.evaluate(()=>(window as any).sentCount||0)).toBe(0);
  await page.locator('#prompt-textarea').fill('');
  const again=await invoke({action:'auto-prepare'});
  expect((await invoke({action:'auto-send',baseline:again.baseline})).submitted).toBe(true);
  expect(await page.evaluate(()=>(window as any).sentCount)).toBe(1);
  expect((await invoke({action:'auto-send',baseline:again.baseline})).ok).toBe(false);
});

test('automatic content adapter sends once and ignores old or streaming replies',async({page})=>{
  await page.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><textarea id="prompt-textarea"></textarea><button data-testid="send-button" onclick="window.sentCount=(window.sentCount||0)+1;document.querySelector('textarea').value=''">Send</button><div data-message-author-role="assistant"><div class="markdown">Old answer</div></div>`}));
  await page.addInitScript(()=>{
    (window as any).chrome={runtime:{onMessage:{addListener:(fn:any)=>{(window as any).bridgeListener=fn},removeListener:()=>{}}}};
  });
  await page.goto('https://chatgpt.com/');
  await page.addScriptTag({path:path.resolve('../browser-extension/adapters.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/content.js')});
  const invoke=(message:any)=>page.evaluate(message=>new Promise<any>(resolve=>(window as any).bridgeListener({type:'storyforge',jobKey:'test:1',prompt:'New prompt',...message},{},resolve)),message);
  const prepared=await invoke({action:'auto-prepare'});
  expect(prepared.ok).toBeTruthy();expect(prepared.baseline).toEqual({count:1,last:'Old answer'});
  await expect(page.locator('textarea')).toHaveValue('New prompt');
  expect((await invoke({action:'auto-poll',baseline:prepared.baseline})).text).toBe('');
  expect((await invoke({action:'auto-check-send',baseline:prepared.baseline})).ready).toBeTruthy();
  expect(await page.evaluate(()=>(window as any).sentCount||0)).toBe(0);
  expect((await invoke({action:'auto-send',baseline:prepared.baseline})).submitted).toBeTruthy();
  expect((await invoke({action:'auto-send',baseline:prepared.baseline})).ok).toBe(false);
  expect(await page.evaluate(()=>(window as any).sentCount)).toBe(1);
  await page.evaluate(()=>{document.body.insertAdjacentHTML('beforeend','<div data-message-author-role="assistant"><div class="markdown">{"new":true}</div></div><button data-testid="stop-button">Stop</button>')});
  expect((await invoke({action:'auto-poll',baseline:prepared.baseline})).busy).toBe(true);
  await page.locator('[data-testid="stop-button"]').evaluate(el=>el.remove());
  expect(await invoke({action:'auto-poll',baseline:prepared.baseline})).toMatchObject({ok:true,busy:false,text:'{"new":true}'});
});

test('automatic adapter does not overwrite a user draft or pass a visible checkpoint',async({page})=>{
  await page.route('https://gemini.google.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><rich-textarea><div contenteditable="true">My unsent draft</div></rich-textarea><button class="send-button">Send</button>'}));
  await page.addInitScript(()=>{(window as any).chrome={runtime:{onMessage:{addListener:(fn:any)=>{(window as any).bridgeListener=fn},removeListener:()=>{}}}}});
  await page.goto('https://gemini.google.com/app');
  await page.addScriptTag({path:path.resolve('../browser-extension/adapters.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/content.js')});
  const invoke=()=>page.evaluate(()=>new Promise<any>(resolve=>(window as any).bridgeListener({type:'storyforge',action:'auto-prepare',prompt:'New prompt'},{},resolve)));
  expect((await invoke()).ok).toBe(false);
  await expect(page.locator('[contenteditable]')).toHaveText('My unsent draft');
  await page.locator('[contenteditable]').fill('');
  await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div id="challenge-stage">Please complete CAPTCHA</div>'));
  const checkpoint=await invoke();expect(checkpoint.ok).toBe(false);expect(checkpoint.error).toContain('checkpoint');
});
