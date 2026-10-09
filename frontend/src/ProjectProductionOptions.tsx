import {useEffect} from 'react';
import {tr} from './i18n';
import {Button,Field} from './components';

export type ProductionChoices={music_enabled:boolean,image_count:number,video_count:number,counts_customized?:boolean};
export function suggestedResources(minutes:number){
  const videos=minutes<=10?2:3;
  return {image_count:Math.min(197,Math.max(3,Math.ceil(Math.max(0,minutes*60-videos*10)/60))),video_count:videos};
}
export function ProjectProductionOptions({minutes,value,onChange}:{minutes:number,value:ProductionChoices,onChange:(v:ProductionChoices)=>void}){
  const recommended=suggestedResources(minutes);
  useEffect(()=>{if(!value.counts_customized&&(value.image_count!==recommended.image_count||value.video_count!==recommended.video_count))onChange({...value,...recommended})},[minutes]);
  const setCount=(key:'image_count'|'video_count',n:number)=>onChange({...value,[key]:n,counts_customized:true});
  return <fieldset className="render-options"><legend>{tr('Resources for this video')}</legend>
    <label className="check-field"><input type="checkbox" checked={value.music_enabled} onChange={e=>onChange({...value,music_enabled:e.target.checked})}/>{tr('Add instrumental background music with Google Lyria')}</label>
    <p className="muted">{tr('Reuse the shared music library first. Create one short track only when the library is empty; emphasize the first 30 seconds, then lower and loop it beneath narration.')}</p>
    <div className="form-grid">
      <Field label={tr('Scene images')}><input type="number" min={3} max={200-value.video_count} required value={value.image_count} onChange={e=>setCount('image_count',+e.target.value)}/></Field>
      <Field label={tr('Scene videos · 10 seconds each')}><input type="number" min={2} max={Math.min(200-value.image_count,Math.ceil(minutes*6)-1)} required value={value.video_count} onChange={e=>setCount('video_count',+e.target.value)}/></Field>
    </div>
    <p className="muted">{tr('Recommended: {images} images and {videos} videos. Minimum 3 images and 2 videos; thumbnail and character reference are separate.',{images:recommended.image_count,videos:recommended.video_count})}</p>
    <Button type="button" onClick={()=>onChange({...value,...recommended,counts_customized:false})}>{tr('Use suggested counts')}</Button>
    <p className="muted">{tr('Automatic mode uses these counts without a second confirmation or another visual plan. Story Lock and the first render still need your approval.')}</p>
  </fieldset>;
}
