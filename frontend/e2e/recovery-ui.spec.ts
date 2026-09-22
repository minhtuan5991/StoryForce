import {test,expect} from '@playwright/test';

test('Jobs returns to project overview and warning approval requires explicit confirmation',async({page})=>{
  const project:any={id:'review-project',title:'One Knock After Sundown',channel_id:'channel',channel:{name:'The Next Chapter'},
    target_minutes:5,wpm:150,story_version:2,stage:'VERIFY',locked:false,draft:'Current story',word_count:810,
    profile:{word_range:[690,810],target_words:750,characters:[1,3],scenes:[6,10],retention_map:[]},
    duration_mode:'5',auto_duration:{range:[5,10]},next:{checkpoint:'Review and approve Story Lock.'},
    jobs:[],issues:[],versions:[],artifacts:{final_verify_gemini:{content:{passed:false,high:1,summary:'Gemini reports a pacing issue.'}}},
    lock_gate:{can_lock:false,reasons:['final_verify_gemini: quality gate failed'],approval_token:'reviewed-version'}};
  let approvals=0;
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let result:any={items:[],total:0};
    if(pathname==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(pathname==='/api/projects/review-project')result=project;
    if(pathname==='/api/projects/review-project/lock'){
      expect(route.request().postDataJSON()).toEqual({confirm_warnings:true,approval_token:'reviewed-version'});
      approvals++;project.locked=true;result={locked:true};
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/jobs/review-project');
  const back=page.getByRole('link',{name:'Về Tổng quan'});
  await expect(back).toHaveAttribute('href','#/projects/review-project/overview');
  await page.screenshot({path:'../.runtime/recovery-update/jobs-desktop.png',fullPage:true});
  await back.click();await expect(page.getByRole('heading',{name:'Tổng quan câu chuyện'})).toBeVisible();
  await page.goto('/#/projects/review-project/versions');
  await page.getByRole('button',{name:'Duyệt khóa truyện',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();expect(approvals).toBe(0);
  await expect(page.getByRole('dialog')).toContainText('Chưa đạt kiểm định chất lượng');
  await page.screenshot({path:'../.runtime/recovery-update/lock-warning.png',fullPage:true});
  await page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click();expect(approvals).toBe(0);
  await page.getByRole('button',{name:'Duyệt khóa truyện',exact:true}).click();
  await page.getByRole('button',{name:'Xác nhận khóa truyện dù còn cảnh báo',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);expect(approvals).toBe(1);
  await page.setViewportSize({width:390,height:844});await page.goto('/#/jobs/review-project');
  await expect(back).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
