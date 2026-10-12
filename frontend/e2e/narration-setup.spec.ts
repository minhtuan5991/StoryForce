import {test,expect} from '@playwright/test';
import type {APIRequestContext} from '@playwright/test';
import {readFileSync} from 'node:fs';

async function workspace(request:APIRequestContext){
  const session=await (await request.get('/api/session')).json();
  const headers={'X-StoryForge-Token':session.token};
  await request.patch('/api/settings',{headers,data:{pipeline_mode:'manual',provider_mode:'mock'}});
  const channel=await (await request.post('/api/channels',{headers,data:{name:'Voice studio test',status:'ESTABLISHED'}})).json();
  return {headers,channel};
}

test('channel defaults and the new-project override create independent frozen voices',async({page,request})=>{
  const {headers,channel}=await workspace(request);
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','en'));
  await page.goto('/#/channels/'+channel.id);
  await page.getByLabel('Speaker',{exact:true}).fill('Fola');
  await page.getByLabel('Style',{exact:true}).fill('Calm, intimate narration.');
  await page.screenshot({path:'../.runtime/narration-channel-overview.png',fullPage:true});
  await page.getByRole('button',{name:'Save channel voice',exact:true}).click();
  await expect(page.getByText('Channel voice saved. Existing projects keep their confirmed voice.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'New project',exact:true}).first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Project title',{exact:true}).fill('Wizard with channel voice');
  await dialog.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(dialog.getByLabel('Use channel voice defaults')).toBeChecked();
  await expect(dialog.getByText('Fola',{exact:true})).toBeVisible();
  await dialog.getByLabel('Use channel voice defaults').uncheck();
  await dialog.getByLabel('Speaker',{exact:true}).fill('Kore');
  await dialog.getByLabel('Style',{exact:true}).fill('Clear, measured delivery.');
  await dialog.getByRole('button',{name:'Continue',exact:true}).click();
  await dialog.getByRole('button',{name:'Create project',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Confirmed production settings',{exact:true})).toBeVisible();
  const projects=await (await request.get('/api/projects')).json();
  const project=projects.items.find((p:any)=>p.channel_id===channel.id);
  expect(project.settings.narration_voice).toEqual({speaker:'Kore',style:'Clear, measured delivery.'});
  await page.screenshot({path:'../.runtime/narration-project-overview.png',fullPage:true});
  await request.put('/api/channels/'+channel.id+'/narration',{headers,data:{speaker:'Enzo',style:'Friendly'}});
  const frozen=await (await request.get('/api/projects/'+project.id)).json();
  expect(frozen.narration_voice.speaker).toBe('Kore');
});

test('Customize waits for Overview review, then uses the imported Bible directly for the outline',async({page,request})=>{
  const {headers,channel}=await workspace(request);
  await request.put('/api/channels/'+channel.id+'/narration',{headers,data:{speaker:'Fola',style:'Quiet, natural narration.'}});
  const project=await (await request.post('/api/projects',{headers,data:{channel_id:channel.id,title:'Imported voice story',entry_mode:'existing_bible'}})).json();
  const fixture=JSON.parse(readFileSync('../fixtures/mock_outputs.json','utf8')).story_bible;
  const imported=await request.post('/api/projects/'+project.id+'/story-bible/import',{headers,data:{content:fixture}});
  expect(imported.ok()).toBeTruthy();
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.goto('/#/projects/'+project.id+'/overview');
  const button=page.getByRole('button',{name:'Xác nhận và tiếp tục quy trình',exact:true});
  await expect(button).toBeDisabled();
  await page.getByRole('button',{name:'Tiếp tục quy trình',exact:true}).click();
  expect((await (await request.get('/api/projects/'+project.id)).json()).jobs).toHaveLength(0);
  await page.getByLabel('Thời lượng video (phút)',{exact:true}).fill('15');
  await page.screenshot({path:'../.runtime/narration-customize-pending.png',fullPage:true});
  await page.getByLabel('Tôi đã kiểm tra thời lượng, số lượng tài nguyên và giọng đọc.').check();
  await button.click();
  await expect(page.getByText('Thiết lập sản xuất đã xác nhận',{exact:true})).toBeVisible();
  const detail=await (await request.get('/api/projects/'+project.id)).json();
  expect(detail.setup_pending).toBe(false);expect(detail.target_minutes).toBe(15);
  expect(detail.duration_mode).toBe('Custom');
  expect(detail.narration_voice.speaker).toBe('Fola');
  expect(detail.jobs.map((j:any)=>j.kind)).toEqual(['outline']);expect(detail.premises).toHaveLength(0);
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByText('Thiết lập sản xuất đã xác nhận',{exact:true})).toBeVisible();
  await page.screenshot({path:'../.runtime/narration-customize-mobile.png',fullPage:true});
});
