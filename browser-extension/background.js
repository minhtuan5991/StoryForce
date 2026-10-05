import {createAutomaticBridge,parseBridgeResult} from './automatic.js';
import {withTabReadDeadline} from './transport.js';
import {copyResponseSource} from './raw-response.js';
import {createMediaBridge} from './media-automatic.js';
import {armDownloadCapture,readDownloadCapture} from './download-capture.js';
const BASE = 'http://127.0.0.1:8787';
const ALLOWED = ['chatgpt.com','gemini.google.com','aistudio.google.com','labs.google','flow.google.com'];
async function request(path, method='GET', body) {
  const {token} = await chrome.storage.local.get('token');
  if (!token) throw new Error('Pair the extension first. Generate a key in StoryForge Settings.');
  const response = await fetch(BASE + '/api/bridge' + path, {method,headers:{'X-Bridge-Token':token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.detail || 'Bridge request failed'), {code:result.code});
  return result;
}
async function open(job) {
  if (!job.url || !ALLOWED.includes(new URL(job.url).hostname)) throw new Error('Unsupported provider URL');
  const tabs = await chrome.tabs.query({url:new URL(job.url).origin+'/*'});
  const tab = tabs[0] ? await chrome.tabs.update(tabs[0].id,{active:true}) : await chrome.tabs.create({url:job.url,active:true});
  await chrome.storage.local.set({['tab_'+job.id]:tab.id});
  return tab;
}
async function capture(job, text) {
  const result=await parseBridgeResult(text,request,job);
  return request('/jobs/'+job.id+'/result','POST',{result});
}
async function handle(message) {
  if(message.action==='auto-status')return {auto:await automatic.read(),media:await mediaAutomatic.read()};
  if(message.action==='media-resume'){await mediaAutomatic.resume();schedule();return {media:await mediaAutomatic.read()};}
  if(message.action==='auto-toggle'){await automatic.setEnabled(!!message.enabled);schedule();return {auto:await automatic.read()};}
  if(message.action==='auto-resume'){await automatic.resume();schedule();return {auto:await automatic.read()};}
  if (message.action==='jobs') return request('/jobs');
  if (message.action==='pair') {await chrome.storage.local.set({token:message.token.trim()});return request('/jobs');}
  if((await automatic.read()).enabled)throw new Error('Tắt chế độ tự động trước khi dùng các nút thủ công.');
  const job=message.job;
  if (!job?.id) throw new Error('Choose a waiting job.');
  if (message.action==='open') {await open(job);return {message:'Provider tab opened. Sign in normally if required.'};}
  if (message.action==='manual') return capture(job,message.text);
  const stored=await chrome.storage.local.get('tab_'+job.id);
  const tabId=stored['tab_'+job.id];
  if (!tabId) throw new Error('Open the provider tab first.');
  const tab=await chrome.tabs.get(tabId);
  if (!ALLOWED.includes(new URL(tab.url).hostname)) throw new Error('The tab is no longer on a supported provider.');
  await ensureContent(tabId);
  const result=await chrome.tabs.sendMessage(tabId,{type:'storyforge',action:message.action,prompt:job.prompt});
  if (!result?.ok) {
    await request('/jobs/'+job.id+'/status','POST',{step:result?.error || 'Bridge unavailable; use manual mode'});
    throw new Error(result?.error || 'Reload this provider page to activate the extension.');
  }
  if (result.text) {await capture(job,result.text);return {message:'Validated result saved to StoryForge.'};}
  await request('/jobs/'+job.id+'/status','POST',{step:result.message});
  return result;
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  // Only extension UI can issue control actions; content pages cannot reach this protocol.
  if (sender.tab) return;
  handle(message).then(result=>respond({ok:true,...result})).catch(error=>respond({ok:false,error:error.message}));
  return true;
});

async function ensureContent(tabId){
  try{
    const response=await withTabReadDeadline(()=>chrome.tabs.sendMessage(tabId,{type:'storyforge',action:'ping'}));
    if(response?.version===chrome.runtime.getManifest().version)return;
  }catch(error){
    // Do not pile up injections in a hung renderer. A disconnected listener
    // can be reinstalled, but a timed-out read waits for the next collection tick.
    if(error.code==='TAB_READ_TIMEOUT')throw error;
  }
  const tab=await chrome.tabs.get(tabId);
  if(!ALLOWED.includes(new URL(tab.url).hostname))throw new Error('Unsupported provider tab');
  await withTabReadDeadline(()=>chrome.scripting.executeScript({target:{tabId},files:['adapters.js','media-content.js','content.js']}));
}
async function captureRaw(tabId,target){
  const tab=await chrome.tabs.get(tabId);
  if(new URL(tab.url).hostname!=='chatgpt.com')throw new Error('Unsupported raw response tab');
  const results=await withTabReadDeadline(()=>chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:copyResponseSource,args:[target]}));
  if(!results[0]?.result?.text)throw new Error('Raw response unavailable');
  return results[0].result;
}
const automatic=createAutomaticBridge({chrome,request,ensureContent,captureRaw});
const mediaAutomatic=createMediaBridge({chrome,request,ensureContent,
  armCapture:async(tabId,ticket,provider)=>withTabReadDeadline(()=>chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:armDownloadCapture,args:[ticket,provider]})),
  readCapture:async(tabId,ticket)=>{
    const results=await withTabReadDeadline(()=>chrome.scripting.executeScript({target:{tabId},func:readDownloadCapture,args:[ticket]}));
    return results[0]?.result||'';
  }});
chrome.downloads.onDeterminingFilename.addListener((item,suggest)=>{void mediaAutomatic.determineFilename(item,suggest);return true});
let timer;
function schedule(delay=0){clearTimeout(timer);timer=setTimeout(async()=>{
  try{
    const state=await automatic.read();
    if(state.jobId&&state.phase!=='paused')await automatic.tick();
    else{
      await mediaAutomatic.tick();
      const media=await mediaAutomatic.read();
      if(!media.jobId||media.phase==='paused')await automatic.tick();
    }
  }finally{
    const state=await automatic.read(),media=await mediaAutomatic.read();
    if(state.enabled)schedule(state.jobId||media.jobId?2000:5000);
  }
},delay)}
async function initialize(){
  if(!await chrome.alarms.get('storyforge-auto'))await chrome.alarms.create('storyforge-auto',{periodInMinutes:0.5});
  schedule();
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='storyforge-auto')schedule()});
chrome.runtime.onStartup.addListener(()=>{void initialize()});
chrome.runtime.onInstalled.addListener(()=>{void initialize()});
void initialize();
