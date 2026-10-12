import {test,expect} from '@playwright/test';
import path from 'node:path';

test('native artifact download returns the complete JSON from a virtualized code pane',async({page})=>{
  const source=JSON.stringify({replacements:Array.from({length:18},(_,i)=>({issue_id:'ISSUE-'+i,old_text:'He said "hello".',new_text:'Full text '+i+'\nNext line.'})),summary:'All 18 patches are present.'});
  await page.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
    <meta charset="utf-8">
    <main><div data-turn="assistant" data-turn-key="turn" data-message-id="reply">
      <div data-chatgpt-selection-message-id="selection"><div class="markdown">Download the complete StoryForge Targeted Rewrite JSON.</div>
        <button id="card" data-filename="storyforge_targeted_rewrite.json">storyforge_targeted_rewrite.json<br>Code</button></div>
      <div class="turn-action-controls"><button aria-label="Sao chép">Copy</button></div>
      </div><div id="prompt-textarea" contenteditable="true"></div></main>
    <aside id="panel" hidden><button title="storyforge_targeted_rewrite.json">Storyforge Targeted Rewrite</button>
      <button aria-label="Download">Download</button><div class="monaco-editor"><div class="view-line">Only line 95: }</div></div></aside>`}));
  await page.goto('https://chatgpt.com/c/file-fixture');
  await page.evaluate(source=>{
    (window as any).downloads=0;(window as any).chrome={runtime:{getManifest:()=>({version:'1.1.34'}),onMessage:{addListener:(fn:any)=>{(window as any).listener=fn},removeListener:()=>{}}}};
    document.querySelector('#card')!.addEventListener('click',()=>{document.querySelector('#panel')!.removeAttribute('hidden')});
    document.querySelector('[aria-label="Download"]')!.addEventListener('click',()=>{
      const anchor=document.createElement('a');anchor.download='storyforge_targeted_rewrite.json';
      anchor.href=URL.createObjectURL(new Blob([source],{type:'application/json'}));
      anchor.click();URL.revokeObjectURL(anchor.href);(window as any).downloads++;
    });
  },source);
  for(const file of ['adapters.js','response-files.js','content.js'])await page.addScriptTag({path:path.resolve('../browser-extension/'+file)});
  const invoke=(action:string)=>page.evaluate(action=>new Promise<any>(resolve=>(window as any).listener({type:'storyforge',action,baseline:{count:0,last:''}},{},resolve)),action);
  const poll=await invoke('auto-poll');expect(poll.busy).toBe(false);expect(poll.fileTarget.files).toEqual(['storyforge_targeted_rewrite.json']);
  const file=await page.evaluate(target=>(window as any).storyForgeResponseFiles.read(target),poll.fileTarget);
  expect(file.text).toBe(source);expect(JSON.parse(file.text).replacements).toHaveLength(18);
  expect(await page.evaluate(()=>(window as any).downloads)).toBe(1);
  expect((await invoke('capture')).fileTarget.files).toEqual(poll.fileTarget.files);
});
