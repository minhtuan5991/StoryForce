import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {JsonEditor,Status} from './components';
afterEach(cleanup);
describe('production interface',()=>{
  it('shows readable status labels independent of color',()=>{render(<Status value="HUMAN_REVIEW"/>);expect(screen.getByText('Human Review')).toBeInTheDocument()});
  it('validates structured edits before saving',async()=>{
    const save=vi.fn().mockResolvedValue({});render(<JsonEditor value={{tone:'warm'}} onSave={save}/>);
    fireEvent.click(screen.getByText('Edit JSON'));
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'invalid'}});
    fireEvent.click(screen.getByText('Save changes'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'{"tone":"measured"}'}});
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(()=>expect(save).toHaveBeenCalledWith({tone:'measured'}));
  });
});
