import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ResourceReview} from './ResourceReview';

const act=vi.fn();
const project={id:'p',locked:true,settings:{},resource_review:{required:false,ready:true,can_render:true,manual_render_required:true,
  active:false,narration:[2,2],visuals:[5,5],thumbnails:['A','B','C'],missing:[],warnings:[]}};

afterEach(()=>{cleanup();vi.clearAllMocks()});
it('opens rendering when files are ready, with no approval or automatic action',()=>{
  render(<ResourceReview project={project} act={act}/>);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Open Render & QA'})).toHaveAttribute('href','#/projects/p/render');
  expect(screen.getByText('Resources are ready for manual rendering')).toBeVisible();
  expect(act).not.toHaveBeenCalled();
});
it('shows missing files and enables the render link after they are attached',()=>{
  const {rerender}=render(<ResourceReview project={{...project,resource_review:{...project.resource_review,ready:false,can_render:false,missing:['scene_002.png']}}} act={act}/>);
  expect(screen.getByText('scene_002.png')).toBeVisible();
  expect(screen.queryByRole('link',{name:'Open Render & QA'})).not.toBeInTheDocument();
  rerender(<ResourceReview project={project} act={act}/>);
  expect(screen.getByRole('link',{name:'Open Render & QA'})).toBeVisible();
  expect(act).not.toHaveBeenCalled();
});
it('keeps rendering available when publishing thumbnails are missing',()=>{
  const warning='Some thumbnails are missing for publishing. This does not block rendering; the selected ending image must be available.';
  render(<ResourceReview project={{...project,resource_review:{...project.resource_review,thumbnails:[],thumbnail_missing:['thumbnail_A.png','thumbnail_B.png','thumbnail_C.png'],warnings:[warning]}}} act={act}/>);
  expect(screen.getByText(warning)).toBeVisible();
  expect(screen.getByRole('link',{name:'Open Render & QA'})).toBeVisible();
  expect(act).not.toHaveBeenCalled();
});
it('waits for active resource generation without an approval checkbox',()=>{
  render(<ResourceReview project={{...project,resource_review:{...project.resource_review,active:true,can_render:false}}} act={act}/>);
  expect(screen.getByText('Resource generation is still running')).toBeVisible();
  expect(screen.queryByRole('link',{name:'Open Render & QA'})).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(act).not.toHaveBeenCalled();
});
