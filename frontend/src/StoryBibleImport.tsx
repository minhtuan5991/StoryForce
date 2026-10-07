import {useState} from 'react';
import type {ReactNode} from 'react';
import {Check, Download, Loader2, Upload} from 'lucide-react';
import {api, downloadText} from './api';
import type {Row} from './api';
import {Button, Empty, Field, Modal, Readable, Section} from './components';
import {tr} from './i18n';

export const BIBLE_EXAMPLE = {
  summary: 'Describe the chosen story, its central conflict, progression and intended ending.',
  characters: [{name: 'Character name', job: 'Occupation', goal: 'Concrete goal',
    physical_traits: 'Consistent appearance', skills: [], knowledge: []}],
  world_rules: ['Describe a clear rule of the story world.'],
  locations: [], timeline: [], inventory: [], important_objects: [], setup_payoff_plan: [],
  ending_target: 'Intended payoff', forbidden_changes: [],
};

export function StoryBibleImport({project:p,active,act,artifact}:{project:Row,active:boolean,
  act:(fn:()=>Promise<any>,message?:string)=>Promise<any>,artifact?:ReactNode}) {
  const [open,setOpen]=useState(false),[text,setText]=useState(''),[error,setError]=useState('');
  const [preview,setPreview]=useState<Row|null>(null),[busy,setBusy]=useState(false);
  const started=!!p.draft||!!p.artifacts.outline||!!p.artifacts.outline_rewrite||p.locked;
  const close=()=>{if(!busy)setOpen(false)};
  const check=async()=>{
    setBusy(true);setError('');setPreview(null);
    try {const result=await api('/projects/'+p.id+'/story-bible/validate','POST',{content:text});setPreview(result.content)}
    catch(err){setError((err as Error).message)}finally{setBusy(false)}
  };
  const save=async()=>{
    if(busy)return;
    setBusy(true);setError('');
    try {
      const result=await act(()=>api('/projects/'+p.id+'/story-bible/import','POST',{content:text}).catch(err=>{setError(err.message);throw err}), 'Story Bible imported');
      if(result)setOpen(false);
    }catch(err){setError((err as Error).message)}finally{setBusy(false)}
  };
  return <Section title={tr('The ground truth of your story')}
    caption={tr('Import your existing Bible. Continue pipeline will start at Outline using this saved content.')}
    action={<Button primary disabled={active||started} title={started?tr('Import before creating the outline. Create a new project for a different Bible.'):undefined}
      onClick={()=>{setText('');setError('');setPreview(null);setOpen(true)}}><Upload size={16}/>{tr('Import Story Bible')}</Button>}>
    <div className="notice compact" role="status">{tr('Direction and Premises are skipped for this project. The imported Bible supplies the story input.')}</div>
    {artifact||<Empty title={tr('Your Story Bible is ready to import')} description={tr('Paste a JSON object or choose a .json file. Save it, then click Continue pipeline.')}/>}
    {open&&<Modal title={tr('Import Story Bible')} onClose={close} wide>
      <div className="inline wrap">
        <label className="button"><Upload size={16}/>{tr('Choose JSON file')}<input type="file" hidden disabled={busy} accept=".json,application/json"
          onChange={async event=>{const file=event.target.files?.[0];if(!file)return;setError('');setPreview(null);
            try{if(file.size>2_000_000)throw new Error(tr('Story Bible JSON must be smaller than 2 MB'));setText(await file.text())}
            catch(err){setError((err as Error).message)}event.target.value=''}}/></label>
        <Button disabled={busy} onClick={()=>downloadText('story_bible_example.json',JSON.stringify(BIBLE_EXAMPLE,null,2))}><Download size={16}/>{tr('Download JSON example')}</Button>
      </div>
      <Field label={tr('Story Bible JSON')} hint={tr('Required: summary, named characters and world_rules. Additional fields are preserved.')}>
        <textarea className="code-editor" rows={15} spellCheck={false} autoFocus value={text} disabled={busy}
          onChange={event=>{setText(event.target.value);setPreview(null);setError('')}} placeholder={'{\n  "summary": "...",\n  "characters": [{"name": "..."}],\n  "world_rules": ["..."]\n}'}/>
      </Field>
      {error&&<p className="error-text" role="alert">{tr(error)}</p>}
      {preview&&<details open><summary>{tr('JSON checked · preview')}</summary><Readable value={preview}/></details>}
      <div className="modal-actions"><Button disabled={busy} onClick={close}>{tr('Cancel')}</Button>
        <Button disabled={busy||!text.trim()} onClick={()=>void check()}>{tr('Check JSON')}</Button>
        <Button primary disabled={busy||!text.trim()} onClick={()=>void save()}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>} {tr('Save Story Bible')}</Button>
      </div>
    </Modal>}
  </Section>;
}
