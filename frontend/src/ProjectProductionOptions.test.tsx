import {useState} from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {ProjectProductionOptions,type ProductionChoices} from './ProjectProductionOptions';
afterEach(cleanup);
function Form({minutes}:{minutes:number}){
  const [value,setValue]=useState<ProductionChoices>({music_enabled:false,image_count:3,video_count:2});
  return <ProjectProductionOptions minutes={minutes} value={value} onChange={setValue}/>;
}
it('updates suggested budgets for duration and preserves explicit counts until the user resets them',()=>{
  const {rerender}=render(<Form minutes={5}/>);
  const images=screen.getByRole('spinbutton',{name:'Scene images'});
  const videos=screen.getByRole('spinbutton',{name:'Scene videos · 10 seconds each'});
  expect(images).toHaveValue(5);expect(videos).toHaveValue(2);
  fireEvent.change(images,{target:{value:'3'}});
  rerender(<Form minutes={30}/>);
  expect(images).toHaveValue(3);expect(videos).toHaveValue(2);
  fireEvent.click(screen.getByRole('button',{name:'Use suggested counts'}));
  expect(images).toHaveValue(30);expect(videos).toHaveValue(3);
  fireEvent.click(screen.getByRole('checkbox',{name:'Add instrumental background music with Google Lyria'}));
  expect(screen.getByRole('checkbox')).toBeChecked();
  expect(images).toHaveAttribute('min','3');expect(videos).toHaveAttribute('min','2');
});
