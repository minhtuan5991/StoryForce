import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {SoundDesignPanel} from './SoundDesignPanel';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
const p={id:'p',locked:true,updated_at:'one',settings:{}};
const sound={enabled:true,opening_seconds:30,timing:'actual',prepared:true,
  cues:[{id:'cue1',kind:'opening_texture',offset:0,label:'Opening mystery texture',anchor_text:''},
        {id:'cue2',kind:'radio_static',offset:42,label:'Radio interference',anchor_text:'The radio crackled beside me.'}]};
const act=async(fn:()=>Promise<any>)=>fn();
afterEach(()=>{cleanup();vi.resetAllMocks()});
it('shows event timing and shared audio previews without starting a new task',async()=>{
  vi.mocked(api).mockResolvedValue(sound);
  render(<SoundDesignPanel project={p} active={false} act={act}/>);
  expect(await screen.findByRole('checkbox')).toBeChecked();
  expect(screen.getByText('The radio crackled beside me.')).toBeInTheDocument();
  expect(screen.getByText('0:42')).toBeInTheDocument();
  expect(screen.getByLabelText('Radio interference')).toHaveAttribute('src','/api/projects/p/sound-design/effects/radio_static');
  expect(api).toHaveBeenCalledTimes(1);
});
it('can disable the effect layer, and cannot edit it during an active job',async()=>{
  vi.mocked(api).mockResolvedValueOnce(sound).mockResolvedValue({...sound,enabled:false});
  const {rerender}=render(<SoundDesignPanel project={p} active={false} act={act}/>);
  fireEvent.click(await screen.findByRole('checkbox'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/sound-design','POST',{enabled:false}));
  await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeChecked());
  rerender(<SoundDesignPanel project={p} active={true} act={act}/>);
  expect(screen.getByRole('checkbox')).toBeDisabled();
});
it('reloads timing when the project changes and surfaces load errors',async()=>{
  vi.mocked(api).mockResolvedValueOnce({...sound,prepared:false,timing:'estimated'}).mockRejectedValueOnce(new Error('Cannot read timing'));
  const {rerender}=render(<SoundDesignPanel project={p} active={false} act={act}/>);
  await screen.findByText(/Estimated timing/);
  rerender(<SoundDesignPanel project={{...p,updated_at:'two'}} active={false} act={act}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot read timing');
});
