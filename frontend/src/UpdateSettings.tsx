import {useEffect,useState} from 'react';
import {api} from './api';
import {Button,Section} from './components';
import {tr} from './i18n';

export function UpdateSettings(){
  const [info,setInfo]=useState<any>({state:'idle'}),[error,setError]=useState(''),[requesting,setRequesting]=useState(false);
  useEffect(()=>{let alive=true;const load=()=>api('/updates').then(value=>{if(alive)setInfo(value)}).catch(e=>{if(alive)setError(e.message)});load();const timer=setInterval(load,2000);return()=>{alive=false;clearInterval(timer)}},[]);
  const busy=requesting||['checking','downloading'].includes(info.state);
  const messages:Record<string,string>={idle:'Check GitHub for a newer version.',checking:'Checking for updates…',downloading:'Downloading and verifying the new installer…',ready:'Update ready. Stop and Start the app to install, or download the installer below.',current:'You are using the latest version.',error:'Could not check for updates. Check your Internet connection and try again.'};
  return <Section title={tr('App updates')}>
    <p>{tr('Current version')}: <strong>v{info.current_version||'3.1.20'}</strong></p>
    <div className="inline wrap"><Button disabled={busy} onClick={async()=>{setRequesting(true);setError('');try{await api('/updates/check','POST');setInfo(await api('/updates'))}catch(e){setError((e as Error).message)}finally{setRequesting(false)}}}>{tr('Check for updates')}</Button>
    {info.state==='ready'&&<a className="button primary" href="/api/updates/installer">{tr('Download ready installer')}</a>}
    <a className="button" href="https://github.com/minhtuan5991/StoryForce/releases/latest" target="_blank" rel="noreferrer">{tr('Open latest release')}</a></div>
    <p className="muted" role="status">{tr(messages[info.state]||messages.idle)}</p>
    <p className="muted">{tr('Manual checks run immediately without the 6-hour wait. Current tasks are not stopped.')}</p>
    {error&&<p className="error-text" role="alert">{error}</p>}
  </Section>
}

