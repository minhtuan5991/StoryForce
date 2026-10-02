import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {MediaAutomation} from './MediaAutomation';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
const project={id:'p',locked:true,chunks:[{id:'c'}],scenes:[{id:'s'}],settings:{},jobs:[]};
const act=async(fn:()=>Promise<any>)=>fn();
afterEach(()=>{cleanup();vi.clearAllMocks()});

it('narration starts immediately without a count confirmation',async()=>{
  vi.mocked(api).mockResolvedValue({phase:'running'});
  render(<MediaAutomation project={project} kind="tts" active={false} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Create and download narration'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/media-automation/start','POST',{kind:'tts',regenerate:false}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('visuals only start after the user sees and confirms the exact counts',async()=>{
  const preview={confirmation:'current-plan',image_count:12,video_count:3,download_path:'Downloads/Project'};
  vi.mocked(api).mockResolvedValueOnce(preview).mockResolvedValue({phase:'running'});
  render(<MediaAutomation project={project} kind="visuals" active={false} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Review image/video counts'}));
  await screen.findByRole('dialog');
  expect(api).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/12 images.*3 videos/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(api).toHaveBeenCalledTimes(1);
  vi.mocked(api).mockResolvedValueOnce(preview);
  fireEvent.click(screen.getByRole('button',{name:'Review image/video counts'}));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button',{name:'Confirm counts and create resources'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/media-automation/start','POST',{kind:'visuals',regenerate:false,confirmation:'current-plan',image_count:12,video_count:3}));
});
