import {test,expect} from '@playwright/test';

test('Publish exports a native CapCut project with progress and keeps both archives',async({page})=>{
  const folder='D:\\CapCut Drafts', resultFolder=folder+'\\StoryForge - QA';
  const project={id:'p',title:'CapCut QA',channel_id:'c',channel:{name:'Channel'},target_minutes:5,wpm:150,
    story_version:1,locked:true,stage:'LOCKED',jobs:[],issues:[],publish:{},workflow_settings:{},
    draft:'A complete story.',word_count:3,profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},
    versions:[],chunks:[],scenes:[],assets:[],premises:[],artifacts:{}};
  let polls=0;const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects/p')result=project;
    if(path==='/api/capcut')result={drafts_folder:folder};
    if(path==='/api/projects/p/export-capcut'){
      requests.push(route.request().postDataJSON());result={id:'j',status:'queued',progress:0};
    }
    if(path==='/api/jobs/j')result=++polls<3?{id:'j',status:'running',progress:35,step:'Copying scene media'}:
      {id:'j',status:'completed',progress:100,result:{folder:resultFolder}};
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/publish');
  await page.waitForTimeout(2200); // Comet's initial-profile reload.
  const card=page.locator('.capcut-export-card');
  await expect(card).toContainText('Xuất project CapCut');
  await expect(page.getByText('Gói chuyển sang CapCut',{exact:true})).toHaveCount(0);
  await expect(page.locator('.export-options a')).toHaveCount(2);
  await card.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('textbox',{name:'Thư mục dự án CapCut'})).toHaveValue(folder);
  await page.screenshot({path:'../.runtime/capcut-ui/export-dialog.png',fullPage:true});
  await dialog.getByRole('button',{name:'Xuất project CapCut',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Đang xuất project CapCut…'})).toBeDisabled();
  await expect(dialog).toContainText('Sao chép tài nguyên scene');
  await expect(dialog).toContainText('Project CapCut đã sẵn sàng',{timeout:12000});
  await expect(dialog).toContainText(resultFolder);
  expect(requests).toEqual([{drafts_folder:folder}]);
  await page.screenshot({path:'../.runtime/capcut-ui/export-ready.png',fullPage:true});
});
