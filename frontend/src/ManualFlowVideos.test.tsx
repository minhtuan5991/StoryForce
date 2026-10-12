import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ManualFlowVideos} from './ManualFlowVideos';

const project={id:'story',scenes:[{id:'still',number:1,visual_type:'IMAGE'},
  {id:'video',number:2,visual_type:'VIDEO',generation_prompt:'Full video prompt with character identity'}],
  assets:[],settings:{media_sessions:{flow:{url:'https://flow.google.com/project/our-story'}}},
  manual_video_references:[{id:'reference',name:'character_reference.png'}]};
afterEach(()=>{cleanup();vi.restoreAllMocks()});

it('shows the project Flow link, shared character reference and exact import filename',()=>{
  render(<ManualFlowVideos project={project}/>);
  expect(screen.getByRole('link',{name:'Open Flow'})).toHaveAttribute('href','https://flow.google.com/project/our-story');
  expect(screen.getByRole('link',{name:'Download reference: character_reference.png'})).toHaveAttribute('download','character_reference.png');
  expect(screen.getByText('scene_002.mp4')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Import videos in Assets'})).toHaveAttribute('href','#/projects/story/assets');
  expect(screen.queryByText('scene_001.mp4')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Queue in bridge'})).not.toBeInTheDocument();
});

it('copies the complete prompt without creating any Flow job',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  render(<ManualFlowVideos project={project}/>);
  fireEvent.click(screen.getByRole('button',{name:'Copy video prompt'}));
  await waitFor(()=>expect(writeText).toHaveBeenCalledWith('Full video prompt with character identity'));
  expect(await screen.findByRole('button',{name:'Copied'})).toBeInTheDocument();
});

it('distinguishes an attached video from an image or a missing clip',()=>{
  render(<ManualFlowVideos project={{...project,scenes:[{...project.scenes[1],asset_id:'clip'}],assets:[{id:'clip',kind:'video'}]}}/>);
  expect(screen.getByText('Video attached')).toBeInTheDocument();
  cleanup();
  render(<ManualFlowVideos project={{...project,scenes:[{...project.scenes[1],asset_id:'still'}],assets:[{id:'still',kind:'image'}],manual_video_references:[]}}/>);
  expect(screen.getByText('Create manually in Flow')).toBeInTheDocument();
  expect(screen.getByText('Character references will appear here after their images are ready.')).toBeInTheDocument();
});

it('does not add a manual video panel to a project planned entirely with images',()=>{
  const {container}=render(<ManualFlowVideos project={{...project,scenes:[project.scenes[0]]}}/>);
  expect(container).toBeEmptyDOMElement();
});
