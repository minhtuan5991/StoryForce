import {test,expect} from '@playwright/test';

test('overview cleanup previews before confirmation and keeps final download after cleaning',async({page})=>{
  const project:any={id:'p',title:'The Door That Remembered My Name',channel_id:'c',channel:{name:'Mystery',color:'blue'},
    target_minutes:20,wpm:150,story_version:1,locked:true,stage:'READY',draft:'A locked narration.',word_count:3,
    storage_folder:'H:/Tool/StoryForge US Data/projects/The Door That Remembered My Name',
    jobs:[],issues:[],publish:{final_reviewed:true},settings:{},workflow_settings:{},assets:[],chunks:[],scenes:[],premises:[],versions:[],
    profile:{target_words:3000,word_range:[2760,3240],characters:[2,4],scenes:[20,30],retention_map:[]},
    next:{checkpoint:'Review final video',kind:'render'},lock_gate:{can_lock:true,reasons:[]},artifacts:{},premise_reuse:{ready:true}};
  const report={title:project.title,count:24,bytes:3456789012,files:[{path:project.storage_folder+'/images/scene_001.png',bytes:100000}],
    final:project.storage_folder+'/render/final_video.mp4',kept:[{path:project.storage_folder+'/render/final_video.mp4',reason:'Final video'}],
    was_current:true,blocked:false,blockers:[],confirmation:'confirmed-preview'};
  const requests:any[]=[];
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;let result:any={items:[],total:0};
    if(path==='/api/session')result={token:'test',version:'3.1.27'};
    if(path==='/api/dashboard')result={settings:{provider_mode:'browser'},active_jobs:0,sources:0};
    if(path==='/api/projects/p')result=project;
    if(path.endsWith('/cleanup-preview'))result=report;
    if(request.method()!=='GET'){
      requests.push({path,body:request.postDataJSON()});
      if(path.endsWith('/resources/cleanup')){
        project.settings.resource_cleanup={status:'completed'};
        project.next={action_kind:'archived_resources',checkpoint:'Resources archived'};
        result={cleaned:true,removed_files:24,freed_bytes:report.bytes,failed_files:[],final:project.storage_folder+'/final_video.mp4'};
      }
      if(path.endsWith('/download-final'))result={saved:true,path:'C:/Users/Admin/Downloads/'+project.title+'/final_video.mp4'};
    }
    await route.fulfill({json:result});
  });
  await page.goto('/#/projects/p/overview');
  await page.getByRole('button',{name:'Xóa dữ liệu Tài Nguyên',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('24');
  await expect(dialog).toContainText('final_video.mp4');
  await expect(dialog).toContainText('xóa vĩnh viễn');
  await page.screenshot({path:'../.runtime/storage-ui/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'../.runtime/storage-ui/mobile.png',fullPage:true});
  await dialog.getByRole('button',{name:'Hủy',exact:true}).click();
  expect(requests).toEqual([]);
  await page.getByRole('button',{name:'Xóa dữ liệu Tài Nguyên',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Xác nhận xóa tài nguyên',exact:true}).click();
  await expect(dialog).toContainText('24');
  await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.getByRole('button',{name:'final_video.mp4',exact:true}).click();
  await expect(page.locator('.final-video-download [role="status"]').filter({hasText:'C:/Users/Admin/Downloads/'})).toBeVisible();
  expect(requests.map(r=>r.path)).toEqual(['/api/projects/p/resources/cleanup','/api/projects/p/download-final']);
  expect(requests[0].body).toEqual({confirmation:'confirmed-preview'});
});
