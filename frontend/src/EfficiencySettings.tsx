import {tr} from './i18n';

type Props={enabled:boolean,onChange:(enabled:boolean)=>void};

export function WorkflowEfficiencyControl({enabled,onChange}:Props){
  return <fieldset className="render-options">
    <legend>{tr('Shorter story workflow')}</legend>
    <label className="check-field"><input type="checkbox" checked={enabled} aria-describedby="workflow-efficiency-hint" onChange={e=>onChange(e.target.checked)}/>{tr('Reduce duplicate AI calls')}</label>
    <p id="workflow-efficiency-hint" className="muted">{tr('Reuse an outline that passes, write one opening in the draft, and combine ChatGPT cross-review with retention. Both final verifications remain required; automatic mode still waits for Story Lock approval.')}</p>
    <p className="muted">{tr('For fewer candidates choose 1–3 ideas. Keep a larger batch when you want ideas for future projects.')}</p>
  </fieldset>;
}

export function TimelineEfficiencyControl({enabled,onChange}:Props){
  return <fieldset className="render-options">
    <legend>{tr('Faster timeline joining')}</legend>
    <label className="check-field"><input type="checkbox" checked={enabled} aria-describedby="timeline-efficiency-hint" onChange={e=>onChange(e.target.checked)}/>{tr('Render transition windows only')}</label>
    <p id="timeline-efficiency-hint" className="muted">{tr('Keeps fades, image motion, resolution and FPS. Compatible scene bodies are joined directly; a failed frame-grid check automatically uses the established renderer.')}</p>
  </fieldset>;
}
