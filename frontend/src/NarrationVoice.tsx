import {useEffect,useState} from 'react';
import {Check,Loader2,Play,Save} from 'lucide-react';
import {api} from './api';
import type {Row} from './api';
import {Button,Field,Section} from './components';
import {ProjectProductionOptions,suggestedResources} from './ProjectProductionOptions';
import type {ProductionChoices} from './ProjectProductionOptions';
import {tr} from './i18n';

export type NarrationVoice={speaker:string,style:string};
export const legacyVoice:NarrationVoice={speaker:'Enzo',style:'Friendly'};
export const channelVoice=(channel?:Row):NarrationVoice=>channel?.settings?.narration_voice||legacyVoice;

export function VoiceFields({value,onChange}:{value:NarrationVoice,onChange:(v:NarrationVoice)=>void}){
  return <div className="form-grid">
    <Field label="Speaker" hint={tr('Enter the exact voice name shown in Google AI Studio.')}>
      <input required aria-label="Speaker" maxLength={100} value={value.speaker} onChange={e=>onChange({...value,speaker:e.target.value})} placeholder="Enzo"/>
    </Field>
    <Field label="Style" hint={tr('Use a short description of tone, mood and pace. Empty Style uses neutral delivery.')}>
      <textarea aria-label="Style" rows={3} maxLength={2000} value={value.style} onChange={e=>onChange({...value,style:e.target.value})} placeholder="Calm, intimate narration with measured pauses."/>
    </Field>
  </div>;
}

export function ProjectVoiceChoice({defaultVoice,value,onChange}:{defaultVoice:NarrationVoice,value:NarrationVoice|null,onChange:(v:NarrationVoice|null)=>void}){
  return <fieldset className="render-options"><legend>{tr('Narration voice for this project')}</legend>
    <label className="check-field"><input type="checkbox" checked={value===null} onChange={e=>onChange(e.target.checked?null:{...defaultVoice})}/>{tr('Use channel voice defaults')}</label>
    {value===null?<p className="muted">Speaker: <strong>{defaultVoice.speaker}</strong> · Style: {defaultVoice.style||tr('Neutral delivery')}</p>:<VoiceFields value={value} onChange={onChange}/>}
    <p className="muted">{tr('The confirmed voice stays the same for every TTS segment in this project.')}</p>
  </fieldset>;
}

export function ChannelNarration({channel,onChanged}:{channel:Row,onChanged:()=>void}){
  const saved=channelVoice(channel);
  const [voice,setVoice]=useState<NarrationVoice>(saved),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{setVoice(saved);setMessage('')},[channel.id,saved.speaker,saved.style]);
  return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');try{
    await api('/channels/'+channel.id+'/narration','PUT',voice);onChanged();setMessage(tr('Channel voice saved. Existing projects keep their confirmed voice.'));
  }catch(e){setError(String(e))}finally{setBusy(false)}}}>
    <h3>{tr('Default narration voice')}</h3><p className="muted">{tr('Google AI Studio uses these defaults for new projects in this channel. You can override them when creating a project.')}</p>
    <fieldset disabled={busy} className="plain-fieldset"><VoiceFields value={voice} onChange={setVoice}/></fieldset>
    {error&&<p role="alert" className="error-text">{error}</p>}{message&&<p role="status">{message}</p>}
    <Button type="submit" primary disabled={busy||!voice.speaker.trim()}>{busy?<Loader2 size={16} className="spin"/>:<Save size={16}/>} {tr('Save channel voice')}</Button>
  </form>;
}

export function ProjectSetupPanel({project:p,onChanged,disabled=false}:{project:Row,onChanged:(result:Row)=>void,disabled?:boolean}){
  const [minutes,setMinutes]=useState(p.target_minutes);
  const [production,setProduction]=useState<ProductionChoices>(p.settings?.production_options?
    {...p.settings.production_options,counts_customized:true}:{music_enabled:false,...suggestedResources(p.target_minutes),counts_customized:false});
  const [voice,setVoice]=useState<NarrationVoice|null>(p.settings?.narration_voice||null);
  const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=!!p.setup_pending;
  if(!pending)return <Section title={tr('Confirmed production settings')}>
    <p>{p.target_minutes} {tr('minutes')} · {p.settings?.production_options?.image_count??'—'} {tr('images')} · {p.settings?.production_options?.video_count??'—'} {tr('videos')}</p>
    <p>Speaker: <strong>{p.narration_voice?.speaker||legacyVoice.speaker}</strong> · Style: {p.narration_voice?.style||tr('Neutral delivery')}</p>
    <p className="muted">{tr('The confirmed voice stays the same for every TTS segment in this project.')}</p>
    <ProjectVoiceEditor project={p} onChanged={()=>onChanged({})} disabled={disabled}/>
  </Section>;
  const valid=minutes>=1&&minutes<=240&&production.image_count>=3&&production.video_count>=2&&production.image_count+production.video_count<=200&&production.video_count*10<minutes*60&&(!voice||!!voice.speaker.trim());
  return <Section title={tr('Review settings before starting')} caption={tr('Extend and Customize projects wait here until you confirm and continue.')}>
    <form onSubmit={async e=>{e.preventDefault();if(!checked||!valid||busy||disabled)return;setBusy(true);setError('');try{
      const result=await api('/projects/'+p.id+'/setup','POST',{confirmed:true,target_minutes:minutes,
        production_options:{music_enabled:production.music_enabled,image_count:production.image_count,video_count:production.video_count},narration_voice:voice});
      onChanged(result);
    }catch(e){setError(String(e))}finally{setBusy(false)}}}>
      <fieldset disabled={busy||disabled} className="plain-fieldset">
        <Field label={tr('Target duration (minutes)')}><input type="number" min={1} max={240} step="any" required value={minutes} onChange={e=>{setMinutes(+e.target.value);setChecked(false)}}/></Field>
        <p className="muted">{tr('Duration changes the word target and scene plan; the selected idea and Story Bible remain the starting point.')}</p>
        <ProjectProductionOptions minutes={minutes} value={production} onChange={v=>{setProduction(v);setChecked(false)}}/>
        <ProjectVoiceChoice defaultVoice={channelVoice(p.channel)} value={voice} onChange={v=>{setVoice(v);setChecked(false)}}/>
        <label className="check-field"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{tr('I checked the duration, resource counts and narration voice.')}</label>
      </fieldset>
      {error&&<p role="alert" className="error-text">{error}</p>}
      <div className="form-footer"><Button primary type="submit" disabled={!checked||!valid||busy||disabled}>{busy?<Loader2 size={16} className="spin"/>:<Play size={16}/>} {tr('Confirm and continue pipeline')} {!busy&&<Check size={16}/>}</Button></div>
    </form>
  </Section>;
}

function ProjectVoiceEditor({project:p,onChanged,disabled}:{project:Row,onChanged:()=>void,disabled:boolean}){
  const [editing,setEditing]=useState(false),[voice,setVoice]=useState<NarrationVoice>(p.narration_voice||legacyVoice),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>setVoice(p.narration_voice||legacyVoice),[p.id,p.narration_voice?.speaker,p.narration_voice?.style]);
  if((p.chunks||[]).some((c:Row)=>c.asset_id))return null;
  if(!editing)return <Button small disabled={disabled} onClick={()=>setEditing(true)}>{tr('Adjust voice before TTS')}</Button>;
  return <form onSubmit={async e=>{e.preventDefault();if(busy||disabled)return;setBusy(true);setError('');try{
    await api('/projects/'+p.id+'/narration','PUT',voice);setEditing(false);onChanged();
  }catch(e){setError(String(e))}finally{setBusy(false)}}}>
    <p className="muted">{tr('You can correct Speaker and Style before any narration audio is created. Cancel active work first.')}</p>
    <fieldset disabled={busy||disabled} className="plain-fieldset"><VoiceFields value={voice} onChange={setVoice}/></fieldset>
    {error&&<p role="alert" className="error-text">{error}</p>}
    <div className="inline wrap"><Button primary type="submit" disabled={busy||disabled||!voice.speaker.trim()}>{busy?<Loader2 size={16} className="spin"/>:<Save size={16}/>} {tr('Save project voice')}</Button><Button type="button" disabled={busy} onClick={()=>setEditing(false)}>{tr('Cancel')}</Button></div>
  </form>;
}
