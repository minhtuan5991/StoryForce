import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {YouTubeHandoff} from './YouTubeHandoff';
import {api} from './api';
vi.mock('./api',async importOriginal=>({...await importOriginal<typeof import('./api')>(),api:vi.fn()}));
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
afterEach(()=>{cleanup();vi.clearAllMocks()});
const act=async(fn:()=>Promise<any>)=>fn();
const titles=['Room 614 Appeared on the Blueprint','The Hotel Blueprint Grew a New Room','I Printed Plans for a Room That Did Not Exist'];
const result={title:titles[0],recommended_title:titles[0],description:'A fictional story about a strange hotel blueprint.',tags:['hotel mystery','blueprint','fiction','narration'],hashtags:['#HotelMystery','#Fiction'],
  title_variants:titles.map((title,i)=>({id:'ABC'[i],strategy:['concrete_anomaly','search_context','first_person_curiosity'][i],title,evidence_quote:'Room 614 appeared on the blueprint.',scores:{clarity:90,thumbnail_complement:null,genericness_risk:5}})),
  primary_keyword_cluster:{primary:'hotel mystery story',secondary:['impossible room'],evidence_type:'story_semantic'},thumbnail_title_overlap_risk:null,
  metadata_notes:{title_reason:'Concrete premise.',suffix_decision:'No suffix necessary.',search_vs_suggested_strategy:'Packaging first.',accuracy_notes:[]},review_notes:[]};
const project:any={id:'p',channel:{settings:{}},settings:{},locked:true,draft:'Room 614 appeared on the blueprint.',jobs:[],youtube_metadata_current:true,
  artifacts:{youtube_metadata:{id:'a',provider:'chatgpt',story_version:1,created_at:'2026-10-07T10:00:00Z',content:result}}};
function setup(p=project){const onApply=vi.fn();render(<YouTubeHandoff project={p} form={{title:'Previous title',description:'Previous description',tags:'saved'}} onApply={onApply} act={act}/>);return onApply}

it('shows three labeled strategies, unknown overlap and editorial provenance',()=>{
  setup();
  expect(screen.getByText('A · Concrete anomaly')).toBeInTheDocument();
  expect(screen.getByText('B · Context / search')).toBeInTheDocument();
  expect(screen.getByText('C · First person / curiosity')).toBeInTheDocument();
  expect(screen.getByText(/Unknown thumbnail text/)).toBeInTheDocument();
  expect(screen.getByText(/They do not predict CTR/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Choose title A'})).toBeDisabled();
});

it('separates reviewed visual complement from lexical overlap and explains the pairing',()=>{
  const reviewed={...result,score_provenance:'editorial_ai_estimate_of_title_image_pairing',thumbnail_title_word_overlap:100,
    title_variants:result.title_variants.map(v=>({...v,thumbnail_word_overlap:100,thumbnail_complement_reason:'Repeated room number identifies the evidence.',scores:{...v.scores,thumbnail_complement:85}}))};
  setup({...project,artifacts:{youtube_metadata:{...project.artifacts.youtube_metadata,content:reviewed}}});
  expect(screen.getByText(/Title and reviewed image complement: 85\/100/)).toBeInTheDocument();
  expect(screen.getByText(/Thumbnail word overlap: 100\/100/)).toBeInTheDocument();
  expect(screen.getAllByText('Repeated room number identifies the evidence.')).toHaveLength(3);
});

it('applies a selected alternative only after explicit confirmation',()=>{
  const onApply=setup();
  fireEvent.click(screen.getByRole('button',{name:'Choose title B'}));
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Use in publishing form'}));
  fireEvent.click(screen.getByRole('button',{name:'Apply',exact:true}));
  expect(onApply).toHaveBeenCalledWith({title:titles[1],description:result.description,tags:result.tags.join(', ')});
});

it('keeps unknown percentages blank, saves measured zero and blocks generation while dirty',async()=>{
  vi.mocked(api).mockImplementation(async(_path,_method,body)=>body);
  setup();
  expect(screen.getByRole('spinbutton',{name:'Suggested traffic (%)'})).toHaveValue(null);
  fireEvent.change(screen.getByRole('spinbutton',{name:'Suggested traffic (%)'}),{target:{value:'0'}});
  fireEvent.change(screen.getByRole('textbox',{name:'Actual thumbnail text'}),{target:{value:'ROOM 614'}});
  expect(screen.getByRole('button',{name:'Regenerate with ChatGPT'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Use in publishing form'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Save metadata strategy inputs'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/metadata-settings','PATCH',expect.objectContaining({
    thumbnail_text:'ROOM 614',channel_preferences:expect.objectContaining({traffic_profile:{suggested_percent:0,browse_percent:null,search_percent:null}})
  })));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Regenerate with ChatGPT'})).toBeEnabled());
});

it('shows save errors and retains unsaved inputs for retry',async()=>{
  vi.mocked(api).mockRejectedValue(new Error('Traffic percentages cannot total more than 100%'));
  setup();
  fireEvent.change(screen.getByRole('spinbutton',{name:'Suggested traffic (%)'}),{target:{value:'80'}});
  fireEvent.click(screen.getByRole('button',{name:'Save metadata strategy inputs'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('cannot total more than 100%'));
  expect(screen.getByRole('spinbutton',{name:'Suggested traffic (%)'})).toHaveValue(80);
  expect(screen.getByRole('button',{name:'Regenerate with ChatGPT'})).toBeDisabled();
});

it('keeps dirty input visible when the app reports a save failure through its global notification',async()=>{
  vi.mocked(api).mockResolvedValue(undefined);
  setup();
  fireEvent.change(screen.getByRole('textbox',{name:'Actual thumbnail text'}),{target:{value:'ROOM 614'}});
  fireEvent.click(screen.getByRole('button',{name:'Save metadata strategy inputs'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Could not save inputs'));
  expect(screen.getByRole('textbox',{name:'Actual thumbnail text'})).toHaveValue('ROOM 614');
  expect(screen.getByRole('button',{name:'Regenerate with ChatGPT'})).toBeDisabled();
});

it('adds attributed keyword evidence without requiring it by default',async()=>{
  vi.mocked(api).mockImplementation(async(_path,_method,body)=>body);
  setup();
  fireEvent.click(screen.getByRole('button',{name:'Add keyword evidence'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Keyword phrase 1'}),{target:{value:'hotel mystery story'}});
  fireEvent.change(screen.getByRole('combobox',{name:'Evidence type 1'}),{target:{value:'youtube_analytics'}});
  expect(screen.getByRole('textbox',{name:'Evidence source 1'})).toBeRequired();
  fireEvent.change(screen.getByRole('textbox',{name:'Evidence source 1'}),{target:{value:'Studio > Reach'}});
  fireEvent.click(screen.getByRole('button',{name:'Save metadata strategy inputs'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/metadata-settings','PATCH',expect.objectContaining({channel_preferences:expect.objectContaining({
    keyword_evidence:[{phrase:'hotel mystery story',evidence_type:'youtube_analytics',source:'Studio > Reach',notes:''}]
  })})));
});

it('keeps legacy metadata usable and disables applying stale packages',()=>{
  const old={...project,youtube_metadata_current:false,artifacts:{youtube_metadata:{...project.artifacts.youtube_metadata,content:{title:'Legacy title',description:'Old description.',tags:['fiction'],alternative_titles:['Another title']}}}};
  setup(old);
  expect(screen.getByText('Legacy title')).toBeInTheDocument();
  expect(screen.getByText('Alternative titles')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Use in publishing form'})).toBeDisabled();
  expect(screen.getByRole('link',{name:'Download ChatGPT TXT'})).toHaveAttribute('href','/api/projects/p/download/youtube_metadata.txt');
});
