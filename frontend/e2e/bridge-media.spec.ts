import {test,expect,type Page} from '@playwright/test';
import path from 'node:path';
import {armDownloadCapture,readDownloadCapture} from '../../browser-extension/download-capture.js';

async function fixture(page:Page,provider:string,body:string){
  const host={aistudio:'aistudio.google.com',gemini:'gemini.google.com',flow:'flow.google.com'}[provider];
  await page.route('https://'+host+'/**',route=>route.request().url().endsWith('.svg')?
    route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="navy"/></svg>'}):
    route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+body}));
  await page.addInitScript(()=>{(window as any).chrome={runtime:{onMessage:{addListener:(fn:any)=>{(window as any).bridgeListener=fn},removeListener:()=>{}}}}});
  await page.goto('https://'+host+'/');
  await page.addScriptTag({path:path.resolve('../browser-extension/adapters.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/media-content.js')});
  await page.addScriptTag({path:path.resolve('../browser-extension/content.js')});
  return (message:any)=>page.evaluate(message=>new Promise<any>(resolve=>(window as any).bridgeListener({type:'storyforge',jobId:'media1',provider:message.provider,prompt:'The first complete narration.',media:{voice:'Enzo',style:'Friendly'},...message},{},resolve)),{provider,...message});
}

test('AI Studio creates one dialog, selects Enzo/Friendly and replaces only its previous narration',async({page})=>{
  const invoke=await fixture(page,'aistudio',`<main><button id="create">Create new dialog</button></main>`);
  await page.evaluate(()=>{
    document.getElementById('create')!.onclick=()=>{
      document.querySelector('main')!.innerHTML=`<button id="speaker">Speaker 1 - Fola</button><button id="style">Style</button><div contenteditable="true" role="textbox"></div><button id="run">Run Ctrl ↵</button>`;
      document.getElementById('speaker')!.onclick=()=>{
        const dialog=document.createElement('aside');dialog.setAttribute('role','dialog');dialog.innerHTML='<h2>Speaker settings</h2><button role="option">Enzo</button><button aria-label="Close">close</button>';document.body.append(dialog);
        (dialog.querySelector('[role="option"]') as HTMLElement).onclick=()=>{document.getElementById('speaker')!.textContent='Speaker 1 - Enzo'};
        (dialog.querySelector('[aria-label="Close"]') as HTMLElement).onclick=()=>dialog.remove();
      };
      document.getElementById('style')!.onclick=()=>{
        const menu=document.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button role="menuitem">Friendly</button>';document.body.append(menu);
        (menu.firstChild as HTMLElement).onclick=()=>{document.getElementById('style')!.textContent='Friendly';menu.remove()};
      };
      document.getElementById('run')!.onclick=()=>{(window as any).runs=((window as any).runs||0)+1};
    };
  });
  await page.clock.install();
  let setup;
  for(let i=0;i<9;i++){setup=await invoke({action:'media-setup'});expect(setup.ok,setup.error).toBe(true);await page.clock.runFor(2100)}
  expect(setup.ready).toBe(true);
  await expect(page.locator('#speaker')).toHaveText('Speaker 1 - Enzo');await expect(page.locator('#style')).toHaveText('Friendly');
  const prepared=await invoke({action:'media-prepare'});expect(prepared.ok,prepared.error).toBe(true);
  expect((await invoke({action:'media-ready'})).ready).toBe(true);
  await invoke({action:'media-send'});await invoke({action:'media-send'});
  expect(await page.evaluate(()=>(window as any).runs)).toBe(1);
  expect((await invoke({action:'media-prepare',jobId:'media2',prompt:'Second narration.'})).ok).toBe(true);
  await expect(page.locator('[contenteditable]')).toHaveText('Second narration.');
  await page.locator('[contenteditable]').fill('My own edited text');
  expect((await invoke({action:'media-prepare',jobId:'media3',prompt:'Third narration.'})).ok).toBe(false);
  await expect(page.locator('[contenteditable]')).toHaveText('My own edited text');
});

test('Gemini captures only the new generated image and the exact full-download blob',async({page})=>{
  const invoke=await fixture(page,'gemini',`<main><div contenteditable="true" role="textbox"></div><button aria-label="Send message">Send</button><model-response><img src="/old.svg"><button>Download</button></model-response></main>`);
  await page.locator('img').evaluate(async image=>{await (image as HTMLImageElement).decode()});
  const prepared=await invoke({action:'media-prepare'});expect(prepared.ok).toBe(true);
  expect((await invoke({action:'media-poll',baseline:prepared.baseline})).ready).toBe(false);
  await page.evaluate(()=>{
    const response=document.createElement('model-response');response.innerHTML='<img src="/new.svg"><button aria-label="Download full size image">Download</button>';document.querySelector('main')!.append(response);
    (response.querySelector('button') as HTMLElement).onclick=()=>{const a=document.createElement('a');a.download='generated.png';a.href=URL.createObjectURL(new Blob(['image bytes'],{type:'image/png'}));a.click();URL.revokeObjectURL(a.href)};
  });
  await page.locator('img').last().evaluate(async image=>{await (image as HTMLImageElement).decode()});
  await page.clock.install();
  expect((await invoke({action:'media-poll',baseline:prepared.baseline})).ready).toBe(false);
  await page.clock.runFor(4500);
  const generated=await invoke({action:'media-poll',baseline:prepared.baseline});expect(generated.ready).toBe(true);expect(generated.result.url).toContain('/new.svg');
  const info=await invoke({action:'media-download-info',result:generated.result});expect(info.direct).toBe(false);
  const downloaded:any[]=[];page.on('download',item=>downloaded.push(item));
  await page.evaluate(armDownloadCapture,'ownedticket');
  expect((await invoke({action:'media-download-click',result:generated.result})).clicked).toBe(true);
  const source=await page.evaluate(readDownloadCapture,'ownedticket');
  expect(source).toMatch(/^blob:https:\/\/gemini.google.com\//);
  expect(await page.evaluate(async url=>(await (await fetch(url)).text()),source)).toBe('image bytes');
  // Capture suppresses the page's default save dialog. The background worker
  // initiates this URL through chrome.downloads with saveAs:false instead.
  await page.clock.runFor(100);
  expect(downloaded).toHaveLength(0);
});

test('Flow verifies requested settings and waits when the requested model is unavailable',async({page})=>{
  const body=`<button id="summary" aria-label="Điều kiện kích hoạt cài đặt">Video · 720p · 10 giây · x1</button><div role="menu">${['Video','Thành phần','16:9','Omni 1.1 Flash','720p','10 giây','x1'].map(value=>`<button role="radio" aria-checked="false">${value}</button>`).join('')}</div><textarea></textarea><button aria-label="Bắt đầu tạo">arrow_forward</button>`;
  const invoke=await fixture(page,'flow',body);
  await page.evaluate(()=>{
    document.querySelectorAll('[role="menu"] button').forEach(button=>{(button as HTMLElement).onclick=()=>button.setAttribute('aria-checked','true')});
    document.getElementById('summary')!.onclick=()=>{const panel=document.querySelector('[role="menu"]') as HTMLElement;panel.hidden=!panel.hidden};
  });
  await page.clock.install();
  let result;
  for(let i=0;i<10;i++){result=await invoke({action:'media-setup'});expect(result.ok,result.error).toBe(true);await page.clock.runFor(2100)}
  expect(result.ready).toBe(true);
  expect(await page.locator('[role="menu"] button[aria-checked="true"]').count()).toBe(6);
  expect((await invoke({action:'media-prepare'})).ok).toBe(true);
  expect((await invoke({action:'media-ready'})).ready).toBe(true);
  await page.evaluate(()=>{delete (window as any).storyForgeMediaOwned.flowConfigured;delete (window as any).storyForgeMediaOwned.flowVerified;delete (window as any).storyForgeMediaOwned.flowChoices;(document.querySelector('[role="menu"]') as HTMLElement).hidden=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Omni 1.1 Flash')!.remove()});
  result=await invoke({action:'media-setup'});expect(result.ok).toBe(false);expect(result.error).toContain('Omni 1.1 Flash');
});

test('Flow opens only its new thumbnail and downloads the original 720p clip from the player menu',async({page})=>{
  const invoke=await fixture(page,'flow',`<main><textarea></textarea><button aria-label="Bắt đầu tạo">arrow_forward</button><img alt="Hình thu nhỏ của video đã tạo" src="/old.svg"></main>`);
  const prepared=await invoke({action:'media-prepare'});
  await page.evaluate(()=>{
    const tile=document.createElement('div');tile.innerHTML='<img alt="Hình thu nhỏ của video đã tạo" src="/new.svg">';
    document.querySelector('main')!.append(tile);
    tile.onclick=()=>{
      document.querySelector('main')!.innerHTML='<video src="https://flow.google.com/generated.mp4"></video><button aria-label="Tuỳ chọn khác">more_vert</button>';
      document.querySelector('button')!.onclick=()=>{
        const menu=document.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button role="menuitem">Tải nội dung nghe nhìn xuống</button>';document.body.append(menu);
        (menu.firstChild as HTMLElement).onclick=()=>{
          const submenu=document.createElement('div');submenu.setAttribute('role','menu');submenu.innerHTML='<button role="menuitem">270p Ảnh GIF động</button><button role="menuitem">720p Kích thước gốc</button><button role="menuitem">1080p Đã tăng độ phân giải</button>';document.body.append(submenu);
          (submenu.children[1] as HTMLElement).onclick=()=>{const a=document.createElement('a');a.download='original.mp4';a.href=URL.createObjectURL(new Blob(['owned video'],{type:'video/mp4'}));a.click();URL.revokeObjectURL(a.href);(window as any).originalDownloads=((window as any).originalDownloads||0)+1};
          (submenu.children[2] as HTMLElement).onclick=()=>{throw Error('Must not upscale')};
        };
      };
    };
  });
  await page.clock.install();
  for(let i=0;i<7;i++){await invoke({action:'media-poll',baseline:prepared.baseline});await page.clock.runFor(2100)}
  const result=await invoke({action:'media-poll',baseline:prepared.baseline});
  expect(result.ready).toBe(true);expect(result.result.url).toContain('generated.mp4');
  expect((await invoke({action:'media-download-info',result:result.result})).direct).toBe(false);
  await page.evaluate(armDownloadCapture,'flowticket');
  await invoke({action:'media-download-click',result:result.result});
  await invoke({action:'media-download-continue',result:result.result});
  await invoke({action:'media-download-continue',result:result.result});
  expect(await page.evaluate(()=>(window as any).originalDownloads)).toBe(1);
  const url=await page.evaluate(readDownloadCapture,'flowticket');
  expect(await page.evaluate(async url=>(await (await fetch(url)).text()),url)).toBe('owned video');
});
