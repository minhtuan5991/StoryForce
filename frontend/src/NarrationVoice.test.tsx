import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ChannelNarration,ProjectSetupPanel,ProjectVoiceChoice} from './NarrationVoice';
import {api} from './api';
vi.mock('./api',async()=>({...await vi.importActual('./api'),api:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
const channel={id:'c',settings:{narration_voice:{speaker:'Fola',style:'Calm and intimate'}}};
const project={id:'p',channel,target_minutes:5,setup_pending:true,settings:{production_options:{music_enabled:false,image_count:5,video_count:2}}};

it('saves channel voice with a visible error and keeps editable text on failure',async()=>{
  vi.mocked(api).mockRejectedValue(new Error('Speaker unavailable'));
  render(<ChannelNarration channel={channel} onChanged={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Speaker'),{target:{value:'Kore'}});
  fireEvent.click(screen.getByRole('button',{name:'Save channel voice'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Speaker unavailable');
  expect(screen.getByLabelText('Speaker')).toHaveValue('Kore');
  expect(api).toHaveBeenCalledWith('/channels/c/narration','PUT',{speaker:'Kore',style:'Calm and intimate'});
});

it('inherits channel voice until the user explicitly overrides it',()=>{
  const change=vi.fn();
  render(<ProjectVoiceChoice defaultVoice={channel.settings.narration_voice} value={null} onChange={change}/>);
  expect(screen.queryByLabelText('Speaker')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Use channel voice defaults'));
  expect(change).toHaveBeenCalledWith(channel.settings.narration_voice);
});

it('requires review and sends duration, counts and voice in one confirmation request',async()=>{
  vi.mocked(api).mockResolvedValue({kind:'story_bible'});const changed=vi.fn();
  render(<ProjectSetupPanel project={project} onChanged={changed}/>);
  const button=screen.getByRole('button',{name:'Confirm and continue pipeline'});
  expect(button).toBeDisabled();expect(api).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Target duration (minutes)'),{target:{value:'12'}});
  fireEvent.change(screen.getByLabelText('Scene images'),{target:{value:'7'}});
  fireEvent.click(screen.getByLabelText('Use channel voice defaults'));
  fireEvent.change(screen.getByLabelText('Style'),{target:{value:'Steady, warm narration.'}});
  fireEvent.click(screen.getByLabelText('I checked the duration, resource counts and narration voice.'));
  fireEvent.click(button);
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/setup','POST',{
    confirmed:true,target_minutes:12,production_options:{music_enabled:false,image_count:7,video_count:2},
    narration_voice:{speaker:'Fola',style:'Steady, warm narration.'}}));
  expect(changed).toHaveBeenCalledWith({kind:'story_bible'});
});

it('invalid video budget blocks continue and editing invalidates earlier review',()=>{
  render(<ProjectSetupPanel project={project} onChanged={()=>{}}/>);
  const checked=screen.getByLabelText('I checked the duration, resource counts and narration voice.');
  fireEvent.click(checked);
  fireEvent.change(screen.getByLabelText('Target duration (minutes)'),{target:{value:'1'}});
  expect(checked).not.toBeChecked();
  fireEvent.change(screen.getByLabelText('Scene videos · 10 seconds each'),{target:{value:'6'}});
  fireEvent.click(checked);
  expect(screen.getByRole('button',{name:'Confirm and continue pipeline'})).toBeDisabled();expect(api).not.toHaveBeenCalled();
});
