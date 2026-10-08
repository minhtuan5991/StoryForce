import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {ResourceCleanup} from './ResourceCleanup';
import {api} from './api';
import {setInterfaceLanguage} from './i18n';

vi.mock('./api',()=>({api:vi.fn(),label:(v:string)=>v}));
beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(()=>{cleanup();vi.resetAllMocks();setInterfaceLanguage('en')});
const project={id:'p',title:'The Closed Door',settings:{},storage_folder:'H:/Data/projects/The Closed Door'};
const report={title:project.title,count:1,bytes:4096,files:[{path:'H:/Data/projects/The Closed Door/images/scene.png',bytes:4096}],
  final:'H:/Data/projects/The Closed Door/render/final_video.mp4',kept:[],was_current:true,blocked:false,blockers:[],confirmation:'exact-preview-token'};
const act=vi.fn(async(fn:()=>Promise<any>)=>await fn());
async function open(){fireEvent.click(screen.getByRole('button',{name:'Delete resource data'}));await screen.findByText('Files to remove: 1 · 0.00 MB')}

it('previews and cancels without deleting anything',async()=>{
  vi.mocked(api).mockResolvedValue(report);
  render(<ResourceCleanup project={project} active={false} act={act}/>);
  await open();
  expect(screen.getByText(/permanently removes source media/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledExactlyOnceWith('/projects/p/resources/cleanup-preview');
});

it('requires an unblocked preview before confirmation',async()=>{
  vi.mocked(api).mockResolvedValue({...report,blocked:true,reason:'Finish the active project job first.',blockers:[{id:'j',kind:'render',status:'running'}]});
  render(<ResourceCleanup project={project} active={false} act={act}/>);
  await open();
  expect(screen.getByRole('button',{name:'Confirm resource cleanup'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm resource cleanup'}));
  expect(api).toHaveBeenCalledTimes(1);
});

it('sends the preview token once and reports retained final and locked files',async()=>{
  let finish!:(value:any)=>void;
  vi.mocked(api).mockResolvedValueOnce(report).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
  render(<ResourceCleanup project={project} active={false} act={act}/>);
  await open();
  const confirm=screen.getByRole('button',{name:'Confirm resource cleanup'});
  fireEvent.click(confirm);fireEvent.click(confirm);
  expect(confirm).toBeDisabled();
  expect(api).toHaveBeenLastCalledWith('/projects/p/resources/cleanup','POST',{confirmation:report.confirmation});
  finish({removed_files:1,freed_bytes:4096,failed_files:[{path:'C:/Downloads/locked.wav'}],final:'H:/Data/projects/The Closed Door/final_video.mp4'});
  expect(await screen.findByText('C:/Downloads/locked.wav')).toBeInTheDocument();
  expect(screen.getByText(/Final video kept: H:/)).toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(2);
});

it('refreshes a changed preview and leaves deletion available only with the new token',async()=>{
  vi.mocked(api).mockResolvedValueOnce(report).mockRejectedValueOnce(new Error('Project resources changed. Review the cleanup preview again.')).mockResolvedValueOnce({...report,confirmation:'new-token'});
  render(<ResourceCleanup project={project} active={false} act={act}/>);
  await open();fireEvent.click(screen.getByRole('button',{name:'Confirm resource cleanup'}));
  await waitFor(()=>expect(api).toHaveBeenCalledTimes(3));
  expect(screen.getByRole('alert')).toHaveTextContent('Project resources changed');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm resource cleanup'})).toBeEnabled());
});

it('keeps the final download available and requires explicit reopening of production',async()=>{
  const archived={...project,settings:{resource_cleanup:{status:'completed'}}};
  vi.mocked(api).mockResolvedValue({resumed:true});
  render(<ResourceCleanup project={archived} active={false} act={act}/>);
  expect(screen.getByRole('button',{name:'final_video.mp4'})).toBeEnabled();
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Recreate resources'}));
  await waitFor(()=>expect(api).toHaveBeenCalledExactlyOnceWith('/projects/p/resources/resume','POST'));
});

it('shows the requested Vietnamese button and prevents cleanup while working',()=>{
  setInterfaceLanguage('vi');
  render(<ResourceCleanup project={project} active={true} act={act}/>);
  expect(screen.getByRole('button',{name:'Xóa dữ liệu Tài Nguyên'})).toBeDisabled();
  expect(api).not.toHaveBeenCalled();
});
