import {test,expect} from '@playwright/test';
test('Scene copy controls, closing segment and thumbnail creation are available in Vietnamese',async({page})=>{
  let thumbnail=false;
  const p:any={id:'p',title:'One Knock After Sundown',channel_id:'c',channel:{name:'Channel',color:'blue'},target_minutes:5,wpm:150,story_version:2,stage:'PRODUCTION',locked:true,
    jobs:[],issues:[],publish:{},artifacts:{},scenes:[],thumbnail_prompt:'Large title, one subject',
    assets:[{id:'image1',kind:'image',name:'scene_003.jpg',metadata_json:{}}],
    chunks:[{id:'chunk1',number:1,text:'Narration',word_count:10,reasons:[],voice_profile:{voice_name:'Kore'},scene_context:'One narrator on a frozen ship.',status:'ATTACHED',estimated_duration:10}]};
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());let result:any={items:[],total:0};
    if(url.pathname==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(url.pathname==='/api/session')result={token:'test'};
    if(url.pathname==='/api/projects/p')result=p;
    if(url.pathname==='/api/projects/p/thumbnail'){
      expect(route.request().postDataJSON()).toEqual({asset_id:'image1'});thumbnail=true;
      p.assets.push({id:'thumbnail',kind:'image',name:'thumbnail.jpg',metadata_json:{role:'thumbnail',title:p.title}});p.publish.thumbnail_asset_id='thumbnail';result={id:'thumbnail'};
    }
    if(url.pathname.includes('/assets/')){await route.fulfill({status:204});return}
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/tts');
  await expect(page.getByRole('button',{name:'Scene · AI Studio',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Thêm lời kết'})).toBeEnabled();
  await page.getByText('Xem lời kể & ngữ cảnh giọng đọc').click();
  await expect(page.getByText('One narrator on a frozen ship.')).toBeVisible();
  await page.screenshot({path:'../.runtime/production-extras/tts-ui.png',fullPage:true});
  await page.goto('/#/projects/p/visuals');
  await page.getByLabel('Ảnh làm thumbnail').selectOption('image1');
  await page.getByRole('button',{name:'Tạo thumbnail',exact:true}).click();
  await expect(page.getByRole('link',{name:'Tải thumbnail'})).toBeVisible();expect(thumbnail).toBe(true);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
