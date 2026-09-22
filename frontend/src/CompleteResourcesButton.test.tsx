import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeAll,it,expect,vi} from 'vitest';
import {CompleteResourcesButton} from './CompleteResourcesButton';
import {api,navigate} from './api';
vi.mock('./api',()=>({api:vi.fn(),navigate:vi.fn()}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn()});
afterEach(()=>{cleanup();vi.clearAllMocks()});
const job={id:'tts1',project_id:'p1'};
it('lists missing files and keeps the job waiting',async()=>{
  vi.mocked(api).mockResolvedValue({completed:false,validation:{narration:[1,2],visuals:[2,3],missing:['tts_002.wav','scene_003.mp4']}});
  const done=vi.fn();render(<CompleteResourcesButton job={job} onCompleted={done}/>);
  fireEvent.click(screen.getByRole('button',{name:'All resources uploaded'}));
  expect(await screen.findByText('tts_002.wav')).toBeInTheDocument();expect(screen.getByText('scene_003.mp4')).toBeInTheDocument();
  expect(done).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();
});
it('submits once while busy and opens the timeline only after completion',async()=>{
  let resolve!:(value:unknown)=>void;vi.mocked(api).mockImplementation(()=>new Promise(r=>{resolve=r}) as any);
  const done=vi.fn();render(<CompleteResourcesButton job={job} onCompleted={done}/>);
  fireEvent.click(screen.getByRole('button',{name:'All resources uploaded'}));
  const busy=screen.getByRole('button',{name:'Checking resources…'});expect(busy).toBeDisabled();fireEvent.click(busy);
  expect(api).toHaveBeenCalledTimes(1);resolve({completed:true,project_id:'p1'});
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/projects/p1/timeline'));expect(done).toHaveBeenCalledOnce();
});
