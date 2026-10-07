import {test,expect} from '@playwright/test';

const content={summary:'An unpowered relay receives tomorrow’s warning.',characters:[{name:'Mara',job:'Radio keeper'}],world_rules:['Opening the relay connects two places.'],custom_notes:{keep:'The final choice'}};
function fixture(){return {id:'p',title:'Hồ sơ có sẵn',channel_id:'c',channel:{name:'The Midnight Log',color:'blue'},target_minutes:5,wpm:150,story_version:0,locked:false,stage:'BIBLE',draft:'',word_count:0,profile:{word_range:[690,810]},lock_gate:{can_lock:false,reasons:['No draft']},versions:[],jobs:[],issues:[],assets:[],chunks:[],scenes:[],premises:[],settings:{entry_mode:'existing_bible'},workflow_settings:{pipeline_mode:'auto'},publish:{},artifacts:{}}}
async function prepare(page:any){
 const project:any=fixture(),requests:any[]=[];
 await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
 await page.route('**/api/**',async(route:any)=>{
  const request=route.request(),path=new URL(request.url()).pathname;let result:any={items:[],total:0};
  if(path==='/api/session')result={token:'test',version:'3.1.26'};
  if(path==='/api/dashboard')result={settings:{provider_mode:'mock'},active_jobs:0,sources:0};
  if(path==='/api/channels')result={items:[{id:'c',name:'The Midnight Log',default_duration:5,color:'blue'}],total:1};
  if(path==='/api/sources')result={items:[{id:'s',title:'The source story'}],total:1};
  if(path==='/api/projects/p')result=project;
  if(path==='/api/duration')result={target_words:750,word_range:[690,810],characters:[1,3],scenes:[6,10]};
  if(path==='/api/settings')result={pipeline_mode:'auto',auto_select_premise:false,provider_mode:'mock',default_wpm:150,default_duration:5,default_premise_count:10,max_audit_cycles:3};
  if(path==='/api/updates')result={current_version:'3.1.26',state:'idle'};
  if(request.method()!=='GET'){
   const body=request.postDataJSON();requests.push({path,body});result=body;
   if(path==='/api/projects'){project.settings.entry_mode=body.entry_mode;result=project}
   if(path.endsWith('/story-bible/validate')){
    try{const parsed=JSON.parse(body.content);if(!parsed.summary)throw new Error('summary');result={valid:true,content:parsed}}
    catch{await route.fulfill({status:422,json:{detail:'Story Bible requires a non-empty summary'}});return}
   }
   if(path.endsWith('/story-bible/import')){
    project.artifacts.story_bible={id:'b',provider:'manual_import',content:JSON.parse(body.content),template_version:'import-1.0',created_at:new Date().toISOString(),output_hash:'saved-sha'};
    result=project.artifacts.story_bible;
   }
   if(path.endsWith('/pipeline'))result={kind:'outline',id:'job'};
  }
  await route.fulfill({json:result});
 });
 return {project,requests};
}

test('wizard inserts the existing Bible option and opens an import-only story stage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const {requests}=await prepare(page);
 await page.goto('/#/projects');
 await page.getByRole('button',{name:'Dự án mới',exact:true}).click();
 const wizard=page.getByRole('dialog');
 await wizard.getByLabel('Tên dự án',{exact:true}).fill('Hồ sơ có sẵn');
 await wizard.getByRole('combobox',{name:'Kênh',exact:true}).selectOption('c');
 const inspiration=wizard.getByRole('combobox',{name:'Nguồn cảm hứng (tùy chọn)',exact:true});
 expect(await inspiration.locator('option').allTextContents()).toEqual(['Bắt đầu từ ý tưởng gốc','Đã có Hồ sơ truyện','The source story']);
 await inspiration.selectOption({label:'Đã có Hồ sơ truyện'});
 await wizard.getByRole('button',{name:'Tiếp tục',exact:true}).click();
 await wizard.getByRole('button',{name:'Tiếp tục',exact:true}).click();
 await wizard.getByRole('button',{name:'Tạo dự án',exact:true}).click();
 await expect(page).toHaveURL(/\/projects\/p\/bible$/);
 expect(requests[0]).toMatchObject({path:'/api/projects',body:{entry_mode:'existing_bible',source_id:null,channel_id:'c'}});
 await expect(page.getByRole('button',{name:'Nhập hồ sơ truyện',exact:true})).toBeVisible();
 await expect(page.locator('.studio-nav [aria-disabled="true"]')).toHaveCount(2);
 await expect(page.locator('.studio-nav').getByRole('link',{name:'Ý tưởng truyện',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Tạo hồ sơ truyện',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Nhập hồ sơ truyện',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('textbox').fill('{}');
 await dialog.getByRole('button',{name:'Kiểm tra JSON',exact:true}).click();
 await expect(dialog.getByRole('alert')).toHaveText('Hồ sơ truyện cần trường summary (tóm tắt) có nội dung');
 await dialog.locator('input[type="file"]').setInputFiles({name:'story_bible.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(content))});
 await dialog.getByRole('button',{name:'Kiểm tra JSON',exact:true}).click();
 await expect(dialog.getByText('JSON hợp lệ · xem trước',{exact:true})).toBeVisible();
 await dialog.screenshot({path:'../.runtime/story-entry-ui/import-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.screenshot({path:'../.runtime/story-entry-ui/import-mobile.png'});
 await dialog.getByRole('button',{name:'Lưu hồ sơ truyện',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText('The final choice',{exact:true})).toBeVisible();
 expect(requests.filter(r=>r.path.endsWith('/pipeline'))).toHaveLength(0);
 await page.getByRole('button',{name:'Tiếp tục quy trình',exact:true}).click();
 expect(requests.filter(r=>r.path.endsWith('/pipeline'))).toHaveLength(1);
 expect(errors).toEqual([]);
});

test('auto workflow settings explain Idea 1 and the three human checkpoints',async({page})=>{
 await prepare(page);await page.goto('/#/settings');
 const workflow=page.getByRole('combobox',{name:/Chế độ quy trình/});
 await expect(workflow).toHaveValue('auto');
 await expect(page.getByText(/Tự động chọn Ý tưởng 1, dừng để bạn Khóa truyện/)).toBeVisible();
 await page.getByText('Thiết lập điểm duyệt nâng cao',{exact:true}).click();
 const choice=page.getByRole('checkbox',{name:'Tự chọn ý tưởng đạt yêu cầu có điểm thử nghiệm cao nhất'});
 await expect(choice).toBeChecked();await expect(choice).toBeDisabled();
 await workflow.selectOption('manual');
 await expect(choice).toBeEnabled();await expect(choice).not.toBeChecked();
});
