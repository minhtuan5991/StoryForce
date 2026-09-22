import { test, expect } from '@playwright/test';

test('source deletion previews, cancels and removes selected sources from both pages', async({page,request})=>{
  const headers={'X-StoryForge-Token':(await (await request.get('/api/session')).json()).token};
  const settings=await (await request.get('/api/settings')).json();
  const names=['Delete preview A','Delete preview B'];
  for(const title of names)expect((await request.post('/api/sources',{headers,data:{title}})).ok()).toBeTruthy();
  await page.goto('/#/inbox');
  await page.getByRole('button',{name:'Delete '+names[0],exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Some sources have not finished analysis.')).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('link',{name:names[0],exact:true})).toBeVisible();
  await page.goto('/#/library');
  for(const title of names)await page.getByRole('checkbox',{name:'Select '+title,exact:true}).check();
  await page.getByRole('button',{name:'Delete selected items',exact:true}).click();
  for(const title of names)await expect(dialog.getByText(title,{exact:true})).toBeVisible();
  await page.screenshot({path:'../.runtime/delete-update-baseline/source-confirmation.png'});
  await dialog.getByRole('button',{name:'Confirm deletion',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  for(const title of names)await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);
  await page.goto('/#/inbox');
  for(const title of names)await expect(page.getByRole('link',{name:title,exact:true})).toHaveCount(0);
  expect(await (await request.get('/api/settings')).json()).toEqual(settings);
});

test('Vietnamese popup blocks a source used by an active job and deletes cancelled history only', async({page,request})=>{
  const headers={'X-StoryForge-Token':(await (await request.get('/api/session')).json()).token};
  const source=await (await request.post('/api/sources',{headers,data:{title:'Nguồn đang phân tích',summary:'An original story about an isolated station.'}})).json();
  const before=await (await request.get('/api/settings')).json();
  await request.patch('/api/settings',{headers,data:{provider_mode:'browser'}});
  try{
    const job=await (await request.post('/api/jobs',{headers,data:{kind:'story_dna',source_id:source.id}})).json();
    await expect.poll(async()=> (await (await request.get('/api/jobs')).json()).items.find((j:any)=>j.id===job.id)?.status).toBe('waiting_user');
    await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
    await page.goto('/#/inbox');
    await page.getByRole('button',{name:'Xóa '+source.title,exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByText('Chưa thể xóa khi công việc liên quan đang hoạt động.')).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Xác nhận xóa',exact:true})).toBeDisabled();
    await page.screenshot({path:'../.runtime/delete-update-baseline/active-warning-vi.png'});
    await page.setViewportSize({width:390,height:844});
    await expect(dialog).toBeInViewport();
    await expect(dialog.getByRole('button',{name:'Hủy',exact:true})).toBeInViewport();
    await dialog.getByRole('button',{name:'Hủy',exact:true}).click();
    await request.post('/api/jobs/'+job.id+'/cancel',{headers});
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('/#/jobs');
    const row=page.locator('.job-row').filter({has:page.getByRole('button',{name:'Xóa DNA truyện',exact:true})}).first();
    await row.getByRole('button',{name:'Xóa DNA truyện',exact:true}).click();
    await expect(dialog.getByText('Một số tác vụ chưa hoàn thành. Khi xóa lịch sử, bạn sẽ không thể thử lại các tác vụ đó.')).toBeVisible();
    await dialog.getByRole('button',{name:'Xác nhận xóa',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    expect((await (await request.get('/api/jobs')).json()).items.some((j:any)=>j.id===job.id)).toBe(false);
    expect((await request.get('/api/sources/'+source.id)).ok()).toBeTruthy();
  }finally{await request.patch('/api/settings',{headers,data:{provider_mode:before.provider_mode}})}
});

test('novelty deletion removes memory while retaining the locked story',async({page,request})=>{
  const headers={'X-StoryForge-Token':(await (await request.get('/api/session')).json()).token};
  const channel=await (await request.post('/api/channels',{headers,data:{name:'Deletion retention test',status:'ESTABLISHED'}})).json();
  const project=await (await request.post('/api/projects',{headers,data:{channel_id:channel.id,title:'Keep this locked story',duration_mode:'5',target_minutes:5}})).json();
  const run=async(kind:string)=>{
    const response=await request.post('/api/jobs',{headers,data:{kind,project_id:project.id}});expect(response.ok()).toBeTruthy();
    const job=await response.json();
    await expect.poll(async()=> (await (await request.get('/api/jobs?limit=100')).json()).items.find((j:any)=>j.id===job.id)?.status).toBe('completed');
  };
  for(const kind of ['content_direction','premise_generation','premise_mini_test'])await run(kind);
  const detail=await (await request.get('/api/projects/'+project.id)).json();
  await request.post('/api/projects/'+project.id+'/select-premise',{headers,data:{premise_id:detail.premises[0].id}});
  for(const kind of ['story_bible','outline','outline_audit','outline_rewrite','full_draft','gemini_story_audit','chatgpt_cross_review','targeted_rewrite','final_verify_gemini','final_verify_chatgpt'])await run(kind);
  expect((await request.post('/api/projects/'+project.id+'/lock',{headers})).ok()).toBeTruthy();
  const before=await (await request.get('/api/projects/'+project.id)).json();
  const memory=(await (await request.get('/api/novelty')).json()).items.find((n:any)=>n.project_id===project.id);
  await page.goto('/#/novelty');
  await page.getByRole('button',{name:'Delete '+memory.title,exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('These stories will no longer be used by the duplicate guard. The projects and their content will remain.')).toBeVisible();
  await dialog.getByRole('button',{name:'Confirm deletion',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Delete '+memory.title,exact:true})).toHaveCount(0);
  expect(await (await request.get('/api/projects/'+project.id)).json()).toEqual(before);
});
