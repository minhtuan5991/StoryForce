import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';

function source(id:string,collection='inbox',extra:any={}) {
  return {id,title:'Source '+id,collection,status:'INBOX',dna:{},usage_count:0,platform:'Pasted text',tags:[],
    language:'English',transcript:'Original narration',summary:'Original summary',notes:'Keep notes',url:'',
    channel_id:'c',fits:[],created_at:'2026-10-01',raw_result:'',...extra};
}

async function workspace(page:Page,sources:any[],rejectMove=false) {
  const moves:any[]=[],jobs:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test',version:'3.1.41'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:sources.length,
      inbox_sources:sources.filter(s=>s.collection==='inbox').length,library_sources:sources.filter(s=>s.collection==='library').length};
    if(path==='/api/channels')result={items:[{id:'c',name:'Mystery channel'}],total:1};
    if(path==='/api/sources') {
      const collection=url.searchParams.get('collection'),q=(url.searchParams.get('q')||'').toLowerCase(),offset=Number(url.searchParams.get('offset')||0);
      const rows=sources.filter(s=>(!collection||s.collection===collection)&&s.title.toLowerCase().includes(q));
      result={items:rows.slice(offset,offset+50),total:rows.length};
    }
    if(path==='/api/sources/collection') {
      const body=request.postDataJSON();moves.push(body);
      if(rejectMove){await route.fulfill({status:404,json:{detail:'One or more sources no longer exist. Refresh the list and try again.'}});return}
      for(const s of sources)if(body.ids.includes(s.id))s.collection=body.collection;
      result={...body,count:body.ids.length};
    }
    if(path==='/api/sources/import') {
      const s=source('imported');s.title='Imported story';sources.push(s);
      result={items:[s],count:1};
    }
    if(path.startsWith('/api/sources/')&&!['/api/sources/import','/api/sources/collection'].includes(path))result=sources.find(s=>s.id===path.split('/').pop());
    if(path==='/api/jobs'&&request.method()==='POST') {
      const body=request.postDataJSON();jobs.push(body);
      const s=sources.find(s=>s.id===body.source_id);s.collection='library';s.dna={primary_genre:'Mystery'};
      result={id:'job-'+body.source_id,status:'completed'};
    }
    await route.fulfill({json:result});
  });
  return {moves,jobs};
}

test('separate lists, bulk approval and detail return preserve analysis and usage notes',async({page})=>{
  const sources=[source('new'),source('next'),source('analyzed','library',{dna:{primary_genre:'Mystery'},usage_count:2})];
  const {moves,jobs}=await workspace(page,sources);
  await page.goto('/#/inbox');
  await expect(page.getByRole('row').filter({hasText:'Source analyzed'})).toHaveCount(0);
  await expect(page.getByRole('row').filter({hasText:'Source new'}).locator('.source-usage')).toHaveText('Chưa được dùng');
  await page.getByLabel('Chọn tất cả nguồn').check();
  await page.getByRole('button',{name:'Duyệt vào thư viện (2)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hộp thư nội dung đã xử lý xong'})).toBeVisible();
  expect(jobs).toEqual([]);
  await page.goto('/#/library');
  const row=page.getByRole('row').filter({hasText:'Source analyzed'});
  await expect(row.locator('.source-usage')).toHaveText('Đã dùng trong 2 Hồ sơ');
  await expect(row.getByRole('link',{name:'Source analyzed',exact:true})).toHaveAttribute('href','#/library/analyzed');
  await page.screenshot({path:'../.runtime/source-collections-verify/library-desktop.png',fullPage:true});
  await row.getByRole('link',{name:'Source analyzed',exact:true}).click();
  await page.getByRole('button',{name:'Chuyển về hộp thư',exact:true}).click();
  await expect(page).toHaveURL(/\/inbox\/analyzed$/);
  await expect(page.getByRole('link',{name:'Hộp thư nội dung',exact:true}).last()).toHaveAttribute('href','#/inbox');
  await expect(page.locator('.source-collection-detail .source-usage')).toHaveText('Đã dùng trong 2 Hồ sơ');
  await page.getByRole('button',{name:'DNA truyện',exact:true}).click();
  await expect(page.getByText('Mystery',{exact:true})).toBeVisible();
  expect(sources[2].channel_id).toBe('c');expect(sources[2].notes).toBe('Keep notes');
  expect(moves).toEqual([{ids:['new','next'],collection:'library'},{ids:['analyzed'],collection:'inbox'}]);
});

test('new imports stay in inbox and successful analysis moves to library',async({page})=>{
  const sources=[source('ready','library',{dna:{primary_genre:'Mystery'}})];
  const {jobs}=await workspace(page,sources);
  await page.goto('/#/library');
  await page.locator('input[type=file]').setInputFiles({name:'story.txt',mimeType:'text/plain',buffer:Buffer.from('Original scene')});
  await expect(page.getByRole('status')).toContainText('Đã thêm nguồn mới vào Hộp thư nội dung');
  await expect(page.getByRole('row').filter({hasText:'Imported story'})).toHaveCount(0);
  await page.goto('/#/inbox');
  const imported=page.getByRole('row').filter({hasText:'Imported story'});
  await expect(imported).toBeVisible();
  await imported.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Phân tích 1',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Hộp thư nội dung đã xử lý xong'})).toBeVisible();
  await page.goto('/#/library');
  await expect(page.getByRole('row').filter({hasText:'Imported story'})).toBeVisible();
  expect(jobs).toEqual([{kind:'story_dna',source_id:'imported'}]);
});

test('failed move leaves selection available and shows a recoverable error',async({page})=>{
  const sources=[source('pending')];const {moves}=await workspace(page,sources,true);
  await page.goto('/#/inbox');
  await page.getByLabel('Chọn tất cả nguồn').check();
  const approve=page.getByRole('button',{name:'Duyệt vào thư viện (1)',exact:true});
  await approve.click();
  await expect(page.getByRole('alert')).toContainText('Một hoặc nhiều nguồn không còn tồn tại.');
  await expect(approve).toBeEnabled();await expect(page.getByLabel('Chọn Source pending')).toBeChecked();
  expect(sources[0].collection).toBe('inbox');expect(moves).toHaveLength(1);
});

test('moving the last page clamps pagination and selections reset with search or collection',async({page})=>{
  const sources=Array.from({length:53},(_,i)=>source(String(i).padStart(2,'0')));
  await workspace(page,sources);
  await page.goto('/#/inbox');await page.getByRole('button',{name:'Tiếp',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Source 52'})).toBeVisible();
  await page.getByLabel('Chọn tất cả nguồn').check();
  await page.getByRole('button',{name:'Duyệt vào thư viện (3)',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Source 00'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Tiếp',exact:true})).toHaveCount(0);
  await page.getByLabel('Chọn Source 00').check();
  await page.getByLabel('Tìm nguồn').fill('Source 01');
  await expect(page.getByRole('row').filter({hasText:'Source 01'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Duyệt vào thư viện \(/})).toHaveCount(0);
  await page.getByLabel('Chọn Source 01').check();
  await page.goto('/#/library');
  await expect(page.getByRole('button',{name:/Chuyển về hộp thư \(/})).toHaveCount(0);
  await expect(page.getByRole('row').filter({hasText:'Source 50'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'Thư viện nguồn',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'../.runtime/source-collections-verify/library-mobile.png',fullPage:true});
});
