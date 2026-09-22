import {test,expect} from '@playwright/test';

test('manual TTS completion lists missing media, then opens timeline after successful verification',async({page})=>{
  let attempts=0;
  const job={id:'manual-tts',kind:'tts_context',project_id:'project',status:'waiting_user',provider:'aistudio',progress:20,created_at:'2026-09-20T15:00:00',step:'Waiting for browser or pasted result',logs:[]};
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());let result:any={items:[],total:0};
    if(url.pathname==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:1,sources:0};
    if(url.pathname==='/api/session')result={token:'test-session'};
    if(url.pathname==='/api/jobs')result={items:[job],total:1};
    if(url.pathname==='/api/jobs/manual-tts/complete-resources'){
      expect(route.request().method()).toBe('POST');attempts++;
      result=attempts===1?{completed:false,validation:{narration:[3,3],visuals:[7,8],missing:['scene_007.mp4']}}:{completed:true,project_id:'project',next_job_id:'sync'};
    }
    if(url.pathname==='/api/projects/project'){await route.abort();return}
    await route.fulfill({json:result});
  });
  await page.goto('/#/jobs/project');
  const complete=page.getByRole('button',{name:'Đã tải đủ tài nguyên',exact:true});
  await expect(complete).toBeVisible();
  await page.screenshot({path:'../.runtime/manual-tts-update/button-desktop.png',fullPage:true});
  await complete.click();await expect(page.getByRole('dialog')).toContainText('scene_007.mp4');
  await expect(page.getByRole('link',{name:'Mở Tài nguyên'})).toHaveAttribute('href','#/projects/project/assets');
  expect(page.url()).toContain('#/jobs/project');
  await page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await expect(complete).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await complete.click();await expect(page).toHaveURL(/#\/projects\/project\/timeline$/);expect(attempts).toBe(2);
});
