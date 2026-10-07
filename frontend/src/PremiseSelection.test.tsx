import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {PremiseChoice,PremiseProjectNotice} from './PremiseSelection';
import {api,navigate} from './api';
vi.mock('./api',()=>({api:vi.fn(),navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
const premise={id:'second',warnings:[]};
const project={id:'finished',selected_premise_id:'first',premise_reuse:{ready:true}};
const act=async(fn:()=>Promise<any>)=>fn();
it('opens the newly created project without navigating back to the finished one',async()=>{
  vi.mocked(api).mockResolvedValue({id:'new-story'});
  render(<PremiseChoice project={project} premise={premise} active={false} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Create new project'}));
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/projects/new-story/bible'));
  expect(api).toHaveBeenCalledWith('/projects/finished/select-premise','POST',{premise_id:'second'});
});
it('keeps the selected idea and unfinished projects unavailable for branching',()=>{
  const view=render(<PremiseChoice project={{...project,premise_reuse:{ready:false}}} premise={premise} active={false} act={act}/>);
  expect(screen.getByRole('button')).toBeDisabled();
  view.rerender(<PremiseChoice project={project} premise={{...premise,id:'first'}} active={false} act={act}/>);
  expect(screen.getByRole('button',{name:'Used premise'})).toBeDisabled();
  expect(api).not.toHaveBeenCalled();
});
it('disables an idea already used by another project in the original pool',()=>{
  render(<PremiseChoice project={{...project,premise_pool:{used_premise_ids:['second']}}} premise={premise} active={false} act={act}/>);
  expect(screen.getByRole('button',{name:'Used premise'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button'));
  expect(api).not.toHaveBeenCalled();
});
it('prevents duplicate submits while creating the new project and preserves the page on failure',async()=>{
  let reject!:(reason:Error)=>void;
  vi.mocked(api).mockImplementation(()=>new Promise((_,r)=>{reject=r}));
  render(<PremiseChoice project={project} premise={premise} active={false} act={act}/>);
  const button=screen.getByRole('button');fireEvent.click(button);fireEvent.click(button);
  expect(api).toHaveBeenCalledTimes(1);expect(button).toBeDisabled();
  reject(new Error('Render is still running'));
  await waitFor(()=>expect(button).toBeEnabled());expect(navigate).not.toHaveBeenCalled();
});
it('opens a used idea project without posting another choice, even while work is active',()=>{
  render(<PremiseChoice project={{...project,premise_pool:{used_premise_ids:['second'],used_projects:{second:{project_id:'created',deleted:false}}}}} premise={premise} active act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open created project'}));
  expect(navigate).toHaveBeenCalledWith('/projects/created/bible');
  expect(api).not.toHaveBeenCalled();
});
it('keeps a deleted used idea disabled',()=>{
  render(<PremiseChoice project={{...project,premise_pool:{used_premise_ids:['second'],used_projects:{second:{project_id:null,deleted:true}}}}} premise={premise} active={false} act={act}/>);
  expect(screen.getByRole('button',{name:'Used premise · project deleted'})).toBeDisabled();
});
it('identifies derived projects and only links to a surviving original pool',()=>{
  const view=render(<PremiseProjectNotice project={{settings:{premise_origin:{project_id:'pool'}},premise_pool:{project_id:'pool',project_exists:true}}}/>);
  expect(screen.getByText('Project from premise')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href','#/projects/pool/premises');
  view.rerender(<PremiseProjectNotice project={{settings:{premise_origin:{project_id:'pool'}},premise_pool:{project_id:'pool',project_exists:false}}}/>);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
