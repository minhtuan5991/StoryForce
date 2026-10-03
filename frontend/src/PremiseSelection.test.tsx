import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {PremiseChoice} from './PremiseSelection';
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
  expect(screen.getByRole('button',{name:'Selected'})).toBeDisabled();
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
