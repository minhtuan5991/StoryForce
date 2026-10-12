import {type Row} from './api';
import {Section} from './components';
import {tr} from './i18n';
import {resourcesCleaned} from './ResourceCleanup';

// The API name is retained for existing clients; this is a readiness summary,
// with no approval checkbox or mutation and no automatic render action.
export function ResourceReview({project:p}:{project:Row,act?:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const review=p.resource_review;
  if(!review?.manual_render_required||!p.locked||resourcesCleaned(p))return null;
  return <Section title={tr('Resource readiness')} caption={tr('Assisted mode stops before rendering. When resources are ready, click Render first cut yourself.')}>
    <div className={'notice compact '+(review.ready?'success':'')} role="status">
      <strong>{tr(review.active?'Resource generation is still running':review.ready?'Resources are ready for manual rendering':'Attach the missing resources to continue.')}</strong>
      <p>{tr('Narration')}: {review.narration.join(' / ')} · {tr('Visuals')}: {review.visuals.join(' / ')} · {tr('Thumbnails')}: {review.thumbnails.join(', ')||'—'}</p>
    </div>
    {!!review.missing.length&&<ul>{review.missing.map((item:string)=><li key={item}>{tr(item)}</li>)}</ul>}
    {review.warnings.map((warning:string)=><p className="notice compact" key={warning}>{tr(warning)}</p>)}
    {!!review.thumbnail_missing?.length&&<p>{tr('Publishing thumbnails to add later')}: {review.thumbnail_missing.join(', ')}</p>}
    <div className="inline wrap">
      {review.can_render&&<a className="button primary" href={'#/projects/'+p.id+'/render'}>{tr('Open Render & QA')}</a>}
      <a className="button" href={'#/projects/'+p.id+'/assets'}>{tr('Open assets')}</a>
    </div>
  </Section>;
}
