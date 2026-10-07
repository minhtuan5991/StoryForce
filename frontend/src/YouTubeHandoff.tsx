import {useEffect,useState} from 'react';
import {Download,Sparkles,Check,Loader2} from 'lucide-react';
import {Section,Button,CopyButton,Modal,Badge} from './components';
import {api,downloadText} from './api';
import type {Row} from './api';
import {tr} from './i18n';
import {MetadataStrategyInputs,evidenceLabels} from './MetadataStrategyInputs';

const strategyLabels:Record<string,string>={concrete_anomaly:'Concrete anomaly',search_context:'Context / search',first_person_curiosity:'First person / curiosity'};
const scoreLabels:Record<string,string>={clarity:'Clarity',curiosity:'Curiosity',specificity:'Specificity',story_accuracy:'Story accuracy',suggested_fit:'Suggested fit',search_fit:'Search fit',channel_fit:'Channel fit',thumbnail_complement:'Thumbnail complement',genericness_risk:'Genericness risk',keyword_stuffing_risk:'Keyword stuffing risk'};

export function YouTubeHandoff({project:p,form,onApply,act}:{project:Row,form:Row,onApply:(fields:Row)=>void,act:(fn:()=>Promise<any>,message?:string)=>Promise<any>}){
  const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
  const [dirty,setDirty]=useState(false),[chosen,setChosen]=useState('');
  const artifact=p.artifacts.youtube_metadata,result=artifact?.content;
  const title=chosen||result?.recommended_title||result?.title||'';
  const variant=result?.title_variants?.find((v:Row)=>v.title===title);
  const semanticPairing=result?.score_provenance?.startsWith('editorial_ai_estimate_of_title_image_pairing');
  const overlap=semanticPairing?variant?.thumbnail_word_overlap??result?.thumbnail_title_word_overlap:variant?variant.scores?.thumbnail_complement==null?null:100-variant.scores.thumbnail_complement:result?.thumbnail_title_overlap_risk;
  useEffect(()=>{setChosen('');setConfirm(false)},[p.id,artifact?.id]);
  const active=p.jobs.some((j:Row)=>['queued','running','waiting_user'].includes(j.status));
  const generate=async()=>{
    setBusy(true);setError('');
    try{await act(()=>api('/jobs','POST',{kind:'youtube_metadata',project_id:p.id,payload:{auto_continue:false}}),'YouTube metadata queued in ChatGPT')}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  };
  const apply=()=>{onApply({title,description:result.description,tags:result.tags.join(', ')});setConfirm(false)};
  return <Section title={tr('YouTube upload package')} caption={tr('ChatGPT prepares three title strategies and story-specific metadata.')} action={<Button primary disabled={active||busy||dirty||!p.locked||!p.draft} onClick={()=>void generate()}>{busy?<Loader2 size={16} className="spin"/>:<Sparkles size={16}/>} {tr(result?'Regenerate with ChatGPT':'Generate with ChatGPT')}</Button>}>
    {!p.locked&&<p className="muted">{tr('Lock a finished story before generating YouTube metadata')}</p>}
    {active&&<a className="text-link" href={'#/jobs/'+p.id}>{tr('Follow the active task in Activity & jobs')}</a>}
    <p className="muted">{tr('Uses the channel language. Metadata is a suggestion; review the final video before uploading. No automatic upload or guarantee of ranking or approval.')}</p>
    <MetadataStrategyInputs key={p.id} project={p} act={act} onDirty={setDirty}/>
    {error&&<p role="alert" className="error-text">{error}</p>}
    {result&&<>
      <div className="inline wrap"><Badge tone={artifact.provider?.startsWith('mock')?'amber':'blue'}>{artifact.provider}</Badge><span className="muted">{tr('Version ')}{artifact.story_version} · {new Date(artifact.created_at).toLocaleString()}</span></div>
      {!p.youtube_metadata_current&&<p className="notice error">{tr('The story, media plan or channel changed. Regenerate metadata before uploading.')}</p>}
      <h3>{tr('YouTube title')}</h3><p className="readable-value">{title}</p><CopyButton text={title}/>
      {!!result.title_variants?.length&&<>
        <h3>{tr('Title test strategies')}</h3><p className="muted">{tr('Three editorial hypotheses to test. Scores use 0–100; benefit scores are higher-is-better, risk scores are lower-is-better. They do not predict CTR, retention or views.')}</p>
        <div className="metadata-variants">{result.title_variants.map((variant:Row)=><article className={'metadata-variant '+(title===variant.title?'selected':'')} key={variant.id}>
          <div className="inline wrap"><Badge tone="blue">{variant.id} · {tr(strategyLabels[variant.strategy]||variant.strategy)}</Badge>{variant.title===result.recommended_title&&<Badge tone="green">{tr('Recommended')}</Badge>}</div>
          <p>{variant.title}</p><div className="inline wrap"><CopyButton text={variant.title}/><Button small disabled={title===variant.title} onClick={()=>setChosen(variant.title)}>{tr('Choose title {id}',{id:variant.id})}</Button></div>
          <details><summary>{tr('Editorial scores')}</summary><dl className="metadata-scores">{Object.entries(variant.scores||{}).map(([key,value])=><div key={key}><dt>{tr(scoreLabels[key]||key)}</dt><dd>{value===null?'—':String(value)}</dd></div>)}</dl>{variant.thumbnail_complement_reason&&<p>{variant.thumbnail_complement_reason}</p>}{variant.evidence_quote&&<blockquote>{variant.evidence_quote}</blockquote>}</details>
        </article>)}</div>
      </>}
      {result.primary_keyword_cluster&&<div className="metadata-cluster"><h3>{tr('Primary keyword cluster')}</h3><strong>{result.primary_keyword_cluster.primary}</strong><p>{result.primary_keyword_cluster.secondary?.join(' · ')}</p><Badge>{tr(evidenceLabels[result.primary_keyword_cluster.evidence_type]||result.primary_keyword_cluster.evidence_type)}</Badge>
        {semanticPairing&&<p className="muted">{tr('Title and reviewed image complement')}: {variant?.scores?.thumbnail_complement==null?'—':variant.scores.thumbnail_complement+'/100'} · {tr('Editorial estimate using the image concept you confirmed; not an audience measurement.')}</p>}
        <p className="muted">{tr(semanticPairing?'Thumbnail word overlap':'Thumbnail overlap risk')}: {overlap===null||overlap===undefined?tr('Unknown thumbnail text'):overlap+'/100'} · {tr('Word-overlap heuristic; not an audience measurement.')}</p>
      </div>}
      <h3>{tr('Description')}</h3><p style={{whiteSpace:'pre-wrap'}}>{result.description}</p><CopyButton text={result.description}/>
      <h3>{tr('YouTube tags')}</h3><p>{result.tags.join(', ')}</p><CopyButton text={result.tags.join(', ')}/>
      {!!result.hashtags?.length&&<><h3>Hashtags</h3><p>{result.hashtags.join(' ')}</p><CopyButton text={result.hashtags.join(' ')}/></>}
      {!result.title_variants?.length&&!!result.alternative_titles?.length&&<details><summary>{tr('Alternative titles')}</summary><ul>{result.alternative_titles.map((title:string)=><li key={title}>{title}</li>)}</ul></details>}
      <details><summary>{tr('Packaging and upload review notes')}</summary>{result.metadata_notes&&<><p>{result.metadata_notes.title_reason}</p><p>{result.metadata_notes.suffix_decision}</p><p>{result.metadata_notes.search_vs_suggested_strategy}</p></>}<p>{result.seo_notes}</p><ul>{[...(result.review_notes||[]),...(result.metadata_notes?.accuracy_notes||[])].map((note:string,i:number)=><li key={i}>{note}</li>)}</ul>
        {!!result.keyword_evidence?.length&&<><h3>{tr('Creator-supplied keyword sources')}</h3><ul>{result.keyword_evidence.map((item:Row,i:number)=><li key={i}>{item.phrase} · {tr(evidenceLabels[item.evidence_type]||item.evidence_type)} · {item.source}</li>)}</ul></>}
        <p><a href="https://support.google.com/youtube/answer/12340300" target="_blank" rel="noreferrer">{tr('YouTube title guidance')}</a> · <a href="https://support.google.com/youtube/answer/146402" target="_blank" rel="noreferrer">{tr('YouTube tag guidance')}</a> · <a href="https://support.google.com/youtube/answer/16391400" target="_blank" rel="noreferrer">{tr('YouTube title testing')}</a></p>
      </details>
      <div className="inline wrap" style={{marginTop:20}}><a className="button" href={'/api/projects/'+p.id+'/download/youtube_metadata.txt'}><Download size={16}/>{tr('Download ChatGPT TXT')}</a><Button disabled={!p.youtube_metadata_current||dirty} onClick={()=>setConfirm(true)}><Check size={16}/>{tr('Use in publishing form')}</Button></div>
    </>}
    <div className="inline wrap" style={{marginTop:16}}><Button small disabled={!form.title||!form.description} onClick={()=>downloadText('youtube_upload.txt',`VIDEO TITLE\n${form.title}\n\nDESCRIPTION\n${form.description}\n\nTAGS\n${form.tags||''}\n`)}><Download size={15}/>{tr('Export current form as TXT')}</Button></div>
    {confirm&&<Modal title={tr('Apply ChatGPT metadata?')} onClose={()=>setConfirm(false)}><p>{tr('This replaces the title, description and tags in the form below. Other publishing settings remain. Review and save the form when ready.')}</p><div className="modal-actions"><Button onClick={()=>setConfirm(false)}>{tr('Cancel')}</Button><Button primary onClick={apply}>{tr('Apply')}</Button></div></Modal>}
  </Section>;
}
