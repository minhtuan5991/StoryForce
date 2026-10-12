import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ChannelDNA} from './ChannelGuidance';
import {api} from './api';
vi.mock('./api',async()=>({...await vi.importActual('./api'),api:vi.fn()}));
const content={identity:{audience_promise:'Family choices with a credible explanation'},global_rules:['Earn the reversal'],avoid:['Unseeded explanations'],hook_examples:[],
  step_rules:{ideas:['Translate source appeal'],review:['Respect plausible human motives']},research:{mode:'dna_only',sources:[],notes:'Compiled from saved DNA'}};
const record={id:'g2',version:2,status:'draft',stale:false,origin:'chatgpt',content};
const channel={id:'c',name:'Heart & Hurdles',dna:{tone:'Intimate drama',creative_brief:{audience_promise:'Family choices'}},creative_guidance:{items:[record],active_id:null}};
afterEach(()=>{cleanup();vi.clearAllMocks()});

it('shows a preview and applies only after the explicit button',async()=>{
  vi.mocked(api).mockResolvedValue({});const changed=vi.fn();
  render(<ChannelDNA channel={channel} onChanged={changed}/>);
  expect(screen.getByText('Family choices with a credible explanation')).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Apply guidance'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/channels/c/guidance/g2/apply','POST',{}));
  expect(changed).toHaveBeenCalled();
});
it('rejects stale and partial versions with a visible explanation',()=>{
  const {rerender}=render(<ChannelDNA channel={{...channel,creative_guidance:{items:[{...record,stale:true}]}}} onChanged={()=>{}}/>);
  expect(screen.getByRole('button',{name:'Apply guidance'})).toBeDisabled();
  expect(screen.getByText(/belongs to an older DNA version/)).toBeInTheDocument();
  rerender(<ChannelDNA channel={{...channel,creative_guidance:{items:[{...record,status:'researching',content:{},completed_parts:1,total_parts:3,jobs:[]}]}}} onChanged={()=>{}}/>);
  expect(screen.getByRole('button',{name:'Apply guidance'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Resume incomplete research'})).not.toBeDisabled();
});
it('blocks research while DNA edits are unsaved and surfaces save errors',async()=>{
  vi.mocked(api).mockRejectedValue(new Error('Invalid creative brief'));
  render(<ChannelDNA channel={channel} onChanged={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit JSON'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Channel DNA'}),{target:{value:'{"tone":"Changed"}'}});
  expect(screen.getByRole('button',{name:'Research channel DNA'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Apply guidance'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid creative brief');
  expect(screen.getByRole('textbox',{name:'Channel DNA'})).toHaveValue('{"tone":"Changed"}');
});
it('queues research and disables repeat clicks during the request',async()=>{
  let finish:(value:any)=>void=()=>{};vi.mocked(api).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
  render(<ChannelDNA channel={channel} onChanged={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Research channel DNA'}));
  expect(screen.getByRole('button',{name:'Research channel DNA'})).toBeDisabled();
  expect(api).toHaveBeenCalledWith('/channels/c/research-dna','POST',{regenerate:true});
  finish({guidance_id:'g3'});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Research channel DNA'})).not.toBeDisabled());
});
it('keeps Midnight legacy directions and exposes restoration explicitly',async()=>{
  vi.mocked(api).mockResolvedValue({});
  const {rerender}=render(<ChannelDNA channel={{...channel,name:'The Midnight Log',creative_guidance:{items:[],legacy:true}}} onChanged={()=>{}}/>);
  expect(screen.getByText(/keeps its current prompts and settings/)).toBeInTheDocument();
  rerender(<ChannelDNA channel={{...channel,creative_guidance:{items:[{...record,status:'archived'}]}}} onChanged={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Restore this guidance'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/channels/c/guidance/g2/apply','POST',{}));
});
