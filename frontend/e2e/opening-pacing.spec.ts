import {test,expect} from '@playwright/test';

test('opening plan explains native clips and separate cast reference before any approved generation',async({page})=>{
  const project:any={id:'p',title:'Opening pacing QA',channel_id:'c',channel:{name:'Mystery',color:'blue'},
    target_minutes:20,wpm:150,story_version:1,locked:true,stage:'LOCKED',draft:'A locked narration.',word_count:3,
    jobs:[],issues:[],publish:{},settings:{},workflow_settings:{},assets:[],chunks:[],scenes:[],premises:[],versions:[],
    profile:{word_range:[2760,3240]},lock_gate:{can_lock:true,reasons:[]},artifacts:{},
    visual_budget:{mode:'standard',image_count:21,video_count:3,opening_video_count:3,
      standard:{image_count:21,video_count:3},minimum:{image_count:11,video_count:2}}};
  const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test',version:'3.1.27'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/projects/p')result=project;
    if(request.method()!=='GET'){
      const body=request.postDataJSON();requests.push({path,body});result=body;
      if(path.endsWith('/visual-options')){project.settings.visual_options=body;result=project.visual_budget}
      if(path==='/api/jobs')result={id:'visual-job',kind:'visual_director',status:'waiting_user'};
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/visuals');
  await expect(page.getByText('Kế hoạch mới bắt đầu ngay 0:00',{exact:false})).toBeVisible();
  await expect(page.getByRole('spinbutton',{name:'Số lượng video'})).toHaveValue('3');
  await page.getByRole('button',{name:'Tạo kế hoạch hình ảnh',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('3 video');
  await expect(dialog).toContainText('Ảnh được lưu riêng, không tính vào timeline hay số lượng scene');
  expect(requests).toEqual([]);
  await page.screenshot({path:'../.runtime/opening-ui/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'../.runtime/opening-ui/mobile.png',fullPage:true});
  await dialog.getByRole('button',{name:'Xác nhận số lượng và tạo tài nguyên',exact:true}).click();
  await expect.poll(()=>requests.filter(r=>r.path==='/api/jobs').length).toBe(1);
  const created=requests.find(r=>r.path==='/api/jobs');
  expect(created.body).toMatchObject({kind:'visual_director',payload:{automatic_resources:true,
    confirmed_image_count:21,confirmed_video_count:3}});
});
