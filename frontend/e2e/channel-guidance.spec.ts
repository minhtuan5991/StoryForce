import {test,expect} from '@playwright/test';
import type {APIRequestContext} from '@playwright/test';

async function workspace(request:APIRequestContext,name='Heart & Hurdles'){
  const session=await (await request.get('/api/session')).json();
  const headers={'X-StoryForge-Token':session.token};
  const response=await request.post('/api/channels',{headers,data:{name,niche:'Family drama',status:'ESTABLISHED'}});
  expect(response.ok()).toBeTruthy();
  return {channel:await response.json(),headers};
}

test('saved DNA research is previewed, applied explicitly and frozen for new projects',async({page,request})=>{
  const {channel,headers}=await workspace(request);
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  const base='/api/channels/'+channel.id;
  const before=await (await request.get(base)).json();
  const oldProject=await (await request.post('/api/projects',{headers,data:{channel_id:channel.id,title:'Before new guidance'}})).json();
  await page.goto('/#/channels/'+channel.id);
  await page.getByRole('button',{name:'DNA kênh',exact:true}).click();
  await expect(page.getByRole('button',{name:'Nghiên cứu DNA kênh',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Nghiên cứu DNA kênh',exact:true}).click();
  await expect(page.getByRole('button',{name:'Áp dụng chỉ dẫn',exact:true})).toBeEnabled();
  const preview=await (await request.get(base)).json();
  expect(preview.creative_guidance.active_id).toBe(before.creative_guidance.active_id);
  expect(preview.creative_guidance.items[0].status).toBe('draft');
  await page.getByText('Nguồn tham khảo và giới hạn',{exact:true}).click();
  await expect(page.getByText('Biên soạn từ DNA; không khẳng định đã tra cứu web.')).toBeVisible();
  await page.screenshot({path:'../.runtime/channel-guidance-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Áp dụng chỉ dẫn',exact:true}).click();
  await expect(page.getByText('Đã áp dụng chỉ dẫn cho các dự án mới.',{exact:true})).toBeVisible();
  const applied=await (await request.get(base)).json();
  expect(applied.creative_guidance.active_id).not.toBe(before.creative_guidance.active_id);
  const next=await (await request.post('/api/projects',{headers,data:{channel_id:channel.id,title:'After new guidance'}})).json();
  expect(next.settings.channel_guidance.id).toBe(applied.creative_guidance.active_id);
  const original=await (await request.get('/api/projects/'+oldProject.id)).json();
  expect(original.settings.channel_guidance).toEqual(oldProject.settings.channel_guidance);
  await page.setViewportSize({width:375,height:812});
  await expect(page.getByRole('button',{name:'Nghiên cứu DNA kênh',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:'../.runtime/channel-guidance-mobile.png',fullPage:true});
});

test('invalid criteria remain editable and unsaved changes block research',async({page,request})=>{
  const {channel}=await workspace(request,'The Veiled Signal');
  await page.addInitScript(()=>localStorage.setItem('storyforge-interface-language','vi'));
  await page.goto('/#/channels/'+channel.id);
  await page.getByRole('button',{name:'DNA kênh',exact:true}).click();
  await page.getByRole('button',{name:'Sửa JSON',exact:true}).click();
  const dna={...channel.dna,creative_brief:{...channel.dna.creative_brief,avoid:'wrong type'}};
  await page.getByRole('textbox',{name:'DNA kênh'}).fill(JSON.stringify(dna));
  await expect(page.getByRole('button',{name:'Nghiên cứu DNA kênh',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('avoid');
  await expect(page.getByRole('textbox',{name:'DNA kênh'})).toHaveValue(JSON.stringify(dna));
});
