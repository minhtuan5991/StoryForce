import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ThumbnailPackaging} from './ThumbnailPackaging';
import {api} from './api';
vi.mock('./api',async importOriginal=>({...await importOriginal<typeof import('./api')>(),api:vi.fn()}));
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
afterEach(()=>{cleanup();vi.clearAllMocks()});
const act=async(fn:()=>Promise<any>)=>fn();
const plan={content_fingerprint:'inputs-hash',plan_hash:'hash',recommended_thumbnail_variant:'A',recommendation_reason:'Concrete blueprint evidence',test_notes:'Keep title fixed and compare watch time.',visual_dna:{central_anomaly:'An impossible room'},official_sources:[],
 thumbnail_variants:['A','B','C'].map((id,i)=>({id,strategy:['concrete_anomaly','human_threat','atmospheric_context'][i],concept:['A room on the blueprint','A clerk examining the plan','A hallway that differs from the plan'][i],text_overlay:'',title_complement_reason:'The picture adds evidence',scores:{story_accuracy:90,clutter_risk:5},evidence_quotes:['Room 614 appeared on the blueprint.'],hypothesis:'An editorial hypothesis',generation_prompt:'Generate this concept',negative_prompt:'No ghost'}))};
const project:any={id:'p',locked:true,jobs:[],settings:{},thumbnail_packaging:{plan,current:true,selected_variant:'A',assets:{},channel_style:{}}};

it('shows distinct concepts and treats text and image review separately',()=>{
 render(<ThumbnailPackaging project={project} act={act}/>);
 expect(screen.getByText('A · Concrete visual anomaly')).toBeInTheDocument();
 expect(screen.getByText('B · Human stakes')).toBeInTheDocument();
 expect(screen.getByText('C · Atmosphere and setting')).toBeInTheDocument();
 expect(screen.getAllByText('No overlay text')).toHaveLength(4);
 expect(screen.getByText(/Concept scores are not measurements/)).toBeInTheDocument();
});

it('saves optional no-text styling and blocks generation while inputs are dirty',async()=>{
 vi.mocked(api).mockImplementation(async(_path,_method,body)=>body);
 render(<ThumbnailPackaging project={project} act={act}/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Thumbnail text mode'}),{target:{value:'NO_TEXT'}});
 expect(screen.getByRole('button',{name:'Create selected thumbnail image'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Save thumbnail style'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/thumbnail-style','PATCH',expect.objectContaining({text_usage:'NO_TEXT',typography:'LEGACY_2_3_FONTS'})));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Create selected thumbnail image'})).toBeEnabled());
});

it('creates all images only after explicit confirmation',async()=>{
 vi.mocked(api).mockResolvedValue({phase:'running'});
 render(<ThumbnailPackaging project={project} act={act}/>);
 fireEvent.click(screen.getByRole('button',{name:'Create all three thumbnail images'}));
 expect(api).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm three thumbnail images'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/media-automation/start','POST',{kind:'thumbnails',plan_hash:'hash',variants:['A','B','C']}));
});

it('requires actual image checks and records the asset and plan identity',async()=>{
 vi.mocked(api).mockResolvedValue({passed:true});
 const p={...project,thumbnail_packaging:{...project.thumbnail_packaging,assets:{A:{asset_id:'a',sha256:'sha',checks:{aspect_16_9:true,at_least_720p:true},review:{}}}}};
 render(<ThumbnailPackaging project={p} act={act}/>);
 expect(screen.getByText('Generated image awaiting visual review')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Review image A'}));
 expect(screen.getByText(/does not automatically verify/)).toBeInTheDocument();
 for(const name of ['Image matches the story','The anomaly is recognizable','Readable in the small preview','Text and meaningful prop labels are correct','No ending or major twist is revealed'])fireEvent.click(screen.getByRole('checkbox',{name}));
 fireEvent.change(screen.getByRole('textbox',{name:'Actual thumbnail text'}),{target:{value:'ROOM 614'}});
 fireEvent.click(screen.getByRole('button',{name:'Save image review'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/thumbnail-review/a','POST',expect.objectContaining({asset_sha256:'sha',plan_hash:'hash',actual_text:'ROOM 614',image_matches_story:true})));
});

it('keeps failed saves visible and prevents stale image choices',async()=>{
 vi.mocked(api).mockResolvedValue(undefined);
 render(<ThumbnailPackaging project={{...project,thumbnail_packaging:{...project.thumbnail_packaging,current:false}}} act={act}/>);
 expect(screen.getByRole('button',{name:'Choose concept A'})).toBeDisabled();
 fireEvent.change(screen.getByRole('combobox',{name:'Thumbnail color treatment'}),{target:{value:'STORY_DRIVEN'}});
 fireEvent.click(screen.getByRole('button',{name:'Save thumbnail style'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Could not save thumbnail style'));
 expect(screen.getByRole('combobox',{name:'Thumbnail color treatment'})).toHaveValue('STORY_DRIVEN');
});
