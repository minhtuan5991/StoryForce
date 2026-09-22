import {test,expect} from '@playwright/test';
test('missing WAV is named and a rebuilt video reloads even in the same story version',async({page})=>{
  let renderRequests=0;
  const validation={valid:false,narration:[3,4],visuals:[8,8],missing:['tts_004.wav'],warnings:[]};
  const p:any={id:'p',title:'One Knock After Sundown',channel_id:'c',channel:{name:'Channel',color:'blue'},target_minutes:5,wpm:150,story_version:2,locked:true,
    jobs:[],issues:[],publish:{},chunks:[],scenes:[],artifacts:{render_report:{id:'old',story_version:0,content:{file:'old.mp4',story_version:2,checks:{},warnings:[],status:'READY'}}}};
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects/p')result=p;
    if(path==='/api/projects/p/validate')result=validation;
    if(path==='/api/projects/p/pipeline')result={checkpoint:'Attach the missing resources to continue.',validation};
    if(path==='/api/jobs'&&route.request().method()==='POST'){
      expect(route.request().postDataJSON().kind).toBe('render');renderRequests++;
      p.artifacts.render_report={...p.artifacts.render_report,id:'new',story_version:2};result={id:'job'};
    }
    if(path.includes('/download/')){await route.fulfill({status:204});return}
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/render');
  await expect(page.getByText('tts_004.wav',{exact:true})).toBeVisible();
  await expect(page.locator('video')).toHaveAttribute('src',/revision=old$/);
  await page.getByRole('button',{name:'Tiếp tục quy trình'}).click();
  await expect(page.getByRole('dialog').getByText('tts_004.wav',{exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Đóng',exact:true}).click();
  await page.getByRole('button',{name:'Dựng lại video',exact:true}).click();
  await expect(page.locator('video')).toHaveAttribute('src',/revision=new$/);
  expect(renderRequests).toBe(1);
});
