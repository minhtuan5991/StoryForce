let jobs=[];
const $=id=>document.getElementById(id);
function current(){return jobs.find(j=>j.id===$('jobs').value)}
async function send(action,extra={}){
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  $('status').textContent='Working…';
  try{
    const response=await chrome.runtime.sendMessage({action,job:current(),...extra});
    if(!response.ok)throw new Error(response.error);
    if(response.items){jobs=response.items;$('jobs').replaceChildren(...jobs.map(j=>{const option=document.createElement('option');option.value=j.id;option.textContent=j.provider+' · '+j.kind.replaceAll('_',' ');return option}));}
    $('status').textContent=response.message||(jobs.length?jobs.length+' waiting jobs.':'No waiting browser jobs. Set provider mode to Browser in StoryForge and start a workflow step.');
  }catch(error){$('status').textContent=error.message}
  finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);await loadAuto()}
}
$('pairButton').onclick=()=>send('pair',{token:$('token').value});
$('refresh').onclick=()=>send('jobs');
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>send(b.dataset.action));
$('manual').onclick=()=>send('manual',{text:$('result').value});
$('copy').onclick=async()=>{if(current()){await navigator.clipboard.writeText(current().prompt);$('status').textContent='Prompt copied. Paste it into your provider.'}};
send('jobs');

function paintAuto(state){
  $('autoEnabled').checked=!!state.enabled;
  $('autoStatus').textContent=state.message||'Tự động đang tắt.';
  $('autoResume').hidden=state.phase!=='paused';
  document.querySelectorAll('[data-action],#manual').forEach(button=>button.disabled=!!state.enabled);
}
async function loadAuto(){
  try{const response=await chrome.runtime.sendMessage({action:'auto-status'});if(response.ok)paintAuto(response.auto)}catch{}
}
$('autoEnabled').onchange=()=>send('auto-toggle',{enabled:$('autoEnabled').checked});
$('autoResume').onclick=()=>send('auto-resume');
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.autoBridge)paintAuto(changes.autoBridge.newValue)});
loadAuto();
