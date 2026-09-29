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

test('asset selection confirms deletion and render choices persist independently',async({page})=>{
  const p:any={id:'p',title:'Resource options',channel_id:'c',channel:{name:'Channel',color:'blue'},target_minutes:5,wpm:150,story_version:1,locked:true,
    jobs:[],issues:[],publish:{},settings:{},chunks:[],scenes:[],artifacts:{},assets:[
      {id:'logo',name:'logo.png',kind:'image',sha256:'abcd1234',size:1000,metadata_json:{}},
      {id:'video',name:'A custom scene.mp4',kind:'video',sha256:'1234abcd',size:1000,metadata_json:{}}
    ]};
  let deletes=0;
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/session')result={token:'test'};
    if(path==='/api/projects/p')result=p;
    if(path==='/api/projects/p/validate')result={valid:true,narration:[1,1],visuals:[1,1],missing:[],warnings:[]};
    if(path==='/api/projects/p/render-options'){p.settings.render_options=route.request().postDataJSON();result=p.settings.render_options}
    if(path==='/api/projects/p/assets/delete'){
      const ids=route.request().postDataJSON().ids;deletes++;
      p.assets=p.assets.filter((a:any)=>!ids.includes(a.id));result={deleted:true,count:ids.length};
    }
    if(path==='/api/assets/logo/file'){await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="72"><rect width="120" height="72" rx="12" fill="#254267"/><text x="60" y="48" font-size="40" fill="white" text-anchor="middle">SF</text></svg>'});return}
    if(path.endsWith('/file')){await route.fulfill({status:204});return}
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/render');
  await page.getByRole('checkbox',{name:'Sóng nhạc'}).check();
  await expect(page.getByRole('checkbox',{name:'Sóng nhạc'})).toBeEnabled();
  await expect(page.getByRole('checkbox',{name:'Thêm phụ đề'})).not.toBeChecked();
  await page.getByRole('combobox',{name:'Logo kênh'}).selectOption('logo');
  await expect(page.getByRole('checkbox',{name:'Lớp phủ'})).toBeChecked();
  await page.screenshot({path:'../.runtime/render-options-ui.png',fullPage:true});
  await page.reload();
  await expect(page.getByRole('checkbox',{name:'Sóng nhạc'})).toBeChecked();
  await page.goto('/#/projects/p/assets');
  await page.getByRole('checkbox',{name:'Chọn tài nguyên A custom scene.mp4'}).check();
  await page.getByRole('button',{name:/Xóa các mục đã chọn/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click();
  expect(deletes).toBe(0);
  await page.getByRole('button',{name:/Xóa các mục đã chọn/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Xóa tài nguyên',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Chọn tài nguyên A custom scene.mp4'})).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:'Chọn tài nguyên logo.png'})).toBeVisible();
  await page.screenshot({path:'../.runtime/asset-selection-ui.png',fullPage:true});
  await page.getByRole('button',{name:'Xóa toàn bộ tài nguyên'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Xóa tài nguyên',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/Chọn tài nguyên/})).toHaveCount(0);
  expect(deletes).toBe(2);
});
