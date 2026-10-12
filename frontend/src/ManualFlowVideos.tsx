import {Download,ExternalLink,Upload} from 'lucide-react';
import {type Row} from './api';
import {Badge,CopyButton,Section} from './components';
import {mediaSessionUrl} from './MediaSessions';
import {tr} from './i18n';

export function ManualFlowVideos({project:p}:{project:Row}){
  const scenes=(p.scenes||[]).filter((scene:Row)=>scene.visual_type==='VIDEO');
  if(!scenes.length)return null;
  const references=p.manual_video_references||[];
  const flow=mediaSessionUrl(p,'flow')||'https://flow.google.com/';
  return <Section title={tr('Create Flow videos manually')} caption={tr('Images, thumbnails and audio remain automatic.')}
    action={<a className="button" href={flow} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true"/>{tr('Open Flow')}</a>}>
    <p>{tr('Upload these character references to the same Flow project, then paste each scene prompt and create its video.')}</p>
    <div className="inline wrap">{references.map((asset:Row)=><a key={asset.id} className="button small" href={'/api/assets/'+asset.id+'/file'} download={asset.name}>
      <Download size={14} aria-hidden="true"/>{tr('Download reference')}: {asset.name}
    </a>)}</div>
    {!references.length&&<p className="muted">{tr('Character references will appear here after their images are ready.')}</p>}
    <p>{tr('Download each clip with the filename shown below, then import it in Assets. Matching scene_NNN.mp4 files are attached to the correct scene automatically.')}</p>
    <div className="jobs-list">{scenes.map((scene:Row)=>{
      const file='scene_'+String(scene.number).padStart(3,'0')+'.mp4';
      const asset=(p.assets||[]).find((item:Row)=>item.id===scene.asset_id&&item.kind==='video');
      return <div className="job-row" key={scene.id}>
        <div className="job-info"><strong>{file}</strong><p>{tr('Scene ')+scene.number} · 10 {tr('seconds')}</p></div>
        <Badge tone={asset?'green':'amber'}>{tr(asset?'Video attached':'Create manually in Flow')}</Badge>
        <CopyButton text={scene.generation_prompt||(scene.prompt+'\nAvoid: '+scene.negative_prompt)} caption={tr('Copy video prompt')}/>
      </div>;
    })}</div>
    <a className="button" href={'#/projects/'+p.id+'/assets'}><Upload size={16} aria-hidden="true"/>{tr('Import videos in Assets')}</a>
  </Section>;
}
