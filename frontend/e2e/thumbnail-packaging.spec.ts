import {test,expect} from '@playwright/test';

const sha='verified-asset-sha',hash='current-plan';
const picture=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#122032"/><rect x="160" y="110" width="850" height="490" fill="#253d52" stroke="#7fa4b9" stroke-width="12"/><path d="M180 360H960M480 120V590M780 120V590" stroke="#7fa4b9" stroke-width="8"/><rect x="480" y="360" width="300" height="230" fill="#887044" stroke="#e4b972" stroke-width="12"/><text x="630" y="480" text-anchor="middle" fill="#ffe7be" font-size="76" font-family="sans-serif">614</text></svg>`;
function fixture(withImage=false){
 const plan={content_fingerprint:'inputs-hash',plan_hash:hash,recommended_thumbnail_variant:'A',recommendation_reason:'The numbered room is evidence of the central anomaly.',test_notes:'Hold the title fixed. Compare watch time in eligible YouTube Studio tests; the result can be inconclusive.',
   official_sources:['https://support.google.com/youtube/answer/16391400'],visual_dna:{primary_setting:'A print shop',central_anomaly:'An impossible room appears on the hotel blueprint',signature_object:'A numbered blueprint',evidence_quotes:['Room 614 appeared on the blueprint.']},
   thumbnail_variants:['A','B','C'].map((id,i)=>({id,strategy:['concrete_anomaly','human_threat','atmospheric_context'][i],concept:['Room 614 appears on a blueprint where no room exists.','The clerk studies a newly printed plan, unaware a doorway has appeared.','The hotel corridor contains a door absent from the original plan.'][i],composition:'One concrete detail, believable materials and light.',lighting:'Practical fluorescent light.',text_overlay:'',title_complement_reason:'The picture supplies visible evidence for the event in the title.',hypothesis:'Test whether this evidence creates accurate curiosity.',scores:{story_accuracy:90,mobile_readability:82,clutter_risk:8},evidence_quotes:['Room 614 appeared on the blueprint.'],generation_prompt:'A photographic plan with room 614.',negative_prompt:'No monsters or unrelated ghosts.'}))};
 const image={asset_id:'image-a',sha256:sha,name:'thumbnail_A.png',checks:{file_readable:true,width:1280,height:720,aspect_16_9:true,at_least_720p:true},review:{}};
 return {id:'p',title:'Room project',channel_id:'c',channel:{name:'The Midnight Log',color:'blue',settings:{}},target_minutes:5,wpm:150,story_version:1,locked:true,stage:'LOCKED',draft:'Room 614 appeared on the blueprint.',word_count:7,profile:{word_range:[690,810]},lock_gate:{can_lock:true,reasons:[]},versions:[],jobs:[],issues:[],assets:withImage?[{id:'image-a',kind:'image',name:'thumbnail_A.png',metadata_json:{role:'thumbnail'}}]:[],chunks:[],scenes:[],premises:[],settings:{render_options:{subtitles:false}},workflow_settings:{},publish:{title:'Saved story title',url:'https://youtube.com/watch?v=kept'},artifacts:{},
 thumbnail_packaging:{plan,current:true,selected_variant:'A',assets:withImage?{A:image}:{},channel_style:{visual_language:'Grounded cinematic realism',text_usage:'AUTO',typography:'LEGACY_2_3_FONTS',color_mode:'LEGACY_TWO_ACCENTS',research_evidence:[]}}};
}
async function prepare(page:any,project:any){
 const requests:any[]=[];
 await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
 await page.route('**/api/**',async(route:any)=>{
   const request=route.request(),path=new URL(request.url()).pathname;let result:any={items:[],total:0};
   if(path.startsWith('/api/assets/')){await route.fulfill({body:picture,contentType:'image/svg+xml'});return}
   if(path==='/api/session')result={token:'test',version:'3.1.25'};
   if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
   if(path==='/api/projects/p')result=project;
   if(request.method()!=='GET'){
     const body=request.postDataJSON();requests.push({path,body});result=body;
     if(path.endsWith('/thumbnail-style')){project.thumbnail_packaging.channel_style=body;project.thumbnail_packaging.current=false}
     if(path.endsWith('/thumbnail-review/image-a')){project.thumbnail_packaging.assets.A.review={...body,passed:true};result=project.thumbnail_packaging.assets.A.review}
     if(path.endsWith('/thumbnail-select')){project.publish.thumbnail_asset_id=body.asset_id;project.thumbnail_packaging.selected_variant=body.variant}
   }
   await route.fulfill({json:result});
 });
 await page.goto('/#/projects/p/visuals');
 return requests;
}

test('three concepts stay readable on desktop and mobile and require confirmation to create all images',async({page})=>{
 const project:any=fixture(),requests=await prepare(page,project);
 await expect(page.getByText('Ý tưởng thumbnail theo nội dung truyện',{exact:true})).toBeVisible();
 await expect(page.getByText('A · Chi tiết bất thường cụ thể',{exact:true})).toBeVisible();
 await expect(page.getByText('B · Tình huống của nhân vật',{exact:true})).toBeVisible();
 await expect(page.getByText('C · Bối cảnh và không khí',{exact:true})).toBeVisible();
 await page.screenshot({path:'../.runtime/thumbnail-ui/concepts-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'../.runtime/thumbnail-ui/concepts-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Tạo cả ba ảnh thumbnail',exact:true}).click();
 expect(requests).toHaveLength(0);
 await page.getByRole('dialog').getByRole('button',{name:'Xác nhận tạo ba ảnh thumbnail',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(1);
 expect(requests[0]).toEqual({path:'/api/projects/p/media-automation/start',body:{kind:'thumbnails',plan_hash:hash,variants:['A','B','C']}});
 expect(project.publish).toEqual({title:'Saved story title',url:'https://youtube.com/watch?v=kept'});
});

test('actual image review and optional channel style preserve story and render settings',async({page})=>{
 const project:any=fixture(true),requests=await prepare(page,project);
 await page.getByRole('button',{name:'Kiểm tra ảnh A',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('Bản xem nhỏ (320 × 180)',{exact:true})).toBeVisible();
 for(const label of ['Ảnh đúng nội dung truyện','Nhận ra được chi tiết bất thường','Nhìn rõ trong bản xem nhỏ','Chữ và nhãn trên vật thể quan trọng đều đúng','Không tiết lộ kết thúc hay cú ngoặt chính'])await dialog.getByRole('checkbox',{name:label,exact:true}).check();
 await dialog.getByLabel('Chữ thực tế trên thumbnail',{exact:true}).fill('614');
 await dialog.screenshot({path:'../.runtime/thumbnail-ui/image-review-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.screenshot({path:'../.runtime/thumbnail-ui/image-review-mobile.png'});
 await dialog.getByRole('button',{name:'Lưu kết quả kiểm tra ảnh',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(1);
 expect(requests[0].body).toMatchObject({asset_sha256:sha,plan_hash:hash,actual_text:'614',image_matches_story:true});
 await expect(page.getByText('Ảnh đã được bạn kiểm tra',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Dùng ảnh A',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(2);
 expect(project.publish).toEqual({title:'Saved story title',url:'https://youtube.com/watch?v=kept',thumbnail_asset_id:'image-a'});
 await page.getByText('Phong cách thumbnail của kênh (không bắt buộc)',{exact:true}).click();
 await page.getByRole('combobox',{name:'Chế độ chữ trên thumbnail',exact:true}).selectOption('NO_TEXT');
 await expect(page.getByRole('button',{name:'Tạo ảnh thumbnail đã chọn',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Lưu phong cách thumbnail',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(3);
 expect(requests[2].body).toMatchObject({text_usage:'NO_TEXT',typography:'LEGACY_2_3_FONTS',color_mode:'LEGACY_TWO_ACCENTS'});
 expect(project.settings.render_options).toEqual({subtitles:false});
 await expect(page.getByRole('button',{name:'Tạo ảnh thumbnail đã chọn',exact:true})).toBeDisabled();
});
