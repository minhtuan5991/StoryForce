import {test,expect} from '@playwright/test';

test('select all projects is page scoped, cancel preserves them and bulk delete keeps the next page',async({page,request})=>{
  const headers={'X-StoryForge-Token':(await (await request.get('/api/session')).json()).token};
  const settings=await (await request.get('/api/settings')).json();
  const channel=await (await request.post('/api/channels',{headers,data:{name:'Bulk page test'}})).json();
  for(let i=0;i<51;i++)expect((await request.post('/api/projects',{headers,data:{channel_id:channel.id,title:'Page scope '+i}})).ok()).toBeTruthy();
  await page.goto('/#/projects');
  const checks=page.locator('tbody input[type="checkbox"]');
  await expect(checks).toHaveCount(50);
  await expect(page.getByRole('button',{name:'Delete selected items',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Select all',exact:true}).click();
  await expect(page.locator('tbody input:checked')).toHaveCount(50);
  await checks.first().uncheck();
  await expect(page.locator('tbody input:checked')).toHaveCount(49);
  await page.getByRole('button',{name:'Select all',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(checks).toHaveCount(1);
  await expect(page.locator('tbody input:checked')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Delete selected items',exact:true})).toBeDisabled();
  const kept=await page.locator('tbody .table-title').getAttribute('href');
  await page.getByRole('button',{name:'Previous',exact:true}).click();
  await expect(checks).toHaveCount(50);
  await page.getByRole('button',{name:'Select all',exact:true}).click();
  await page.getByRole('button',{name:'Delete selected items',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Deleting projects removes their stories, versions, analyses, job history, asset records and novelty memory. Channels and sources will remain.')).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await (await request.get('/api/projects')).json()).total).toBe(51);
  await page.screenshot({path:'../.runtime/bulk-update-baseline/projects-selection.png',fullPage:true});
  await page.getByRole('button',{name:'Delete selected items',exact:true}).click();
  await dialog.getByRole('button',{name:'Confirm deletion',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(checks).toHaveCount(1);
  await expect(page.locator('tbody .table-title')).toHaveAttribute('href',kept!);
  expect((await request.get('/api/channels/'+channel.id)).ok()).toBeTruthy();
  expect(await (await request.get('/api/settings')).json()).toEqual(settings);
});

test('bulk jobs warn about active work and delete only history after cancellation',async({page,request})=>{
  const headers={'X-StoryForge-Token':(await (await request.get('/api/session')).json()).token};
  const before=await (await request.get('/api/settings')).json();
  const source=await (await request.post('/api/sources',{headers,data:{title:'Bulk jobs source',summary:'An original mystery at a radio station.'}})).json();
  for(let i=0;i<2;i++){
    const job=await (await request.post('/api/jobs',{headers,data:{kind:'story_dna',source_id:source.id}})).json();
    await expect.poll(async()=> (await (await request.get('/api/jobs')).json()).items.find((j:any)=>j.id===job.id)?.status).toBe('completed');
  }
  await request.patch('/api/settings',{headers,data:{provider_mode:'browser'}});
  try{
    const active=await (await request.post('/api/jobs',{headers,data:{kind:'story_dna',source_id:source.id}})).json();
    await expect.poll(async()=> (await (await request.get('/api/jobs')).json()).items.find((j:any)=>j.id===active.id)?.status).toBe('waiting_user');
    await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
    await page.goto('/#/jobs');
    await page.getByRole('button',{name:'Chọn tất cả',exact:true}).click();
    await expect(page.locator('.job-select:checked')).toHaveCount(3);
    await page.getByRole('button',{name:'Bỏ chọn tất cả',exact:true}).click();
    await expect(page.locator('.job-select:checked')).toHaveCount(0);
    await page.getByRole('button',{name:'Chọn tất cả',exact:true}).click();
    await page.getByRole('button',{name:'Xóa các mục đã chọn',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('button',{name:'Xác nhận xóa',exact:true})).toBeDisabled();
    await expect(dialog.getByText('Chưa thể xóa khi công việc liên quan đang hoạt động.')).toBeVisible();
    await dialog.getByRole('button',{name:'Hủy',exact:true}).click();
    await page.screenshot({path:'../.runtime/bulk-update-baseline/jobs-selection.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
    await expect(page.getByRole('button',{name:'Xóa các mục đã chọn',exact:true})).toBeVisible();
    await request.post('/api/jobs/'+active.id+'/cancel',{headers});
    await page.getByRole('button',{name:'Xóa các mục đã chọn',exact:true}).click();
    await expect(dialog.getByRole('button',{name:'Xác nhận xóa',exact:true})).toBeEnabled();
    await dialog.getByRole('button',{name:'Xác nhận xóa',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.job-row')).toHaveCount(0);
    const remaining=await (await request.get('/api/sources/'+source.id)).json();
    expect(Object.keys(remaining.dna).length).toBeGreaterThan(0);
  }finally{await request.patch('/api/settings',{headers,data:{provider_mode:before.provider_mode}})}
});
