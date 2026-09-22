import { test, expect } from '@playwright/test';

test('Vietnamese switch persists without writing settings, projects or prompts',async({page,request})=>{
  const settings=await (await request.get('/api/settings')).json();
  const prompts=await (await request.get('/api/prompts')).json();
  const projects=await (await request.get('/api/projects')).json();
  const mutations:string[]=[];
  page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD'].includes(r.method()))mutations.push(r.url())});
  await page.goto('/#/settings');
  await page.getByLabel('Interface language',{exact:true}).last().selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang','vi');
  await expect(page.getByRole('heading',{name:'Thiết lập',exact:true})).toBeVisible();
  await expect(page.getByLabel('Chế độ quy trình')).toHaveValue(settings.pipeline_mode);
  await page.getByLabel('Tốc độ kể mặc định (từ/phút)').fill('177');
  await page.getByLabel('Ngôn ngữ giao diện',{exact:true}).last().selectOption('en');
  await expect(page.getByLabel('Default narration WPM')).toHaveValue('177');
  await expect(page.getByLabel('Workflow mode')).toHaveValue(settings.pipeline_mode);
  await page.getByLabel('Interface language',{exact:true}).last().selectOption('vi');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Thiết lập',exact:true})).toBeVisible();
  await expect(page.getByLabel('Tốc độ kể mặc định (từ/phút)')).toHaveValue(String(settings.default_wpm));
  await expect(page.getByLabel('Tên giọng kể')).toHaveCount(0);
  const routes=[['channels','Mỗi kênh. Một thế giới riêng.'],['projects','Truyện đang hình thành'],['inbox','Hộp thư nội dung'],['calendar','Lịch nội dung'],['analytics','Rút kinh nghiệm từ mỗi câu chuyện'],['novelty','Bộ nhớ ý tưởng'],['jobs','Hoạt động & tác vụ'],['logs','Nhật ký & chẩn đoán']];
  for(const [route,title] of routes){
    await page.goto('/#/'+route);
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  }
  expect(mutations).toEqual([]);
  expect(await (await request.get('/api/settings')).json()).toEqual(settings);
  expect(await (await request.get('/api/prompts')).json()).toEqual(prompts);
  expect(await (await request.get('/api/projects')).json()).toEqual(projects);
  await page.goto('/#/channels');
  await page.screenshot({path:'../.runtime/vietnamese-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.getByRole('button',{name:'Mở/đóng điều hướng'}).click();
  await expect(page.locator('.sidebar').getByLabel('Ngôn ngữ giao diện')).toBeVisible();
  await page.getByRole('button',{name:'Đóng điều hướng',exact:true}).click();
  await page.screenshot({path:'../.runtime/vietnamese-mobile.png',fullPage:true,animations:'disabled'});
});

test('Vietnamese forms retain original channel text and API enum values',async({page,request})=>{
  const token=(await (await request.get('/api/session')).json()).token;
  const headers={'X-StoryForge-Token':token};
  const channel=await (await request.post('/api/channels',{headers,data:{name:'Settings',status:'ESTABLISHED',niche:'Original English mystery',language:'English (US)'}})).json();
  const project=await (await request.post('/api/projects',{headers,data:{channel_id:channel.id,title:'Overview',duration_mode:'Custom',target_minutes:7}})).json();
  await page.goto('/#/projects/'+project.id);
  await page.getByLabel('Interface language',{exact:true}).selectOption('vi');
  await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
  await expect(page.locator('.back-link')).toHaveText('Settings');
  await expect(page.getByRole('combobox',{name:'Chế độ',exact:true})).toHaveValue('Custom');
  await expect(page.getByRole('option',{name:'Tùy chỉnh',exact:true})).toHaveAttribute('value','Custom');
  await page.getByRole('combobox',{name:'Chế độ',exact:true}).selectOption('Auto');
  await page.getByRole('button',{name:'Lưu',exact:true}).click();
  await expect.poll(async()=> (await (await request.get('/api/projects/'+project.id)).json()).duration_mode).toBe('Auto');
  await page.getByLabel('Ngôn ngữ giao diện').selectOption('en');
  await expect(page.getByRole('combobox',{name:'Mode',exact:true})).toHaveValue('Auto');
  const saved=await (await request.get('/api/channels/'+channel.id)).json();
  expect(saved.name).toBe('Settings');expect(saved.language).toBe('English (US)');
  expect(saved.niche).toBe('Original English mystery');
  await page.getByLabel('Interface language').selectOption('vi');
  await page.goto('/#/calendar');
  await page.getByRole('button',{name:'Lên kế hoạch video',exact:true}).click();
  await expect(page.getByRole('option',{name:'Cốt lõi',exact:true})).toHaveAttribute('value','Core');
  await page.getByLabel('Cơ cấu nội dung').selectOption('Experimental');
  await expect(page.getByLabel('Cơ cấu nội dung')).toHaveValue('Experimental');
  await page.getByRole('button',{name:'Hủy',exact:true}).click();
});
