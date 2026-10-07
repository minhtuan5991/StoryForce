import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {DeletionButton} from './DeletionButton';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn(),label:(v:string)=>v}));
beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(()=>{cleanup();vi.clearAllMocks()});
it('explains a protected shared idea list and disables confirmation',async()=>{
  vi.mocked(api).mockResolvedValue({items:[{id:'pool',title:'Original project'}],warnings:[],projects:[],blocked:true,blockers:[{id:'pool',kind:'Shared idea list',status:'Protected',project_title:'Original project'}]});
  render(<DeletionButton kind="projects" ids={['pool']} title="Original project" onDeleted={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Delete Original project'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm deletion'})).toBeDisabled());
  expect(await screen.findByText('The original idea list is protected.')).toBeInTheDocument();
  expect(screen.queryByText('Cannot delete while related work is active.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Confirm deletion'}));
  expect(api).toHaveBeenCalledTimes(1);
});
