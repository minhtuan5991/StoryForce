import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {MediaSessions,mediaSessionUrl} from './MediaSessions';
import {FinalVideoDownload} from './FinalVideoDownload';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
const act=async(fn:()=>Promise<any>)=>fn();
const project={id:'p',locked:true,settings:{media_sessions:{gemini:{url:'https://gemini.google.com/app/saved'},flow:{url:'https://flow.google.com/project/saved'}}},jobs:[],
  assets:['one','two','three','four'].map(id=>({id,kind:'image',name:id+'.png'}))};

it('opens the saved project chats and restricts reference selection to three while allowing changes during TTS',async()=>{
  vi.mocked(api).mockResolvedValue({saved:true});
  render(<MediaSessions project={{...project,jobs:[{provider:'aistudio',status:'waiting_user',payload:{_media:{}}}]}} kind="visuals" act={act}/>);
  expect(screen.getByRole('link',{name:'Open this project’s Gemini chat'})).toHaveAttribute('href','https://gemini.google.com/app/saved');
  const boxes=screen.getAllByRole('checkbox');boxes.slice(0,3).forEach(box=>fireEvent.click(box));
  expect(boxes[3]).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Save character references'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/media-automation/references','POST',{asset_ids:['one','two','three']}));
});

it('does not change references while a visual scene is running and rejects a foreign session URL',()=>{
  const p={...project,jobs:[{provider:'flow',status:'waiting_user',payload:{_media:{}}}]};
  render(<MediaSessions project={p} kind="visuals" act={act}/>);
  expect(screen.getAllByRole('checkbox').every(box=>(box as HTMLInputElement).disabled)).toBe(true);
  expect(mediaSessionUrl({settings:{media_sessions:{gemini:{url:'https://evil.test/app/private'}}}},'gemini')).toBeUndefined();
});

it('final download uses the project-specific local save endpoint, blocks repeated clicks and reports its path',async()=>{
  let resolve:(value:any)=>void=()=>{};
  vi.mocked(api).mockReturnValue(new Promise(r=>{resolve=r}));
  render(<FinalVideoDownload projectId="chosen-project" act={act}/>);
  const button=screen.getByRole('button',{name:'final_video.mp4'});fireEvent.click(button);fireEvent.click(button);
  expect(api).toHaveBeenCalledTimes(1);expect(button).toBeDisabled();
  expect(api).toHaveBeenCalledWith('/projects/chosen-project/download-final','POST');
  resolve({saved:true,path:'C:\\Downloads\\Chosen project\\final_video.mp4'});
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('C:\\Downloads\\Chosen project\\final_video.mp4'));
  expect(button).toBeEnabled();
});
