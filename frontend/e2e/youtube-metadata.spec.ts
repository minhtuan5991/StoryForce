import {test,expect} from '@playwright/test';

const titles=['Room 614 Appeared on the Blueprint','The Hotel Blueprint Grew a New Room','I Printed Plans for a Room That Did Not Exist'];
const content={title:titles[0],recommended_title:titles[0],description:'At a print shop, a room appears on a hotel blueprint. This is a fictional mystery.',
  tags:['hotel mystery','impossible room','blueprint','fiction narration'],hashtags:['#HotelMystery','#FictionNarration'],
  title_variants:titles.map((title,i)=>({id:'ABC'[i],strategy:['concrete_anomaly','search_context','first_person_curiosity'][i],title,
    evidence_quote:'Room 614 appeared on the blueprint.',scores:{clarity:90,curiosity:88,specificity:90,story_accuracy:94,suggested_fit:85,search_fit:70,channel_fit:90,thumbnail_complement:null,genericness_risk:5,keyword_stuffing_risk:0}})),
  primary_keyword_cluster:{primary:'hotel mystery story',secondary:['impossible room','strange blueprint'],evidence_type:'story_semantic'},
  thumbnail_title_overlap_risk:null,metadata_notes:{title_reason:'Concrete premise.',suffix_decision:'No suffix necessary.',search_vs_suggested_strategy:'Packaging first.',accuracy_notes:[]},review_notes:[]};

test('metadata strategies apply the chosen title without changing other publishing settings',async({page})=>{
  const project:any={id:'p',title:'Room project',channel_id:'c',channel:{name:'The Midnight Log',color:'blue',settings:{}},
    target_minutes:5,wpm:150,story_version:1,locked:true,stage:'LOCKED',draft:'Room 614 appeared on the blueprint.',word_count:7,
    profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},versions:[],jobs:[],issues:[],assets:[],chunks:[],scenes:[],premises:[],settings:{},workflow_settings:{},
    publish:{title:'Saved title',description:'Saved description',url:'https://youtube.com/watch?v=kept',analytics_reminders:false},youtube_metadata_current:true,
    artifacts:{youtube_metadata:{id:'a',provider:'chatgpt',story_version:1,created_at:'2026-10-07T10:00:00Z',content}}};
  const saves:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test',version:'3.1.25'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/projects/p'){
      if(route.request().method()==='PATCH'){saves.push(route.request().postDataJSON());project.publish=saves.at(-1).publish}
      result=project;
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/publish');
  await expect(page.getByText('Chiến lược thử nghiệm tiêu đề',{exact:true})).toBeVisible();
  await expect(page.getByText('Chưa có chữ thực tế trên thumbnail',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Chọn tiêu đề B',exact:true}).click();
  await page.getByRole('button',{name:'Dùng cho biểu mẫu xuất bản',exact:true}).click();
  expect(saves.length).toBe(0);
  await page.getByRole('dialog').getByRole('button',{name:'Áp dụng',exact:true}).click();
  await expect(page.getByLabel('Tiêu đề YouTube',{exact:true})).toHaveValue(titles[1]);
  await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
  await expect.poll(()=>saves.length).toBe(1);
  expect(saves[0].publish.url).toBe('https://youtube.com/watch?v=kept');
  expect(saves[0].publish.analytics_reminders).toBe(false);
  await page.screenshot({path:'../.runtime/metadata-ui/strategies-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'../.runtime/metadata-ui/strategies-mobile.png',fullPage:true});
});

test('optional inputs save known values and keep unknown percentages blank on mobile',async({page})=>{
  const project:any={id:'p',title:'Room project',channel_id:'c',channel:{name:'The Midnight Log',color:'blue',settings:{}},target_minutes:5,wpm:150,
    story_version:1,locked:true,stage:'LOCKED',draft:'Room 614 appeared on the blueprint.',word_count:7,profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},
    versions:[],jobs:[],issues:[],assets:[],chunks:[],scenes:[],premises:[],settings:{},workflow_settings:{},publish:{},artifacts:{}};
  const saves:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/projects/p')result=project;
    if(path.endsWith('/metadata-settings')){const body=route.request().postDataJSON();saves.push(body);result=body;project.channel.settings.youtube_metadata=body.channel_preferences;project.settings.youtube_metadata={thumbnail_text:body.thumbnail_text}}
    await route.fulfill({json:result});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/projects/p/publish');
  await page.getByText('Dữ liệu cho chiến lược metadata (không bắt buộc)',{exact:true}).click();
  await expect(page.getByLabel('Truy cập từ Duyệt xem (%)',{exact:true})).toHaveValue('');
  await page.getByLabel('Truy cập từ Đề xuất (%)',{exact:true}).fill('76');
  await page.getByLabel('Chữ thực tế trên thumbnail',{exact:true}).fill('ROOM 614');
  await expect(page.getByRole('button',{name:'Tạo bằng ChatGPT',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Lưu dữ liệu metadata',exact:true}).click();
  await expect.poll(()=>saves.length).toBe(1);
  expect(saves[0].channel_preferences.traffic_profile).toEqual({suggested_percent:76,browse_percent:null,search_percent:null});
  await expect(page.getByRole('button',{name:'Tạo bằng ChatGPT',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'../.runtime/metadata-ui/inputs-mobile.png',fullPage:true});
});
