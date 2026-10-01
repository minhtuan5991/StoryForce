import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
const direction='A lonely keeper must protect the lighthouse before the storm arrives.';
const narration='The keeper heard a knock at the locked door. He turned off the lamp.';
const scene='A quiet lighthouse at sunset. Read in a warm, restrained voice.';
const prompt='A lighthouse beside a dark sea, cinematic light, one character.';
function project(){return {id:'p',title:'One Knock After Sundown',channel_id:'c',channel:{name:'Channel',color:'blue'},target_minutes:5,wpm:150,story_version:2,locked:true,stage:'LOCKED',
  jobs:[],issues:[{id:'i',issue_key:'ISSUE_001',scope:'story',cycle:0,location:'The opening scene',gemini_claim:'The door was already locked.',severity:'HIGH',chatgpt_verdict:'CONFIRMED',final_status:'CONFIRMED',fix_status:'OPEN',evidence:'The keeper locked the door.',explanation:'The action contradicts the opening.',challenge:'Check the second paragraph.',bible_references:['The keeper carries one key.'],repair:'Clarify the timing.',resolution:'Awaiting review'}],publish:{},workflow_settings:{default_premise_count:10},
  draft:narration,word_count:15,audit_cycle:0,profile:{word_range:[690,810]},lock_gate:{can_lock:false,reasons:['final_verify_gemini: quality gate failed']},versions:[{id:'v',version:1,created_at:'2026-09-21',text_hash:'abcd12345678',text:narration,affected:{scenes:'All scenes need review.'}}],
  chunks:[{id:'chunk',number:1,text:narration,scene_context:scene,previous_context:'The keeper is alone.',next_context:'The storm approaches.',mood:'Quiet tension',voice_profile:{style:'Warm and natural'},status:'PENDING',word_count:15,estimated_duration:10,reasons:['Sentence complete']}],
  scenes:[{id:'sc',scene_id:'scene_001',scene_key:'scene_001',title:'The first knock',purpose:'Introduce the keeper.',number:1,prompt,negative_prompt:'No text or logos',continuity:{wardrobe:'Dark blue coat'},visual_type:'IMAGE',start_word:0,end_word:15,duration:10,offset:0,status:'PENDING'}],
  assets:[],thumbnail_prompt:'Large title and a single lighthouse.',premises:[{id:'pr',category:'Core',title:'The last light',logline:direction,scores:{hook:90,originality:90,duration_fit:90,source_similarity:2},warnings:[],mini_test:{opening:direction}}],
  artifacts:{content_direction:{id:'dir',provider:'chatgpt',template_version:'1',created_at:'2026-09-21',output_hash:'abcdef',content:{retain:[direction],source_id:'scene_001'}},story_bible:{id:'bible',provider:'chatgpt',content:{setting:direction}},outline:{content:{scenes:[{scene_id:'scene_001',title:'The first knock',purpose:direction,estimated_time:10}]}},final_verify_gemini:{content:{passed:false,summary:'The ending needs a clearer resolution.'}}}}}
async function setup(page:Page,mode:'mock'|'missing'|'native'='mock'){
  const p=project(),mutations:{path:string,body:any}[]=[];
  await page.addInitScript(({mode})=>{
    localStorage.setItem('storyforge-interface-language','vi');
    (window as any).translationCalls=[];(window as any).translationLanguages=[];
    if(mode==='mock')Object.defineProperty(window,'Translator',{value:{create:async(options:any)=>{(window as any).translationLanguages.push(options.sourceLanguage);return {translate:async(text:string)=>{(window as any).translationCalls.push(text);return 'Bản dịch: '+text}}}},configurable:true});
    if(mode==='missing')Object.defineProperty(window,'Translator',{value:undefined,configurable:true});
  },{mode});
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let result:any={items:[],total:0};
    if(route.request().method()!=='GET'){mutations.push({path,body:route.request().postDataJSON()});result={id:'saved'}}
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects/p')result=p;
    if(path==='/api/projects/p/validate')result={valid:true,narration:[1,1],visuals:[1,1],missing:[],warnings:[]};
    await route.fulfill({json:result});
  });
  return {p,mutations};
}
async function go(page:Page,tab:string){
  await page.goto('/#/projects/p/'+tab);
  // Comet's fresh test profiles perform a one-time reload just after startup.
  await page.waitForTimeout(2200);
  await expect(page.getByRole('group',{name:'Ngôn ngữ nội dung'})).toBeVisible();
}
async function vi(page:Page){await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click()}

test('view translation preserves original JSON, caches through polling/reload and invalidates changed text',async({page})=>{
  const {p,mutations}=await setup(page);await go(page,'direction');
  expect(await page.evaluate(()=>(window as any).translationCalls.length)).toBe(0);
  await vi(page);await expect(page.getByText('Bản dịch: '+direction,{exact:true})).toBeVisible();
  expect(mutations).toEqual([]);
  await page.waitForTimeout(2700);
  expect(await page.evaluate(text=>(window as any).translationCalls.filter((t:string)=>t===text).length,direction)).toBe(1);
  await page.getByRole('button',{name:'Sửa JSON',exact:true}).click();
  expect(JSON.parse(await page.locator('.code-editor').inputValue())).toEqual(p.artifacts.content_direction.content);
  await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)).toEqual({path:'/api/artifacts/dir',body:{content:p.artifacts.content_direction.content}});
  await page.reload();await vi(page);await expect(page.getByText('Bản dịch: '+direction,{exact:true})).toBeVisible();
  expect(await page.evaluate(text=>(window as any).translationCalls.includes(text),direction)).toBe(false);
  p.artifacts.content_direction.content.retain=[direction+' A visitor arrives.'];
  await expect(page.getByText('Bản dịch: '+p.artifacts.content_direction.content.retain[0],{exact:true})).toBeVisible({timeout:10000});
  await page.getByRole('button',{name:'Tiếng Anh gốc',exact:true}).click();
  await expect(page.locator('[data-view-translated]')).toHaveCount(0);
});

test('draft, audio and visual actions retain English payloads; collapsed content is lazy',async({page,context})=>{
  const {mutations}=await setup(page);await context.grantPermissions(['clipboard-read','clipboard-write']);
  await go(page,'draft');await vi(page);
  await expect(page.locator('.draft-view-translation')).toContainText('Bản dịch: '+narration);
  await expect(page.locator('.draft-editor')).toHaveValue(narration);
  await page.getByRole('button',{name:'Sao chép',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(narration);
  await page.locator('.studio-nav a[href$="/tts"]').click();
  await expect(page.locator('.chunk-card')).toBeVisible();
  expect(await page.evaluate(text=>(window as any).translationCalls.includes(text),scene)).toBe(false);
  await page.locator('.chunk-card summary').click();
  await expect(page.getByText('Bản dịch: '+scene,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Scene · AI Studio',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(scene);
  await page.getByRole('button',{name:'Đưa vào hàng đợi Bridge',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)?.body.payload).toMatchObject({text:narration,scene,chunk_id:'chunk',voice:{style:'Warm and natural'}});
  await page.locator('.studio-nav a[href$="/visuals"]').click();
  await page.locator('.visual-card-body>p').first().scrollIntoViewIfNeeded();
  await expect(page.getByText('Bản dịch: '+prompt,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Đưa vào hàng đợi Bridge',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)?.body.payload).toEqual({prompt,negative_prompt:'No text or logos',scene_id:'sc'});
});

test('all requested sections expose the control; audit dialog and version text translate',async({page})=>{
  await setup(page);await go(page,'premises');await vi(page);
  await expect(page.getByText('Bản dịch: '+direction,{exact:true})).toBeVisible();
  for(const tab of ['direction','bible','outline','draft','audit','versions','tts','visuals','assets','timeline','render']){
    await page.locator(`.studio-nav a[href$="/${tab}"]`).click();await expect(page.getByRole('group',{name:'Ngôn ngữ nội dung'})).toBeVisible();
    if(tab==='audit'){
      await page.getByRole('button',{name:'ISSUE_001',exact:true}).click();
      await expect(page.getByRole('dialog')).toContainText('Bản dịch: The keeper locked the door.');
      await page.getByRole('dialog').getByRole('button',{name:'Đóng hộp thoại'}).click();
    }
    if(tab==='versions'){
      await page.getByRole('button',{name:'So sánh / mục bị ảnh hưởng'}).click();
      await page.locator('.compare pre').first().scrollIntoViewIfNeeded();
      await expect(page.locator('.compare pre').first()).toContainText('Bản dịch: '+narration);
    }
  }
  await page.locator('.studio-nav a[href$="/publish"]').click();await expect(page.getByRole('group',{name:'Ngôn ngữ nội dung'})).toHaveCount(0);
});

test('unavailable translation leaves original content and workflow actions usable',async({page})=>{
  const {mutations}=await setup(page,'missing');await go(page,'direction');await vi(page);
  await expect(page.getByRole('status')).toContainText('Trình duyệt chưa hỗ trợ');
  await expect(page.getByText(direction,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Tạo định hướng',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)?.body.kind).toBe('content_direction');
});

test('hiding the tab cancels pending translation and returning to English prevents stale results',async({page})=>{
  await setup(page);await go(page,'direction');
  await page.evaluate(()=>{
    (window as any).aborted=0;
    (window as any).Translator.create=async()=>({translate:(text:string,{signal}:{signal:AbortSignal})=>new Promise((resolve,reject)=>{
      (window as any).translationCalls.push(text);
      const timer=setTimeout(()=>resolve('Bản dịch: '+text),1000);
      signal.addEventListener('abort',()=>{clearTimeout(timer);(window as any).aborted++;reject(new DOMException('Cancelled','AbortError'))},{once:true});
    })});
  });
  await vi(page);
  await expect.poll(()=>page.evaluate(()=>(window as any).translationCalls.length)).toBeGreaterThan(0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
  await expect.poll(()=>page.evaluate(()=>(window as any).aborted)).toBe(1);
  await page.getByRole('button',{name:'Tiếng Anh gốc',exact:true}).click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
  await expect(page.getByText(direction,{exact:true})).toBeVisible();
  await expect(page.locator('[data-view-translated]')).toHaveCount(0);
  await vi(page);await expect(page.getByText('Bản dịch: '+direction,{exact:true})).toBeVisible();
});

test('Comet built-in translator produces real Vietnamese without any workflow request',async({page})=>{
  test.setTimeout(150000);
  const {mutations}=await setup(page,'native');await go(page,'direction');
  test.skip(!await page.evaluate(()=>'Translator' in window),'This browser has no native Translator API');
  await vi(page);
  const text=page.locator('.readable-value .view-text').first();
  await expect(text).toHaveAttribute('lang','vi',{timeout:125000});
  const result=await text.textContent();expect(result).not.toBe(direction);expect(result).toMatch(/[àáạảãâăèéêìíòóôơùúưỳýđ]/i);
  expect(mutations).toEqual([]);
  await page.screenshot({path:'../.runtime/view-translation/vietnamese-direction.png',fullPage:true});
});

const chineseSource={id:'source',title:'校园里的秘密',url:'https://example.com/story',transcript:'今天的故事发生在一所学校。学生发现了一封神秘的信。老师说不要打开那扇门。',summary:'学生必须决定是否相信老师。',notes:'保持故事原来的结局。',tags:['学校','秘密'],language:'English',channel_id:'c',dna:{},fits:[]};
async function sourcePage(page:Page,mode:'mock'|'missing'|'native'='mock',source={...chineseSource}){
  const state=await setup(page,mode);
  await page.route('**/api/sources/source',async route=>{
    if(route.request().method()==='GET')await route.fulfill({json:source});else await route.fallback();
  });
  await page.goto('/#/inbox/source');await page.waitForTimeout(2200);
  await expect(page.getByRole('group',{name:'Ngôn ngữ nội dung'})).toBeVisible();
  return {...state,source};
}

test('source translations are read-only; original JSON and analysis requests remain unchanged',async({page})=>{
  const {source,mutations}=await sourcePage(page);await vi(page);
  const preview=page.getByRole('region',{name:'Bản dịch tư liệu nguồn'});
  await expect(preview.getByText('Bản dịch: '+source.transcript,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).translationLanguages)).toEqual(['zh']);
  await expect(preview.locator('textarea,input,[contenteditable=true]')).toHaveCount(0);
  expect(mutations).toEqual([]);
  await page.getByRole('button',{name:'Sửa JSON',exact:true}).click();
  const {id,dna,fits,...original}=source;
  expect(JSON.parse(await page.locator('.code-editor').inputValue())).toEqual(original);
  await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)).toEqual({path:'/api/sources/source',body:original});
  await page.getByRole('button',{name:'Phân tích DNA truyện',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)).toEqual({path:'/api/jobs',body:{kind:'story_dna',source_id:'source'}});
  await page.getByRole('button',{name:'Bản gốc',exact:true}).click();
  await expect(preview).toHaveCount(0);
  await expect(page.locator('.readable-value').filter({hasText:source.transcript})).toContainText(source.transcript);
});

test('source reading caches translation, refreshes changed content and keeps source tabs isolated',async({page})=>{
  const {source,mutations}=await sourcePage(page);await vi(page);
  const preview=page.getByRole('region',{name:'Bản dịch tư liệu nguồn'});
  await expect(preview.getByText('Bản dịch: '+source.transcript,{exact:true})).toBeVisible();
  await page.waitForTimeout(700);await page.reload();await vi(page);
  await expect(preview.getByText('Bản dịch: '+source.transcript,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).translationCalls)).toEqual([]);
  source.transcript+=' 最后学生找到了答案。';
  await expect(preview.getByText('Bản dịch: '+source.transcript,{exact:true})).toBeVisible({timeout:10000});
  await page.getByRole('button',{name:'DNA truyện',exact:true}).click();
  await expect(page.getByRole('group',{name:'Ngôn ngữ nội dung'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:source.title,exact:true})).toBeVisible();
  expect(mutations).toEqual([]);
});

test('English source translates; a long Chinese source only translates visible chunks',async({page})=>{
  const {source}=await sourcePage(page,'mock',{...chineseSource,title:'A quiet school',transcript:direction,summary:'',notes:'',tags:[]});
  await vi(page);await expect(page.getByRole('region',{name:'Bản dịch tư liệu nguồn'}).getByText('Bản dịch: '+direction,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).translationLanguages)).toEqual(['en']);
  source.transcript=Array.from({length:20},(_,i)=>`${i}：`+'学生发现了一封神秘的信。'.repeat(110)).join('\n');
  // Changing source language resets the view; the next click starts the correct language pack.
  await expect(page.getByRole('button',{name:'Bản gốc',exact:true})).toHaveAttribute('aria-pressed','true',{timeout:10000});
  await vi(page);
  const preview=page.getByRole('region',{name:'Bản dịch tư liệu nguồn'});
  await expect(preview.locator('[data-view-translated]').first()).toBeVisible();
  const firstCalls=await page.evaluate(()=>(window as any).translationCalls.filter((t:string)=>t.includes('学生发现')).length);
  expect(firstCalls).toBeGreaterThan(0);expect(firstCalls).toBeLessThan(20);
  await preview.locator('.view-text').last().scrollIntoViewIfNeeded();
  await expect(preview.locator('.view-text').last()).toHaveAttribute('lang','vi');
});

test('unavailable source translator leaves originals and analysis usable',async({page})=>{
  const {mutations}=await sourcePage(page,'missing');await vi(page);
  await expect(page.getByRole('status')).toContainText('Trình duyệt chưa hỗ trợ');
  await expect(page.locator('.readable-value').filter({hasText:chineseSource.transcript})).toContainText(chineseSource.transcript);
  await page.getByRole('button',{name:'Phân tích DNA truyện',exact:true}).click();
  await expect.poll(()=>mutations.at(-1)?.body).toEqual({kind:'story_dna',source_id:'source'});
});

test('Comet translates a Chinese source into real Vietnamese without changing source data',async({page})=>{
  test.setTimeout(150000);
  const {mutations}=await sourcePage(page,'native');
  test.skip(!await page.evaluate(()=>'Translator' in window),'This browser has no native Translator API');
  await vi(page);
  const preview=page.getByRole('region',{name:'Bản dịch tư liệu nguồn'});
  const transcript=preview.locator('.source-translation-field').nth(1).locator('.view-text');
  await expect(transcript).toHaveAttribute('lang','vi',{timeout:125000});
  expect(await transcript.textContent()).toMatch(/[àáạảãâăèéêìíòóôơùúưỳýđ]/i);
  await expect(preview.locator('[data-view-translated]')).toHaveCount(5,{timeout:30000});
  expect(mutations).toEqual([]);
  await page.screenshot({path:'../.runtime/view-translation/vietnamese-source.png',fullPage:true});
});
