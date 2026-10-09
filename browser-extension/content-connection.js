import {withTabReadDeadline} from './transport.js';

// A healthy content listener must survive consecutive readiness observations.
// Reinstall only for a missing listener or an actual extension upgrade.
export function createContentConnection({chrome,allowedHosts,readTimeoutMs=12000}) {
  return async function ensureContent(tabId) {
    try {
      const response=await withTabReadDeadline(()=>chrome.tabs.sendMessage(tabId,{type:'storyforge',action:'ping'}),readTimeoutMs);
      if(response?.version===chrome.runtime.getManifest().version)return;
    } catch(error) {
      // A slow renderer is not a disconnected listener. Do not stack injections.
      if(error.code==='TAB_READ_TIMEOUT')throw error;
    }
    const tab=await chrome.tabs.get(tabId);
    if(!allowedHosts.includes(new URL(tab.url).hostname))throw new Error('Unsupported provider tab');
    await withTabReadDeadline(()=>chrome.scripting.executeScript({target:{tabId},files:['adapters.js','paste.js','media-content.js','content.js']}),readTimeoutMs);
  };
}
