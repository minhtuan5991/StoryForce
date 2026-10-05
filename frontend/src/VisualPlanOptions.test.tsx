import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {VisualPlanOptions} from './VisualPlanOptions';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
afterEach(()=>{cleanup();vi.clearAllMocks()});
const project={id:'p',locked:true,settings:{},scenes:[],visual_budget:{mode:'standard',image_count:8,video_count:3,standard:{image_count:8,video_count:3},minimum:{image_count:4,video_count:2}}};
const act=async(fn:()=>Promise<any>)=>fn();

it('shows half counts then saves chosen mode before starting generation',async()=>{
  vi.mocked(api).mockResolvedValue({mode:'minimum'});const run=vi.fn();
  render(<VisualPlanOptions project={project} active={false} act={act} run={run}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Visual plan mode'}),{target:{value:'minimum'}});
  expect(screen.getByRole('spinbutton',{name:'Image count'})).toHaveValue(4);
  expect(screen.getByRole('spinbutton',{name:'Video count'})).toHaveValue(2);
  fireEvent.click(screen.getByRole('button',{name:'Create visual plan'}));
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm counts and create resources'}));
  await waitFor(()=>expect(run).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith('/projects/p/visual-options','PATCH',expect.objectContaining({mode:'minimum'}));
  expect(run).toHaveBeenCalledWith({automatic_resources:true,confirmed_image_count:4,confirmed_video_count:2});
});

it('validates custom counts and does not generate when saving fails',async()=>{
  const run=vi.fn();
  render(<VisualPlanOptions project={project} active={false} act={async()=>undefined} run={run}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Visual plan mode'}),{target:{value:'custom'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Image count'}),{target:{value:'0'}});
  expect(screen.getByRole('button',{name:'Create visual plan'})).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton',{name:'Image count'}),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Create visual plan'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm counts and create resources'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Create visual plan'})).toBeEnabled());
  expect(run).not.toHaveBeenCalled();
});

it('allows reviewing new counts during automatic TTS and requires confirmation before queueing visuals',async()=>{
  vi.mocked(api).mockResolvedValue({mode:'custom'});const run=vi.fn();
  const running={...project,jobs:[{kind:'tts_context',status:'waiting_user',payload:{_media:{target_type:'chunk'}}}]};
  render(<VisualPlanOptions project={running} active={true} act={act} run={run}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Visual plan mode'}),{target:{value:'custom'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Image count'}),{target:{value:'2'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Video count'}),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Queue visual plan'}));
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm counts and create resources'}));
  await waitFor(()=>expect(run).toHaveBeenCalledWith({automatic_resources:true,confirmed_image_count:2,confirmed_video_count:2}));
});
