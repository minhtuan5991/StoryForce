import {useEffect,useState} from 'react';
import {api,type Row} from './api';
import {Field} from './components';
import {tr} from './i18n';

export function RenderOptions({project,active,act,onBusy}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,onBusy:(busy:boolean)=>void}){
  const saved=JSON.stringify(project.settings?.render_options||{});
  const defaults={subtitles:true,waveform:false,overlay:false,logo_asset_id:null};
  const [options,setOptions]=useState<Row>({...defaults,...JSON.parse(saved)}),[busy,setBusy]=useState(false);
  useEffect(()=>{setOptions({...defaults,...JSON.parse(saved)})},[saved]);
  async function change(patch:Row){
    const next={...options,...patch};setOptions(next);setBusy(true);onBusy(true);
    try{const result=await act(()=>api('/projects/'+project.id+'/render-options','PATCH',next),'Render options saved');if(!result)setOptions({...defaults,...JSON.parse(saved)})}
    finally{setBusy(false);onBusy(false)}
  }
  const images=(project.assets||[]).filter((a:Row)=>a.kind==='image');
  return <fieldset className="render-options" disabled={active||busy}>
    <legend>{tr('Video options')}</legend>
    <div className="inline wrap">
      <label className="check-field"><input type="checkbox" checked={options.subtitles} onChange={e=>change({subtitles:e.target.checked,...(e.target.checked?{waveform:false}:{})})}/>{tr('Add subtitles')}</label>
      <label className="check-field"><input type="checkbox" checked={options.waveform} onChange={e=>change({waveform:e.target.checked,...(e.target.checked?{subtitles:false}:{})})}/>{tr('Audio waveform')}</label>
      <label className="check-field"><input type="checkbox" checked={options.overlay} disabled={!options.logo_asset_id} onChange={e=>change({overlay:e.target.checked})}/>{tr('Overlay')}</label>
    </div>
    <p className="muted">{tr('Waveform moves with the final audio at the bottom, instead of subtitles. Turn both off for a clean video.')}</p>
    <Field label={tr('Channel logo')}><select aria-label={tr('Channel logo')} value={options.logo_asset_id||''} onChange={e=>change({logo_asset_id:e.target.value||null,overlay:!!e.target.value})}>
      <option value="">{tr('Choose a logo from assets')}</option>{images.map((a:Row)=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select></Field>
    <p className="muted">{tr('Upload your logo in Assets. It appears in the upper-right corner, above all other layers. Transparent PNG is recommended.')}</p>
    {options.overlay&&options.logo_asset_id&&<img className="logo-preview" src={'/api/assets/'+options.logo_asset_id+'/file'} alt={tr('Channel logo')}/>}
    <p className="muted" role="status">{tr(busy?'Saving…':'Options apply to the next render. Render again to update the video.')}</p>
  </fieldset>;
}
