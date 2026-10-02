import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeAll,it,expect,vi} from 'vitest';
import {CapCutExport} from './CapCutExport';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.setAttribute('open','')});HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.removeAttribute('open')})});
afterEach(()=>{cleanup();vi.clearAllMocks()});

it('exports to the detected draft folder and shows a usable native-project result',async()=>{
  vi.mocked(api).mockImplementation(async(path)=>path==='/capcut'?{drafts_folder:'D:\\CapCut Drafts'}:
    path==='/projects/p/export-capcut'?{id:'j',status:'queued',progress:0}:
    {id:'j',status:'completed',progress:100,result:{folder:'D:\\CapCut Drafts\\New project'}});
  render(<CapCutExport projectId="p"/>);
  fireEvent.click(screen.getByRole('button',{name:/Export CapCut project/}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'CapCut drafts folder'})).toHaveValue('D:\\CapCut Drafts'));
  fireEvent.click(screen.getByRole('dialog').querySelector('button.primary')!);
  expect(await screen.findByText('CapCut project ready')).toBeInTheDocument();
  expect(screen.getByText('D:\\CapCut Drafts\\New project')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/projects/p/export-capcut','POST',{drafts_folder:'D:\\CapCut Drafts'});
});

it('does not submit duplicate exports while starting and lets errors be retried',async()=>{
  let reject!:(reason:Error)=>void;
  vi.mocked(api).mockImplementation((path)=>path==='/capcut'?Promise.resolve({drafts_folder:'D:\\Drafts'}):new Promise((_r,r)=>{reject=r}) as any);
  render(<CapCutExport projectId="p"/>);fireEvent.click(screen.getByRole('button',{name:/Export CapCut project/}));
  await screen.findByDisplayValue('D:\\Drafts');
  fireEvent.click(screen.getByRole('dialog').querySelector('button.primary')!);
  const busy=screen.getByRole('button',{name:'Exporting CapCut project…'});
  expect(busy).toBeDisabled();fireEvent.click(busy);
  expect(vi.mocked(api).mock.calls.filter(c=>c[0]==='/projects/p/export-capcut')).toHaveLength(1);
  reject(new Error('Choose a valid drafts folder'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid drafts folder');
  expect(screen.getByRole('dialog').querySelector('button.primary')).toBeEnabled();
});
