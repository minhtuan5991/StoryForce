import {Badge} from './components';
import {tr} from './i18n';

export function ProjectTypeGuide() {
  return <div className="notice compact project-type-guide" aria-label={tr('Project types')}>
    <span><Badge>Full Step</Badge><small>{tr('Full workflow from an inspiration source or original idea.')}</small></span>
    <span><Badge>Extend</Badge><small>{tr('Unused idea from a completed project; starts at Story Bible.')}</small></span>
    <span><Badge>Customize</Badge><small>{tr('Imported Story Bible; skips direction and ideas.')}</small></span>
  </div>;
}

export function SourceUsageNote({count=0}:{count?:number}) {
  return <small className="muted source-usage">{count>0?tr('Used in {count} Projects',{count}):tr('Not used yet')}</small>;
}
