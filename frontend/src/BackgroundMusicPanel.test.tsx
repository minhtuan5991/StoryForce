import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {BackgroundMusicPanel} from './BackgroundMusicPanel';
import {api} from './api';
vi.mock('./api',()=>({api:vi.fn()}));
const project={id:'p',locked:true,story_version:1,settings:{production_options:{music_enabled:true},
  background_music:{status:'ready',asset_id:'old'}},assets:[{id:'old',kind:'music',story_version:1}]};
const act=async(fn:()=>Promise<any>)=>fn();
afterEach(()=>{cleanup();vi.resetAllMocks()});
it('allows a new full track while retaining the current music preview',async()=>{
  vi.mocked(api).mockResolvedValue({items:[],folder:'Shared folder'});
  render(<BackgroundMusicPanel project={project} active={false} act={act}/>);
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/background-music'));
  fireEvent.click(screen.getByRole('button',{name:'Create new long Lyria music'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/background-music','POST',{retry:false,regenerate:true}));
  expect(screen.getByLabelText('Project background music')).toHaveAttribute('src','/api/assets/old/file');
});
it('selects a folder track without generating music, and active jobs disable controls',async()=>{
  vi.mocked(api).mockResolvedValue({items:[{id:'native',name:'Curiosity.mp3',duration:120,available:true}]});
  const {rerender}=render(<BackgroundMusicPanel project={project} active={false} act={act}/>);
  await waitFor(()=>expect(screen.getByRole('combobox')).not.toBeDisabled());
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'native'}});
  expect(screen.getByLabelText('Selected music preview')).toHaveAttribute('src','/api/assets/native/file');
  fireEvent.click(screen.getByRole('button',{name:'Use selected music'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/projects/p/background-music/select','POST',{library_id:'native'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Create new long Lyria music'})).not.toBeDisabled());
  rerender(<BackgroundMusicPanel project={project} active={true} act={act}/>);
  expect(screen.getByRole('button',{name:'Create new long Lyria music'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Use selected music'})).toBeDisabled();
});

it('refreshes newly copied music and disables missing tracks',async()=>{
  vi.mocked(api).mockResolvedValueOnce({items:[]}).mockResolvedValue({items:[{id:'new',name:'New mystery.wav',duration:100,available:true},
    {id:'gone',name:'Missing.wav',duration:20,available:false}]});
  render(<BackgroundMusicPanel project={project} active={false} act={act}/>);
  await waitFor(()=>expect(screen.getByRole('combobox')).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button',{name:'Refresh music list'}));
  expect(await screen.findByRole('option',{name:/New mystery.wav/})).toBeInTheDocument();
  expect(screen.getByRole('option',{name:/Missing.wav/})).toBeDisabled();
});
