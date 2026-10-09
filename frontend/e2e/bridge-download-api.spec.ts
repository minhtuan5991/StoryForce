import {test,expect,chromium} from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {armDownloadCapture,readDownloadCapture} from '../../browser-extension/download-capture.js';

test('real extension downloads generated page blobs without a file picker',async()=>{
  const extension=path.resolve('../browser-extension');
  const profile=await fs.mkdtemp(path.join(path.resolve('../.runtime'),'download-api-'));
  const downloads=path.join(profile,'files');
  await fs.mkdir(downloads,{recursive:true});
  await fs.mkdir(path.join(profile,'Default'),{recursive:true});
  await fs.writeFile(path.join(profile,'Default','Preferences'),JSON.stringify({download:{default_directory:downloads,prompt_for_download:false}}));
  const context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,acceptDownloads:false,downloadsPath:downloads,
    ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  try{
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const page=await context.newPage();
    // Playwright normally renames downloads to GUIDs. Use Chromium's normal
    // filename behavior in this isolated profile to verify the extension path.
    const session=await context.newCDPSession(page);
    await session.send('Browser.setDownloadBehavior',{behavior:'default',eventsEnabled:true});
    await page.route('https://aistudio.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><p>Owned generated WAV fixture</p>'}));
    await page.goto('https://aistudio.google.com/');
    const url=await page.evaluate(()=>URL.createObjectURL(new Blob(['RIFF owned synthetic WAV download'],{type:'audio/wav'})));
    const id=await worker.evaluate(async({url})=>{
      await (globalThis as any).chrome.storage.local.set({mediaBridge:{phase:'downloading',downloadUrl:url,downloadAt:Date.now(),
        media:{folder:'StoryForge QA',filename:'tts_001.wav'}}});
      return (globalThis as any).chrome.downloads.download({url,filename:'StoryForge QA/tts_001.wav',saveAs:false,conflictAction:'uniquify'});
    },{url});
    expect(id).toBeGreaterThanOrEqual(0);
    await expect.poll(async()=>worker.evaluate(async id=>(await (globalThis as any).chrome.downloads.search({id}))[0]?.state,id)).toBe('complete');
    const item=await worker.evaluate(async id=>(await (globalThis as any).chrome.downloads.search({id}))[0],id);
    expect(item.url).toBe(url);expect(item.filename.replaceAll('\\','/')).toContain('StoryForge QA/tts_001.wav');
    expect((await fs.readFile(item.filename)).toString()).toBe('RIFF owned synthetic WAV download');
    // Also verify a full-size provider download that constructs and immediately
    // revokes its own blob. Capture it, suppress Save As, then download once.
    await page.route('https://gemini.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><button id="download">Download full size</button>'}));
    await page.goto('https://gemini.google.com/');
    await page.evaluate(()=>{document.getElementById('download')!.onclick=()=>{
      const a=document.createElement('a');a.download='full.png';a.href=URL.createObjectURL(new Blob(['owned full-size image'],{type:'image/png'}));a.click();URL.revokeObjectURL(a.href);
    }});
    await page.evaluate(armDownloadCapture,'fullsize');
    await page.locator('#download').click();
    const full=await page.evaluate(readDownloadCapture,'fullsize');
    const fullId=await worker.evaluate(async url=>{
      await (globalThis as any).chrome.storage.local.set({mediaBridge:{phase:'downloading',downloadUrl:url,downloadAt:Date.now(),media:{folder:'StoryForge QA',filename:'scene_001.png'}}});
      return (globalThis as any).chrome.downloads.download({url,filename:'StoryForge QA/scene_001.png',saveAs:false,conflictAction:'uniquify'});
    },full);
    await expect.poll(async()=>worker.evaluate(async id=>(await (globalThis as any).chrome.downloads.search({id}))[0]?.state,fullId)).toBe('complete');
    const picture=await worker.evaluate(async id=>(await (globalThis as any).chrome.downloads.search({id}))[0],fullId);
    expect(picture.filename.replaceAll('\\','/')).toContain('StoryForge QA/scene_001.png');
    expect((await fs.readFile(picture.filename)).toString()).toBe('owned full-size image');
    await page.evaluate(()=>{document.getElementById('download')!.onclick=()=>{
      const a=document.createElement('a');a.download='Lyria_track.mp3';a.href=URL.createObjectURL(new Blob(['ID3 owned synthetic music'],{type:'audio/mpeg'}));a.click();URL.revokeObjectURL(a.href);
    }});
    await page.evaluate(armDownloadCapture,'lyria');
    await page.locator('#download').click();
    const music=await page.evaluate(readDownloadCapture,'lyria');
    const musicId=await worker.evaluate(async url=>{
      await (globalThis as any).chrome.storage.local.set({mediaBridge:{phase:'downloading',downloadUrl:url,downloadAt:Date.now(),media:{folder:'StoryForge Background Music',filename:'bgm_mystery.mp3'}}});
      return (globalThis as any).chrome.downloads.download({url,filename:'StoryForge Background Music/bgm_mystery.mp3',saveAs:false,conflictAction:'uniquify'});
    },music);
    await expect.poll(async()=>worker.evaluate(async id=>(await (globalThis as any).chrome.downloads.search({id}))[0]?.state,musicId)).toBe('complete');
    const downloadedMusic=await worker.evaluate(async id=>(await (globalThis as any).chrome.downloads.search({id}))[0],musicId);
    expect(downloadedMusic.filename.replaceAll('\\','/')).toContain('StoryForge Background Music/bgm_mystery.mp3');
    expect((await fs.readFile(downloadedMusic.filename)).toString()).toBe('ID3 owned synthetic music');
  }finally{await context.close()}
});
