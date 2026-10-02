import {test,expect} from '@playwright/test';

test('Vietnamese media controls confirm visuals before creation and start narration immediately',async({page})=>{
  const project={id:'p',title:'Resource QA',channel_id:'c',channel:{name:'Channel',color:'blue'},target_minutes:5,wpm:150,
    story_version:1,locked:true,stage:'LOCKED',jobs:[],issues:[],publish:{},settings:{},workflow_settings:{},
    draft:'A complete story.',word_count:3,profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},versions:[],
    chunks:[{id:'c1',number:1,status:'PENDING',text:'A complete narration.',reasons:[],voice_profile:{},word_count:3,estimated_duration:2}],
    scenes:[{id:'s1',number:1,scene_key:'scene_001',visual_type:'IMAGE',status:'PENDING',prompt:'A clear scene.',continuity:{},negative_prompt:''}],
    assets:[],premises:[],artifacts:{}};
  const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects/p')result=project;
    if(path==='/api/projects/p/media-automation/preview')result={confirmation:'current',image_count:1,video_count:0,
      download_path:'C:\\Users\\Admin\\Downloads\\Resource QA',folder:'Resource QA'};
    if(path==='/api/projects/p/media-automation/start'){requests.push(route.request().postDataJSON());result={phase:'running'}};
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/visuals');
  await page.getByRole('button',{name:'Xác nhận số lượng ảnh/video',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('1 ảnh');
  await expect(dialog).toContainText('0 video');
  await expect(dialog).toContainText('Omni 1.1 Flash');
  expect(requests).toEqual([]);
  await page.screenshot({path:'../.runtime/media-ui/count-confirmation.png',fullPage:true});
  await dialog.getByRole('button',{name:'Hủy',exact:true}).click();
  expect(requests).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Xác nhận số lượng ảnh/video',exact:true}).click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await dialog.getByRole('button',{name:'Xác nhận số lượng và tạo tài nguyên',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(1);
  expect(requests[0]).toEqual({kind:'visuals',regenerate:false,confirmation:'current',image_count:1,video_count:0});
  await page.goto('/#/projects/p/tts');
  await page.getByRole('button',{name:'Tạo và tải giọng đọc',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(2);
  expect(requests[1]).toEqual({kind:'tts',regenerate:false});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:'../.runtime/media-ui/audio-mobile.png',fullPage:true});
});
