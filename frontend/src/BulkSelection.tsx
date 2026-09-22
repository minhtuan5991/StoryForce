import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { Row } from './api';
import { Button } from './components';
import { DeletionButton } from './DeletionButton';
import { tr } from './i18n';

export function usePageSelection(items:Row[] = []) {
  const [checked,setChecked]=useState<string[]>([]);
  const visible=items.map(item=>item.id as string);
  const key=JSON.stringify(visible);
  useEffect(()=>{const allowed=new Set<string>(JSON.parse(key));setChecked(previous=>previous.filter(id=>allowed.has(id)))},[key]);
  const ids=checked.filter(id=>visible.includes(id));
  return {ids,all:visible.length>0&&visible.every(id=>ids.includes(id)),
    toggle:(id:string)=>setChecked(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]),
    selectAll:()=>setChecked(visible),clear:()=>setChecked([])};
}

export function BulkToolbar({kind,selection,count,onDeleted,trailing}:{trailing?:ReactNode,kind:'jobs'|'projects',selection:ReturnType<typeof usePageSelection>,count:number,onDeleted:()=>void}) {
  return <div className="bulk-toolbar">
    <Button small disabled={!count} onClick={selection.all?selection.clear:selection.selectAll}>{tr(selection.all?'Clear selection':'Select all')}</Button>
    <DeletionButton kind={kind} ids={selection.ids} caption="Delete selected items" onDeleted={()=>{selection.clear();onDeleted()}}/>
    <span className="muted" role="status">{tr('Selected')}: {selection.ids.length} / {count}. {tr('Selection applies to this page.')}</span>{trailing}
  </div>;
}

export function ListPagination({page,total,onChange}:{page:number,total:number,onChange:(page:number)=>void}) {
  if(total<=50)return null;
  return <div className="bulk-toolbar"><Button disabled={!page} onClick={()=>onChange(page-1)}>{tr('Previous')}</Button><span>{tr('Page ')}{page+1} / {Math.ceil(total/50)}</span><Button disabled={(page+1)*50>=total} onClick={()=>onChange(page+1)}>{tr('Next')}</Button></div>;
}
