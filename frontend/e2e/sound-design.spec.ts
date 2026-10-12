import {test,expect} from '@playwright/test';
import path from 'node:path';

test('shared music selector and narrated sound timeline work without automatically rendering',async({page})=>{
  const review={required:false,ready:true,can_render:true,manual_render_required:true,active:false,
    narration:[1,1],visuals:[2,2],thumbnails:[],missing:[],warnings:[]};
  const p:any={id:'p',title:'Customize - Sound design demo',channel_id:'c',channel:{name:'Mystery',color:'blue'},
    target_minutes:5,wpm:150,locked:true,story_version:1,stage:'LOCKED',updated_at:'one',
    settings:{production_options:{music_enabled:true},background_music:{status:'ready',asset_id:'music',library_id:'one'}},
    workflow_settings:{pipeline_mode:'assisted'},resource_review:review,jobs:[],issues:[],publish:{},draft:'The radio crackled beside me.',
    word_count:5,profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},versions:[],
    chunks:[],scenes:[],assets:[{id:'music',name:'Mystery.wav',kind:'music',size:100,sha256:'music',duration:150,story_version:1,metadata_json:{shared_library_id:'one'}}],
    premises:[],artifacts:{},next:{action_kind:'render'},thumbnail_packaging:{current:false},missing_resources:[]};
  const music:any={folder:'H:\\Tool\\StoryForge US Data\\background_music',items:[
    {id:'one',name:'Mystery.wav',duration:150,available:true},{id:'two',name:'Curiosity.mp3',duration:160,available:true}],errors:[]};
  const sound={enabled:true,opening_seconds:30,timing:'actual',prepared:false,cues:[
    {id:'opening',kind:'opening_texture',label:'Opening mystery texture',offset:0,duration:30},
    {id:'radio',kind:'radio_static',label:'Radio interference',offset:40,duration:1.5,anchor_text:'The radio crackled beside me.'}]};
  const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();let result:any={items:[],total:0};
    if(url.pathname==='/api/session')result={token:'test',version:'3.1.43'};
    if(url.pathname==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(url.pathname==='/api/projects/p')result=p;
    if(url.pathname==='/api/background-music')result=music;
    if(url.pathname==='/api/projects/p/sound-design')result=sound;
    if(method==='POST'){
      const body=request.postDataJSON();requests.push({path:url.pathname,body});
      if(url.pathname==='/api/projects/p/background-music/select'){
        p.settings.background_music.library_id=body.library_id;p.updated_at='two';result={status:'ready',library_id:body.library_id};
      }
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/assets');
  const select=page.getByRole('combobox',{name:'Chọn nhạc nền'});
  await expect(select).toHaveValue('one');
  await expect(page.getByText(/Nhạc giữ mức âm thanh của file gốc/)).toBeVisible();
  await select.selectOption('two');
  await expect(page.getByLabel('Nghe thử nhạc đã chọn')).toHaveAttribute('src','/api/assets/two/file');
  await page.getByRole('button',{name:'Dùng bản nhạc đã chọn'}).click();
  await expect.poll(()=>requests).toContainEqual({path:'/api/projects/p/background-music/select',body:{library_id:'two'}});
  music.items.push({id:'three',name:'New enigma.wav',duration:180,available:true});
  await page.getByRole('button',{name:'Làm mới danh sách nhạc'}).click();
  await expect(select.locator('option')).toHaveCount(4);
  await page.getByText('Thời điểm hiệu ứng âm thanh',{exact:true}).click();
  await expect(page.getByRole('cell',{name:'0:40'})).toBeVisible();
  expect(requests.some(r=>r.path.includes('/render')||r.path.includes('/pipeline'))).toBe(false);
  await page.locator('section').filter({has:page.getByRole('heading',{name:'Nhạc nền dùng chung',exact:true})}).screenshot({path:path.resolve('../.runtime/music43-verify/music-selector.png')});
});
