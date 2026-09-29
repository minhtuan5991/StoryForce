import {useEffect,useState} from 'react';
import {api,type Row} from './api';
import {Field} from './components';
import {tr} from './i18n';

export function RenderOptions({project,active,act,onBusy}:{project:Row,active:boolean,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,onBusy:(busy:boolean)=>void}){
  const saved=JSON.stringify(project.settings?.render_options||{});
  const defaults={subtitles:true,waveform:false,overlay:false,logo_asset_id:null,ending_asset_id:null,waveform_asset_id:null};
  const [options,setOptions]=useState<Row>({...defaults,...JSON.parse(saved)}),[busy,setBusy]=useState(false);
  useEffect(()=>{setOptions({...defaults,...JSON.parse(saved)})},[saved]);
  async function change(patch:Row){
    const next={...options,...patch};setOptions(next);setBusy(true);onBusy(true);
    try{const result=await act(()=>api('/projects/'+project.id+'/render-options','PATCH',next),'Render options saved');if(!result)setOptions({...defaults,...JSON.parse(saved)})}
    finally{setBusy(false);onBusy(false)}
  }
  const images=(project.assets||[]).filter((a:Row)=>a.kind==='image');
  const videos=(project.assets||[]).filter((a:Row)=>a.kind==='video');
  const overlays=images.filter((a:Row)=>/\.png$/i.test(a.name));
  return <fieldset className="render-options" disabled={active||busy}>
    <legend>{tr('Video options')}</legend>
    <div className="inline wrap">
      <label className="check-field"><input type="checkbox" checked={options.subtitles} onChange={e=>change({subtitles:e.target.checked,...(e.target.checked?{waveform:false}:{})})}/>{tr('Add subtitles')}</label>
      <label className="check-field"><input type="checkbox" checked={options.waveform} disabled={!options.waveform_asset_id&&!options.waveform} onChange={e=>change({waveform:e.target.checked,...(e.target.checked?{subtitles:false}:{})})}/>{tr('Audio waveform')}</label>
      <label className="check-field"><input type="checkbox" checked={options.overlay} disabled={!options.logo_asset_id} onChange={e=>change({overlay:e.target.checked})}/>{tr('Overlay')}</label>
    </div>
    <Field label={tr('Green-screen waveform video')}><select aria-label={tr('Green-screen waveform video')} value={options.waveform_asset_id||''} onChange={e=>change({waveform_asset_id:e.target.value||null,waveform:!!e.target.value,...(e.target.value?{subtitles:false}:{})})}>
      <option value="">{tr('Choose a green-screen video from assets')}</option>{videos.map((a:Row)=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select></Field>
    <p className="muted">{tr('Removes the green background and loops this video until the end, below the logo. Original size and position are preserved; use the same canvas dimensions as the output. Audio from this overlay is not used.')}</p>
    {!videos.length&&<p className="muted">{tr('Upload your green-screen video in Assets, then select it here.')}</p>
    }
    <Field label={tr('Channel logo')}><select aria-label={tr('Channel logo')} value={options.logo_asset_id||''} onChange={e=>change({logo_asset_id:e.target.value||null,overlay:!!e.target.value})}>
      <option value="">{tr('Choose a logo from assets')}</option>{overlays.map((a:Row)=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select></Field>
    <p className="muted">{tr('Use a transparent PNG with the same dimensions as the output video. The whole canvas is overlaid at its original coordinates, without resizing or moving the logo.')}</p>
    {options.overlay&&options.logo_asset_id&&<img className="logo-preview" src={'/api/assets/'+options.logo_asset_id+'/file'} alt={tr('Channel logo')}/>}
    <Field label={tr('Ending thumbnail')}><select aria-label={tr('Ending thumbnail')} value={options.ending_asset_id||''} onChange={e=>change({ending_asset_id:e.target.value||null})}>
      <option value="">{tr('Use the project thumbnail')}</option>{images.map((a:Row)=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select></Field>
    <p className="muted">{tr('If audio continues after the last video, show this thumbnail for the remaining time. Upload or create a thumbnail first.')}</p>
    <p className="muted" role="status">{tr(busy?'Saving…':'Options apply to the next render. Render again to update the video.')}</p>
  </fieldset>;
}
