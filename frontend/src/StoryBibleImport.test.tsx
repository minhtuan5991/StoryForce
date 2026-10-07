import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {StoryBibleImport} from './StoryBibleImport';
import {api} from './api';
vi.mock('./api',async importOriginal=>({...await importOriginal<typeof import('./api')>(),api:vi.fn()}));
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
afterEach(()=>{cleanup();vi.clearAllMocks()});
const project:any={id:'p',settings:{entry_mode:'existing_bible'},artifacts:{},draft:'',locked:false};
const act=async(fn:()=>Promise<any>)=>{try{return await fn()}catch{return null}};

it('validates pasted content without saving or starting a pipeline',async()=>{
  const content={summary:'My story',characters:[{name:'Ethan'}],world_rules:['Do not open the relay']};
  vi.mocked(api).mockResolvedValue({valid:true,content});
  render(<StoryBibleImport project={project} active={false} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Import Story Bible'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:JSON.stringify(content)}});
  fireEvent.click(screen.getByRole('button',{name:'Check JSON'}));
  await screen.findByText('JSON checked · preview');
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith('/projects/p/story-bible/validate','POST',{content:JSON.stringify(content)});
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('keeps pasted text and the dialog open when validation fails',async()=>{
  vi.mocked(api).mockRejectedValue(new Error('Story Bible requires a non-empty summary'));
  render(<StoryBibleImport project={project} active={false} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Import Story Bible'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'{}'}});
  fireEvent.click(screen.getByRole('button',{name:'Save Story Bible'}));
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox')).toHaveValue('{}');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Save Story Bible'})).toBeEnabled();
});

it('saves valid content once and closes without starting generation',async()=>{
  vi.mocked(api).mockResolvedValue({id:'bible'});
  render(<StoryBibleImport project={project} active={false} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Import Story Bible'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'{"summary":"Saved"}'}});
  fireEvent.click(screen.getByRole('button',{name:'Save Story Bible'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith('/projects/p/story-bible/import','POST',{content:'{"summary":"Saved"}'});
});

it('prevents replacing a Bible after an outline exists',()=>{
  render(<StoryBibleImport project={{...project,artifacts:{outline:{id:'outline'}}}} active={false} act={act}/>);
  expect(screen.getByRole('button',{name:'Import Story Bible'})).toBeDisabled();
});
