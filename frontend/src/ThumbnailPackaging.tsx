import {useEffect,useState} from 'react';
import {Sparkles,Image,Download,Plus,Trash2,Square} from 'lucide-react';
import {api,type Row} from './api';
import {Badge,Button,CopyButton,Field,Modal,Readable,Section} from './components';
import {tr} from './i18n';
import {ViewText} from './ViewTranslation';
import './thumbnail.css';

type Action=(fn:()=>Promise<any>,message?:string)=>Promise<any>;
const reviewLabels:Record<string,string>={image_matches_story:'Image matches the story',anomaly_readable:'The anomaly is recognizable',mobile_readable:'Readable in the small preview',text_correct:'Text and meaningful prop labels are correct',no_major_spoiler:'No ending or major twist is revealed'};
const strategyLabels:Record<string,string>={concrete_anomaly:'Concrete visual anomaly',human_threat:'Human stakes',atmospheric_context:'Atmosphere and setting',alternative_evidence:'Alternative story evidence'};
const defaults={visual_language:'Grounded cinematic realism; restrained mystery; believable materials and lighting.',text_usage:'AUTO',typography:'LEGACY_2_3_FONTS',color_mode:'LEGACY_TWO_ACCENTS',research_evidence:[]};

export function ThumbnailPackaging({project:p,act}:{project:Row,act:Action}){
  const state=p.thumbnail_packaging||{},plan=state.plan;
  const planHash=plan?.plan_hash||plan?.content_fingerprint;
  const active=p.jobs?.some((j:Row)=>['queued','running','waiting_user'].includes(j.status))||false;
  const [busy,setBusy]=useState(false),[style,setStyle]=useState<Row>(()=>({...defaults,...state.channel_style})),[dirty,setDirty]=useState(false),[error,setError]=useState('');
  const [all,setAll]=useState(false),[review,setReview]=useState<Row|null>(null);
  useEffect(()=>{setStyle({...defaults,...state.channel_style});setDirty(false);setError('');setReview(null);setAll(false)},[p.id]);
  function update(key:string,value:any){setStyle({...style,[key]:value});setDirty(true)}
  async function action(fn:()=>Promise<any>,message:string){setBusy(true);setError('');try{return await act(fn,message)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function generate(variants:string[]){const result=await action(()=>api('/projects/'+p.id+'/media-automation/start','POST',{kind:'thumbnails',plan_hash:planHash,variants}),'Thumbnail image creation queued');if(result)setAll(false)}
  const blocked=active||busy||dirty||!state.current;
  const assets=state.assets||{};
  const hashes=Object.values(assets).map((a:any)=>a.sha256);
  const duplicates=hashes.length!==new Set(hashes).size;
  return <Section title={tr('Story-specific thumbnail concepts')} caption={tr('Three visual hypotheses grounded in the locked story. Concept scores are not measurements of the generated image or predictions of CTR.')}>
    <details className="thumbnail-settings"><summary>{tr('Channel thumbnail style (optional)')}</summary>
      <p>{tr('Font and color choices are reused across this channel. Text is optional; settings do not change the story or scene plan.')}</p>
      <form onSubmit={async e=>{e.preventDefault();const result=await action(()=>api('/projects/'+p.id+'/thumbnail-style','PATCH',style),'Thumbnail style saved');if(result){setStyle(result);setDirty(false)}else setError(tr('Could not save thumbnail style. Keep your inputs and try again.'))}}>
        <Field label="Visual treatment"><textarea rows={2} maxLength={700} required disabled={active||busy} value={style.visual_language} onChange={e=>update('visual_language',e.target.value)}/></Field>
        <div className="form-grid">
          <Field label="Thumbnail text mode"><select disabled={active||busy} value={style.text_usage} onChange={e=>update('text_usage',e.target.value)}><option value="AUTO">{tr('Story-driven: optional text')}</option><option value="NO_TEXT">{tr('No overlay text')}</option><option value="SHORT_TEXT">{tr('Short headline (1–4 words)')}</option></select></Field>
          <Field label="Thumbnail typography"><select disabled={active||busy} value={style.typography} onChange={e=>update('typography',e.target.value)}><option value="LEGACY_2_3_FONTS">{tr('Keep existing 2–3 font treatment')}</option><option value="SINGLE_BOLD_FONT">{tr('One bold readable font')}</option></select></Field>
          <Field label="Thumbnail color treatment"><select disabled={active||busy} value={style.color_mode} onChange={e=>update('color_mode',e.target.value)}><option value="LEGACY_TWO_ACCENTS">{tr('Keep two contrasting accent colors')}</option><option value="STORY_DRIVEN">{tr('Colors from the story and lighting')}</option></select></Field>
        </div>
        <details><summary>{tr('Optional thumbnail research evidence')}</summary><p>{tr('Add a real video/source and observation date. Public views describe context; they do not prove a thumbnail caused the result.')}</p>
          {style.research_evidence.map((r:Row,i:number)=><div key={i} className="thumbnail-research-row"><div className="form-grid">
            <Field label={tr('Observation {number}',{number:i+1})}><input required maxLength={700} disabled={active||busy} value={r.claim} onChange={e=>update('research_evidence',style.research_evidence.map((row:Row,n:number)=>n===i?{...row,claim:e.target.value}:row))}/></Field>
            <Field label={tr('Research type {number}',{number:i+1})}><select disabled={active||busy} value={r.evidence_type} onChange={e=>update('research_evidence',style.research_evidence.map((row:Row,n:number)=>n===i?{...row,evidence_type:e.target.value}:row))}>{['OBSERVED_CHANNEL_PATTERN','PUBLIC_PERFORMANCE_CONTEXT','CHANNEL_ANALYTICS','AB_TEST_RESULT'].map(k=><option key={k} value={k}>{tr(k)}</option>)}</select></Field>
            <Field label={tr('Source reference {number}',{number:i+1})}><input required maxLength={500} disabled={active||busy} value={r.source} onChange={e=>update('research_evidence',style.research_evidence.map((row:Row,n:number)=>n===i?{...row,source:e.target.value}:row))}/></Field>
            <Field label={tr('Observation date {number}',{number:i+1})}><input required={['OBSERVED_CHANNEL_PATTERN','PUBLIC_PERFORMANCE_CONTEXT'].includes(r.evidence_type)} maxLength={40} disabled={active||busy} value={r.observed_on} onChange={e=>update('research_evidence',style.research_evidence.map((row:Row,n:number)=>n===i?{...row,observed_on:e.target.value}:row))}/></Field>
          </div><Button type="button" small disabled={active||busy} onClick={()=>update('research_evidence',style.research_evidence.filter((_:Row,n:number)=>n!==i))}><Trash2 size={14}/>{tr('Remove observation {number}',{number:i+1})}</Button></div>)}
          <Button type="button" small disabled={active||busy||style.research_evidence.length>=8} onClick={()=>update('research_evidence',[...style.research_evidence,{claim:'',evidence_type:'OBSERVED_CHANNEL_PATTERN',source:'',observed_on:''}])}><Plus size={14}/>{tr('Add research observation')}</Button>
        </details>
        {dirty&&<p className="muted">{tr('Save thumbnail settings before creating concepts or images.')}</p>}
        <Button type="submit" small disabled={!dirty||active||busy}>{tr('Save thumbnail style')}</Button>
      </form>
    </details>
    {error&&<p role="alert" className="error-text">{error}</p>}
    <div className="inline wrap thumbnail-actions">
      <Button primary disabled={!p.locked||active||busy||dirty} onClick={()=>action(()=>api('/jobs','POST',{kind:'thumbnail_plan',project_id:p.id,payload:{auto_continue:false}}),'Thumbnail concepts queued')}><Sparkles size={16}/>{tr(plan?'Regenerate three thumbnail concepts':'Create three thumbnail concepts')}</Button>
      {plan&&<><Button disabled={blocked} onClick={()=>generate([state.selected_variant||plan.recommended_thumbnail_variant])}><Image size={16}/>{tr('Create selected thumbnail image')}</Button><Button disabled={blocked} onClick={()=>setAll(true)}>{tr('Create all three thumbnail images')}</Button></>}
      {(p.settings?.thumbnail_pending_visuals||p.settings?.media_automation?.kind==='thumbnails'&&p.settings.media_automation.phase==='running')&&<Button disabled={busy} onClick={()=>action(()=>api('/projects/'+p.id+'/media-automation/stop','POST'),'Thumbnail creation stopped')}><Square size={15}/>{tr('Stop thumbnail creation')}</Button>}
    </div>
    {p.settings?.thumbnail_pending_visuals&&<p role="status" className="notice compact">{tr('Creating thumbnail concepts first. The previously confirmed image/video queue will resume automatically.')}</p>}
    {plan&&!state.current&&<p role="status" className="notice compact">{tr('These concepts refer to an earlier story, title or style. Recreate concepts before generating or choosing an image. Existing files are kept.')}</p>}
    {plan&&<>
      <p><strong>{tr('Editorial recommendation')}: {plan.recommended_thumbnail_variant}</strong> · <ViewText text={plan.recommendation_reason}/></p>
      <details><summary>{tr('Visual DNA and story evidence')}</summary><Readable value={plan.visual_dna}/></details>
      {duplicates&&<p className="notice compact">{tr('Some returned thumbnail files are identical. Regenerate a variant before running a meaningful comparison.')}</p>}
      <div className="thumbnail-concept-grid">{plan.thumbnail_variants.map((v:Row)=>{const image=assets[v.id];return <article key={v.id} className={'thumbnail-concept '+(state.selected_variant===v.id?'selected':'')}>
        <div className="inline between"><h3>{v.id} · {tr(strategyLabels[v.strategy])}</h3>{v.id===plan.recommended_thumbnail_variant&&<Badge>{tr('Recommended')}</Badge>}</div>
        <p><ViewText text={v.concept}/></p><p><strong>{tr('Headline')}: </strong>{v.text_overlay||tr('No overlay text')}</p>
        <p><ViewText text={v.title_complement_reason}/></p>
        {image&&<><img className="thumbnail-small" src={'/api/assets/'+image.asset_id+'/thumbnail-preview'} alt={v.id+' · '+v.concept}/><p>{image.review?.passed?tr('Image reviewed by you'):tr('Generated image awaiting visual review')}</p>{(!image.checks?.aspect_16_9||!image.checks?.at_least_720p)&&<p className="error-text">{tr('Check image size: use 16:9 and at least 1280 × 720 for thumbnail comparisons.')}</p>}</>}
        <details><summary>{tr('Concept details and editorial scores')}</summary><p><ViewText text={v.composition}/></p><p><ViewText text={v.lighting}/></p>{v.adaptation_reason&&<p><ViewText text={v.adaptation_reason}/></p>}<p><ViewText text={v.hypothesis}/></p><p className="muted">{tr('Scores / 100: benefits higher, risks lower. These estimates describe the concept; review the actual image separately.')}</p><Readable value={v.scores}/><Readable value={v.evidence_quotes}/><CopyButton text={state.generation_prompts?.[v.id]||(v.generation_prompt+'\nAvoid: '+v.negative_prompt)} caption="Copy concept prompt"/></details>
        <div className="inline wrap"><Button small disabled={blocked} onClick={()=>action(()=>api('/projects/'+p.id+'/thumbnail-select','POST',{variant:v.id,plan_hash:planHash,...(image?{asset_id:image.asset_id}:{})}),'Thumbnail variant selected')}>{tr(image?'Use image {variant}':'Choose concept {variant}',{variant:v.id})}</Button>
          <Button small disabled={blocked} onClick={()=>generate([v.id])}>{tr('Generate image {variant}',{variant:v.id})}</Button>
          {image&&<><Button small disabled={!state.current||busy} onClick={()=>setReview({...image,variant:v,plan_hash:planHash})}>{tr('Review image {variant}',{variant:v.id})}</Button><a className="button small" href={'/api/assets/'+image.asset_id+'/file'} download={'thumbnail_'+v.id+'.png'}><Download size={14}/>{tr('Download {variant}',{variant:v.id})}</a></>}
        </div>
      </article>})}</div>
      <details><summary>{tr('YouTube experiment plan and research sources')}</summary><p><ViewText text={plan.test_notes}/></p><p className="muted">{tr('Tests run in YouTube Studio, when eligible. StoryForge prepares the variants; a recommendation is not an experiment winner.')}</p>{plan.research_evidence?.length>0&&<Readable value={plan.research_evidence}/>}<div className="inline wrap">{plan.official_sources?.map((url:string,i:number)=><a key={url} className="button small" target="_blank" rel="noreferrer" href={url}>{tr('YouTube reference {number}',{number:i+1})}</a>)}</div></details>
      <a className="button small" href={'/api/projects/'+p.id+'/download/thumbnail_plan.json'} download="thumbnail_plan.json"><Download size={15}/>{tr('Export thumbnail concepts and test plan')}</a>
    </>}
    {all&&<Modal title={tr('Create three thumbnail images')} onClose={()=>{if(!busy)setAll(false)}}><p>{tr('Create A, B and C sequentially in the same Gemini conversation. This uses three image generations and keeps all existing files. Scene image/video counts stay unchanged.')}</p><div className="modal-actions"><Button disabled={busy} onClick={()=>setAll(false)}>{tr('Cancel')}</Button><Button primary disabled={busy} onClick={()=>generate(['A','B','C'])}>{tr('Confirm three thumbnail images')}</Button></div></Modal>}
    {review&&<ThumbnailImageReview key={review.asset_id} projectId={p.id} image={review} act={act} onClose={()=>setReview(null)}/>}
  </Section>;
}

function ThumbnailImageReview({projectId,image,act,onClose}:{projectId:string,image:Row,act:Action,onClose:()=>void}){
  const [form,setForm]=useState<Row>(()=>Object.fromEntries(Object.keys(reviewLabels).map(k=>[k,image.review?.[k]||false]))),[text,setText]=useState(image.review?.actual_text||''),[notes,setNotes]=useState(image.review?.notes||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <Modal wide title={tr('Review generated thumbnail {variant}',{variant:image.variant.id})} onClose={()=>{if(!busy)onClose()}}>
    <p>{tr('Review the actual pixels. StoryForge checks file readability and dimensions; it does not automatically verify the characters, text or story accuracy.')}</p>
    <img className="thumbnail-review-large" src={'/api/assets/'+image.asset_id+'/file'} alt={tr('Full thumbnail for review')}/>
    <p>{tr('Small preview (320 × 180)')}</p><img className="thumbnail-small" src={'/api/assets/'+image.asset_id+'/thumbnail-preview'} alt={tr('Small thumbnail for review')}/>
    <p>{tr('Planned headline')}: {image.variant.text_overlay||tr('No overlay text')}</p>
    <form className="thumbnail-image-review" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const result=await act(()=>api('/projects/'+projectId+'/thumbnail-review/'+image.asset_id,'POST',{...form,asset_sha256:image.sha256,plan_hash:image.plan_hash,actual_text:text,notes}),'Thumbnail image review saved');if(result)onClose();else setError(tr('Could not save image review. Keep your checks and try again.'))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>
      {Object.entries(reviewLabels).map(([key,label])=><label key={key} className="check-row"><input type="checkbox" disabled={busy} checked={form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})}/>{tr(label)}</label>)}
      <Field label="Actual thumbnail text"><input maxLength={200} disabled={busy} value={text} onChange={e=>setText(e.target.value)}/></Field>
      <Field label="Image review notes"><textarea rows={2} maxLength={1500} disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      {error&&<p role="alert" className="error-text">{error}</p>}<div className="modal-actions"><Button type="button" disabled={busy} onClick={onClose}>{tr('Cancel')}</Button><Button primary type="submit" disabled={busy}>{tr('Save image review')}</Button></div>
    </form>
  </Modal>;
}
