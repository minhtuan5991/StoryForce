import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {RenderOptions} from './RenderOptions';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
const project={id:'p',assets:[{id:'logo',name:'Channel.png',kind:'image'}]};
const act=async(fn:()=>Promise<any>)=>fn();

it('saves mutually exclusive captions and waveform, with independent logo',async()=>{
  vi.mocked(api).mockImplementation(async(_p,_m,body)=>body);
  render(<RenderOptions project={project} active={false} act={act} onBusy={()=>{}}/>);
  expect(screen.getByRole('checkbox',{name:'Add subtitles'})).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox',{name:'Audio waveform'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Audio waveform'})).toBeEnabled());
  expect(screen.getByRole('checkbox',{name:'Add subtitles'})).not.toBeChecked();
  expect(api).toHaveBeenLastCalledWith('/projects/p/render-options','PATCH',expect.objectContaining({subtitles:false,waveform:true}));
  fireEvent.change(screen.getByRole('combobox',{name:'Channel logo'}),{target:{value:'logo'}});
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Overlay'})).toBeEnabled());
  expect(screen.getByRole('checkbox',{name:'Overlay'})).toBeChecked();
  expect(api).toHaveBeenLastCalledWith('/projects/p/render-options','PATCH',expect.objectContaining({logo_asset_id:'logo',overlay:true,waveform:true}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Add subtitles'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Add subtitles'})).toBeEnabled());
  expect(screen.getByRole('checkbox',{name:'Audio waveform'})).not.toBeChecked();
});

it('restores saved choices when saving fails and blocks changes during jobs',async()=>{
  render(<RenderOptions project={project} active={false} act={async()=>undefined} onBusy={()=>{}}/>);
  fireEvent.click(screen.getByRole('checkbox',{name:'Audio waveform'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Add subtitles'})).toBeChecked());
  cleanup();
  render(<RenderOptions project={project} active={true} act={act} onBusy={()=>{}}/>);
  expect(screen.getByRole('checkbox',{name:'Audio waveform'})).toBeDisabled();
});
