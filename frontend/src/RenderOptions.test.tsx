import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {RenderOptions} from './RenderOptions';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
const project={id:'p',assets:[{id:'logo',name:'Channel.png',kind:'image'},{id:'wave',name:'Wave.mp4',kind:'video'}]};
const act=async(fn:()=>Promise<any>)=>fn();

it('saves mutually exclusive captions and waveform, with independent logo',async()=>{
  vi.mocked(api).mockImplementation(async(_p,_m,body)=>body);
  render(<RenderOptions project={project} active={false} act={act} onBusy={()=>{}}/>);
  expect(screen.getByRole('checkbox',{name:'Add subtitles'})).toBeChecked();
  expect(screen.getByRole('checkbox',{name:'Audio waveform'})).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox',{name:'Green-screen waveform video'}),{target:{value:'wave'}});
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Audio waveform'})).toBeEnabled());
  expect(screen.getByRole('checkbox',{name:'Add subtitles'})).not.toBeChecked();
  expect(api).toHaveBeenLastCalledWith('/projects/p/render-options','PATCH',expect.objectContaining({subtitles:false,waveform:true,waveform_asset_id:'wave'}));
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
  fireEvent.change(screen.getByRole('combobox',{name:'Green-screen waveform video'}),{target:{value:'wave'}});
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Add subtitles'})).toBeChecked());
  expect(screen.getByRole('combobox',{name:'Green-screen waveform video'})).toHaveValue('');
  cleanup();
  render(<RenderOptions project={project} active={true} act={act} onBusy={()=>{}}/>);
  expect(screen.getByRole('checkbox',{name:'Audio waveform'})).toBeDisabled();
});
