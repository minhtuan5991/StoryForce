import {useEffect, useRef, useState} from 'react';
import {ArrowRight, ArrowLeft, BookOpen, FileText, Inbox, Loader2, Plus, Search, Sparkles, Upload} from 'lucide-react';
import {api} from './api';
import type {Row} from './api';
import {Badge, Button, Empty, PageHead, Section, Status} from './components';
import {DeletionButton} from './DeletionButton';
import {SourceUsageNote} from './ProjectLabels';
import {tr} from './i18n';
import './source-collections.css';

type Collection = 'inbox' | 'library';
type Act = (fn:()=>Promise<any>, message?:string)=>Promise<any>;
export const sourceCollectionName = (collection:string)=>tr(collection==='library'?'Source library':'Content inbox');
const moveLabel = (target:Collection)=>tr(target==='library'?'Approve into library':'Return to inbox');
const moveMessage = (target:Collection)=>target==='library'?'Sources moved to library':'Sources returned to inbox';

export function SourceCollectionBadge({collection}:{collection:string}) {
  return <Badge tone={collection==='library'?'green':'amber'}>{sourceCollectionName(collection)}</Badge>;
}

export function SourceCollectionMoveButton({source,act,onMoved}:{source:Row,act:Act,onMoved?:(collection:Collection)=>void}) {
  const [busy,setBusy]=useState(false);
  const target:Collection=source.collection==='library'?'inbox':'library';
  return <Button disabled={busy} onClick={async()=>{
    setBusy(true);
    try {
      const result=await act(()=>api('/sources/collection','POST',{ids:[source.id],collection:target}),moveMessage(target));
      if(result)onMoved?.(target);
    } finally {setBusy(false)}
  }}>{busy?<Loader2 size={16} className="spin"/>:target==='library'?<BookOpen size={16}/>:<Inbox size={16}/>} {moveLabel(target)}</Button>;
}

export function SourceCollectionList({version,collection,act,refresh,onAdd}:{version:number,collection:Collection,act:Act,refresh:()=>void,onAdd:()=>void}) {
  const [query,setQuery]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
  const importInput=useRef<HTMLInputElement>(null);
  const [snapshot,setSnapshot]=useState<{path:string,data:Row}|null>(null),[error,setError]=useState('');
  const path='/sources?collection='+collection+'&q='+encodeURIComponent(query)+'&offset='+page*50;
  const data=snapshot?.path===path?snapshot.data:null;
  const library=collection==='library',target:Collection=library?'inbox':'library';
  useEffect(()=>{setQuery('');setPage(0);setSelected([])},[collection]);
  useEffect(()=>{
    let alive=true;
    setError('');
    const load=()=>api(path).then(result=>{if(alive){setSnapshot({path,data:result});setError('')}})
      .catch(e=>{if(alive)setError(e.message)});
    load();
    const timer=setInterval(()=>{if(!document.hidden)load()},5000);
    return()=>{alive=false;clearInterval(timer)};
  },[path,version]);
  const visibleIds:string[]=data?.items.map((s:Row)=>s.id)||[];
  useEffect(()=>{setSelected(ids=>ids.filter(id=>visibleIds.includes(id)))},[visibleIds.join(',')]);
  useEffect(()=>{if(data)setPage(p=>Math.min(p,Math.max(0,Math.ceil(data.total/50)-1)))},[data?.total]);
  async function move(ids:string[]) {
    setBusy(true);
    try {
      const result=await act(()=>api('/sources/collection','POST',{ids,collection:target}),moveMessage(target));
      if(result)setSelected([]);
    } finally {setBusy(false)}
  }
  async function analyze() {
    setBusy(true);
    try {
      const result=await act(async()=>{
        for(const source_id of selected)await api('/jobs','POST',{kind:'story_dna',source_id});
        return {count:selected.length};
      },'Analysis jobs queued');
      if(result)setSelected([]);
    } finally {setBusy(false)}
  }
  const updatePage=(next:number)=>{setPage(next);setSelected([])};
  return <>
    <PageHead eyebrow={tr(library?'YOUR INSPIRATION, ORGANIZED':'COLLECT THE NEXT GREAT IDEA')}
      title={sourceCollectionName(collection)}
      description={tr(library?'Analyzed or approved sources, ready to inspire your next story.':'New sources awaiting analysis or approval. Successful analysis moves them to the library.')}
      action={<>
        <Button disabled={busy} onClick={()=>importInput.current?.click()}><Upload size={16}/>{tr('Import TXT / MD / CSV')}</Button>
          <input ref={importInput} type="file" hidden disabled={busy} accept=".txt,.md,.csv" onChange={async e=>{
            const input=e.currentTarget,file=input.files?.[0];if(!file)return;
            setBusy(true);
            try {
              const body=new FormData();body.append('file',file);
              const result=await act(()=>api('/sources/import','POST',body),'New sources added to inbox');
              if(result){setQuery('');setPage(0);setSelected([])}
            } finally {setBusy(false);input.value=''}
          }}/>
        <Button primary disabled={busy} onClick={onAdd}><Plus size={17}/>{tr('Add source')}</Button>
      </>}/>
    <div className="notice compact source-collection-note"><span>{tr('New sources and imported files always enter the inbox. Moving a source keeps its content, analysis, channel and usage history.')}</span>
      <a className="text-link" href={library?'#/inbox':'#/library'}>{sourceCollectionName(target)}<ArrowRight size={14}/></a>
    </div>
    <div className="section-toolbar source-collection-toolbar">
      <span className="muted">{tr('{count} sources in this list',{count:data?.total??'…'})}</span>
      <div className="inline wrap">
        {selected.length>0&&<>
          <Button disabled={busy} onClick={analyze}><Sparkles size={15}/>{tr('Analyze ')}{selected.length}</Button>
          <Button disabled={busy} onClick={()=>move(selected)}>{busy?<Loader2 size={15} className="spin"/>:library?<Inbox size={15}/>:<BookOpen size={15}/>} {moveLabel(target)} ({selected.length})</Button>
          {!busy&&<DeletionButton kind="sources" ids={selected} onDeleted={()=>{setSelected([]);setPage(0);refresh()}}/>}
        </>}
        <div className="search-field"><Search size={16}/><input disabled={busy} aria-label={tr('Search sources')} placeholder={tr('Search sources…')}
          value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setSelected([])}}/></div>
      </div>
    </div>
    <Section>
      {error&&<div role="alert" className="notice error">{error}<Button small onClick={refresh}>{tr('Retry')}</Button></div>}
      {!data?(!error&&<div className="loading"><Loader2 className="spin"/> {tr('Loading sources…')}</div>):data.items.length?<div className="table-wrap"><table className="source-collection-table">
        <thead><tr><th><input type="checkbox" disabled={busy} aria-label={tr('Select all sources')}
          checked={visibleIds.length>0&&visibleIds.every(id=>selected.includes(id))} onChange={e=>setSelected(e.target.checked?visibleIds:[])}/></th>
          <th>{tr('Source')}</th><th>{tr('Language')}</th><th>{tr('Story DNA')}</th><th>{tr('Added')}</th><th>{tr('Actions')}</th></tr></thead>
        <tbody>{data.items.map((s:Row)=><tr key={s.id}>
          <td><input disabled={busy} aria-label={tr('Select ')+s.title} type="checkbox" checked={selected.includes(s.id)}
            onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))}/></td>
          <td><a className="table-title" href={'#/'+collection+'/'+s.id}><FileText size={17}/>{s.title}</a><SourceUsageNote count={s.usage_count}/>
            <small className="muted">{s.platform} · {(s.tags||[]).join(', ')||tr('No tags')}</small></td>
          <td>{s.language}</td><td><Status value={Object.keys(s.dna||{}).length?'ANALYZED':'PENDING'}/></td>
          <td>{new Date(s.created_at).toLocaleDateString()}</td>
          <td><div className="source-row-actions">
            <a className="text-link" href={'#/'+collection+'/'+s.id}>{tr('Explore')}<ArrowRight size={14}/></a>
            <Button small disabled={busy} onClick={()=>move([s.id])}>{library?<ArrowLeft size={14}/>:<BookOpen size={14}/>} {moveLabel(target)}</Button>
            {!busy&&<DeletionButton kind="sources" ids={[s.id]} title={s.title} onDeleted={()=>{setSelected([]);setPage(0);refresh()}}/>}
          </div></td>
        </tr>)}</tbody>
      </table></div>:<Empty
        title={tr(query?'No matching sources':library?'Your source library is empty':'Your content inbox is clear')}
        description={tr(query?'Try another search or clear the filter.':library?'Analyze an inbox source or approve it into the library to prepare your next story.':'Add a source here. Analyzed and approved sources are available in the Source library.')}
        action={query?<Button onClick={()=>{setQuery('');setPage(0)}}>{tr('Clear search')}</Button>:library?<a className="button primary" href="#/inbox">{tr('Open content inbox')}<ArrowRight size={16}/></a>:<div className="inline wrap"><Button primary onClick={onAdd}><Plus size={16}/>{tr('Add source')}</Button><a className="button" href="#/library">{tr('Open source library')}<ArrowRight size={16}/></a></div>}/>}</Section>
    {data&&data.total>50&&<div className="inline"><Button disabled={busy||!page} onClick={()=>updatePage(page-1)}>{tr('Previous')}</Button>
      <span>{tr('Page ')}{page+1}</span><Button disabled={busy||(page+1)*50>=data.total} onClick={()=>updatePage(page+1)}>{tr('Next')}</Button></div>}
  </>;
}
