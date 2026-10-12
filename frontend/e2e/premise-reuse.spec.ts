import {test,expect} from '@playwright/test';

test('archived pool keeps unused ideas enabled, marks used ideas and opens the derived Bible',async({page})=>{
  const idea=(id:string,title:string)=>({id,title,category:'Core',logline:'A sealed door opens on its own.',warnings:[],mini_test:{},packaging:{},duration_class:'CORE',scores:{hook:90,originality:85,duration_fit:90,source_similarity_risk:10},signature:{},target_words:750});
  const p:any={id:'pool',title:'Full Step - The Empty Station',channel_id:'c',channel:{name:'Mystery',color:'blue'},
    target_minutes:5,wpm:150,story_version:1,locked:true,stage:'READY',draft:'Finished narration.',word_count:2,
    settings:{resource_cleanup:{status:'completed'}},jobs:[],issues:[],publish:{final_reviewed:true},workflow_settings:{pipeline_mode:'manual',default_premise_count:10},
    selected_premise_id:'used',premises:[idea('used','The Empty Station'),idea('new','The Second Door')],
    premise_pool:{project_id:'pool',project_exists:true,used_premise_ids:['used'],used_projects:{used:{project_id:'pool',deleted:false}}},
    premise_reuse:{ready:true,reason:'Choose an unused idea to create a new project. Resource cleanup does not block unused ideas.'},
    artifacts:{},assets:[],chunks:[],scenes:[],versions:[],next:{action_kind:'archived_resources'},lock_gate:{can_lock:true,reasons:[]},
    profile:{target_words:750,word_range:[690,810],characters:[2,4],scenes:[5,8],retention_map:[]}};
  const child={...p,id:'child',title:'Extend - The Second Door',locked:false,story_version:0,stage:'BIBLE',draft:'',
    settings:{premise_origin:{project_id:'pool',premise_id:'new'}},premises:[{...p.premises[1],id:'child-idea'}],selected_premise_id:'child-idea',next:{kind:'story_bible'}};
  const posts:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test',version:'3.1.40'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/projects/pool')result=p;
    if(path==='/api/projects/child')result=child;
    if(path==='/api/projects/pool/select-premise'){
      posts.push(route.request().postDataJSON());result=child;
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/pool/premises');
  const used=page.locator('.premise-card.used');
  await expect(used).toContainText('The Empty Station');
  await expect(used.getByRole('button',{name:'Ý tưởng đã dùng',exact:true})).toBeDisabled();
  const choose=page.getByRole('button',{name:'Tạo dự án mới',exact:true});
  await expect(choose).toBeEnabled();
  await page.screenshot({path:'../.runtime/idea-reuse-verify/ideas-desktop.png',fullPage:true});
  await choose.click();
  await expect(page).toHaveURL(/\/projects\/child\/bible$/);
  await expect(page.getByRole('heading',{name:'Extend - The Second Door',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Các giai đoạn dự án'}).getByRole('link',{name:'Định hướng',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Các giai đoạn dự án'}).getByRole('link',{name:'Ý tưởng truyện',exact:true})).toHaveCount(0);
  expect(posts).toEqual([{premise_id:'new'}]);
});

test('project labels and source usage notes appear in both source lists',async({page})=>{
  const sources=[{id:'s',title:'Quy dinh ky la tai xe ca dem_zh',usage_count:1},{id:'unused',title:'Unused inspiration',usage_count:0}]
    .map(s=>({...s,platform:'Pasted text',tags:[],language:'English',dna:{},created_at:'2026-10-01'}));
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test',version:'3.1.40'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:2};
    if(path==='/api/sources')result={items:sources,total:2};
    if(path==='/api/projects')result={items:['Full Step','Extend','Customize'].map((type,i)=>({id:String(i),title:type+' - Story '+i,target_minutes:10,stage:'BIBLE',story_version:0})),total:3};
    await route.fulfill({json:result});
  });
  for(const path of ['/inbox','/library']){
    await page.goto('/#'+path);
    const row=page.getByRole('row').filter({hasText:sources[0].title});
    await expect(row.locator('.source-usage')).toHaveText('Đã dùng trong 1 Hồ sơ');
    await expect(page.getByRole('row').filter({hasText:sources[1].title}).locator('.source-usage')).toHaveText('Chưa được dùng');
  }
  await page.screenshot({path:'../.runtime/idea-reuse-verify/source-notes-desktop.png',fullPage:true});
  await page.goto('/#/projects');
  for(const type of ['Full Step','Extend','Customize'])await expect(page.getByRole('link',{name:type+' - Story '+['Full Step','Extend','Customize'].indexOf(type),exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByLabel('Loại dự án')).toBeVisible();
  await page.screenshot({path:'../.runtime/idea-reuse-verify/project-types-mobile.png',fullPage:true});
});
