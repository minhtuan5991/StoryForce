import type {Row} from './api';
import {tr} from './i18n';
import {ViewText} from './ViewTranslation';

export function ProductionValidation({value,projectId}:{value:Row,projectId:string}){
  return <div className="notice compact" role={value.valid?'status':'alert'} style={{display:'block'}}>
    <strong>{tr(value.valid?'Resources are ready. Rendering will sync the timeline automatically.':'Attach the missing resources to continue.')}</strong>
    <p>{tr('Narration')}: {value.narration.join(' / ')} · {tr('Visuals')}: {value.visuals.join(' / ')}</p>
    {!value.valid&&<><ul>{value.missing.map((item:string)=><li key={item}>{tr(item)}</li>)}</ul>
      {value.missing.some((item:string)=>item.startsWith('tts_'))&&<p>{tr('The closing narration needs its own WAV. Attach it to the matching segment in TTS studio.')}</p>}
      <div className="inline wrap"><a className="button small" href={'#/projects/'+projectId+'/tts'}>{tr('TTS studio')}</a><a className="button small" href={'#/projects/'+projectId+'/assets'}>{tr('Open assets')}</a></div></>}
    {value.warnings?.map((warning:string)=><p key={warning}><ViewText text={tr(warning)}/></p>)}
  </div>;
}
