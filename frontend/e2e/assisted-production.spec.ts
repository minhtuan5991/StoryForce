import {test,expect} from '@playwright/test';

for(const thumbnails of [['A','B','C'],[]])test(`assisted rendering stays manual with a stale plan and ${thumbnails.length} publishing thumbnails`,async({page})=>{
  const review={required:false,ready:true,can_render:true,manual_render_required:true,active:false,fingerprint:'resources-v1',narration:[2,2],visuals:[5,5],thumbnails,missing:[],
    thumbnail_missing:thumbnails.length?[]:['thumbnail_A.png','thumbnail_B.png','thumbnail_C.png'],
    warnings:thumbnails.length?[]:['Some thumbnails are missing for publishing. This does not block rendering; the selected ending image must be available.']};
  const p={id:'p',title:'Assisted resources',channel_id:'c',channel:{name:'Mystery',color:'blue'},target_minutes:5,wpm:150,
    locked:true,story_version:1,stage:'LOCKED',settings:{production_options:{preset_counts:true,image_count:3,video_count:2,music_enabled:false}},
    workflow_settings:{pipeline_mode:'assisted'},resource_review:review,jobs:[],issues:[],publish:{},draft:'The door opened.',
    word_count:3,profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},versions:[],
    chunks:[],scenes:[],assets:[],premises:[],artifacts:{},next:{action_kind:'render',checkpoint:'Resources are ready. Open Render & QA and click Render first cut.'},
    thumbnail_packaging:{current:false},missing_resources:[]};
  const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test',version:'3.1.38'};
    if(path==='/api/projects/p')result=p;
    if(path==='/api/projects/p/validate')result={valid:true,narration:[2,2],visuals:[5,5],warnings:[],missing:[]};
    if(route.request().method()==='POST')requests.push({path,body:route.request().postDataJSON()});
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/assets');
  await expect(page.getByText('Tài nguyên sẵn sàng để dựng thủ công',{exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Tôi đã kiểm tra tài nguyên và xác nhận sử dụng để dựng video.',exact:true})).toHaveCount(0);
  const open=page.getByRole('link',{name:'Mở Dựng & kiểm tra',exact:true});
  await expect(open).toBeVisible();
  await page.screenshot({path:'../.runtime/assisted-ready-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(open).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'../.runtime/assisted-ready-mobile.png',fullPage:true});
  await open.click();
  await expect(page).toHaveURL(/\/render$/);
  const render=page.getByRole('button',{name:'Dựng bản đầu tiên',exact:true});
  await expect(render).toBeEnabled();
  expect(requests).toEqual([]);
  await render.click();
  await expect.poll(()=>requests.length).toBe(1);
  expect(requests[0]).toMatchObject({path:'/api/jobs',body:{kind:'render',project_id:'p'}});
});
