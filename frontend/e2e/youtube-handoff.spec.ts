import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('generate, review, apply and export YouTube metadata while preserving unrelated fields',async({page})=>{
  const metadata={title:'The last light | A lighthouse mystery',description:'A fictional keeper faces the storm. Thank you for watching.',tags:['lighthouse mystery','fictional story'],hashtags:['#Mystery'],alternative_titles:['A knock in the storm'],seo_notes:'Reflects the lighthouse setting.',review_notes:['Review media rights and disclosure settings.']};
  const p:any={id:'p',title:'A story',channel_id:'c',channel:{name:'Channel'},jobs:[],issues:[],artifacts:{},locked:true,draft:'A keeper protects a lighthouse.',story_version:1,target_minutes:5,wpm:150,
    publish:{title:'My title',description:'My description',tags:'my tags',url:'https://youtube.com/watch?v=keep',thumbnail_concept:'Keep my thumbnail',date:'2026-09-22'}};
  const writes:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects/p'&&method==='GET')result=p;
    if(method==='POST'||method==='PATCH'){
      const body=route.request().postDataJSON();writes.push({path,body});result={id:'j'};
      if(path==='/api/jobs'){p.artifacts.youtube_metadata={id:'meta',provider:'chatgpt',story_version:1,created_at:'2026-09-22',content:metadata};p.youtube_metadata_current=true}
      if(path==='/api/projects/p')p.publish=body.publish;
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/publish');await page.waitForTimeout(2200);
  await page.getByRole('button',{name:'Tạo bằng ChatGPT',exact:true}).click();
  await expect(page.getByText(metadata.title,{exact:true})).toBeVisible();
  expect(writes[0]).toEqual({path:'/api/jobs',body:{kind:'youtube_metadata',project_id:'p',payload:{auto_continue:false}}});
  await expect(page.getByLabel('Tiêu đề YouTube')).toHaveValue('My title');
  await page.getByRole('button',{name:'Dùng cho biểu mẫu xuất bản'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Áp dụng',exact:true}).click();
  await expect(page.getByLabel('Tiêu đề YouTube')).toHaveValue(metadata.title);
  await expect(page.getByLabel('Ý tưởng ảnh thu nhỏ')).toHaveValue('Keep my thumbnail');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất biểu mẫu hiện tại ra TXT'}).click();
  const file=await download,body=await readFile((await file.path())!,'utf8');
  expect(body).toContain(metadata.title);expect(body).toContain(metadata.description);expect(body).toContain(metadata.tags.join(', '));
  await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
  await expect.poll(()=>writes.at(-1)?.body.publish?.url).toBe('https://youtube.com/watch?v=keep');
  expect(writes.at(-1).body.publish).toMatchObject({title:metadata.title,date:'2026-09-22',thumbnail_concept:'Keep my thumbnail'});
  await page.screenshot({path:'../.runtime/youtube-handoff/youtube-ui.png',fullPage:true});
});

test('deletion cleanup stays opt-in, previews size and sends matching confirmation mode',async({page})=>{
  const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects')result={items:[{id:'p',title:'Private project',stage:'DRAFT',story_version:1,target_minutes:5}],total:1};
    if(path==='/api/deletions/preview'){
      const body=route.request().postDataJSON();requests.push(body);
      result={...body,confirmation:body.delete_files?'with-files':'keep-files',items:[{id:'p',title:'Private project'}],warnings:[],projects:[],blockers:[],blocked:false};
      if(body.delete_files)result.file_cleanup={count:1,bytes:10485760,files:[{path:'projects/p/render/final_video.mp4',bytes:10485760}],kept:[]};
    }
    if(path==='/api/deletions/confirm'){requests.push(route.request().postDataJSON());result={deleted:true,count:1,file_cleanup:{removed_files:1,freed_bytes:10485760,failed_files:[],kept_files:[]}}}
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects');await page.waitForTimeout(2200);
  await page.getByRole('button',{name:'Xóa Private project',exact:true}).click();
  const choice=page.getByRole('checkbox',{name:'Xóa cả media riêng và file được tạo của dự án trên ổ đĩa'});
  await expect(choice).not.toBeChecked();await expect.poll(()=>requests[0]?.delete_files).toBe(false);
  await choice.check();await expect(page.getByRole('dialog')).toContainText('10.00 MB');
  await page.getByRole('button',{name:'Xác nhận xóa',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Dung lượng đã giải phóng');
  expect(requests.at(-1)).toMatchObject({delete_files:true,confirmation:'with-files'});
});
