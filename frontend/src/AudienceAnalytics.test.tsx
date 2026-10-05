import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {AudienceAnalytics,AnalyticsReminders} from './AudienceAnalytics';
import {api} from './api';
vi.mock('./api',async importOriginal=>({...await importOriginal<typeof import('./api')>(),api:vi.fn()}));
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
afterEach(()=>{cleanup();vi.clearAllMocks()});
const act=async(fn:()=>Promise<any>)=>fn();
const projects=[{id:'p',title:'A finished story',publish:{title:'Actual published title',date:'2026-09-01',final_duration:300}}];
const data={items:[],learning:{comparisons:[],learned_patterns:[]},reminders:[]};

it('keeps unknown measurements empty, accepts replay percentages, and preserves a measured zero',async()=>{
  vi.mocked(api).mockResolvedValue({saved:true});
  render(<AudienceAnalytics data={data} projects={projects} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add analytics snapshot'}));
  fireEvent.change(screen.getByRole('combobox',{name:'Project'}),{target:{value:'p'}});
  expect(screen.getByRole('spinbutton',{name:'CTR (%)'})).toHaveValue(null);
  fireEvent.change(screen.getByRole('spinbutton',{name:'Views'}),{target:{value:'0'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Retention at 30s (%)'}),{target:{value:'112'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Impressions'}),{target:{value:'2'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Impressions'}),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Save snapshot'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/analytics','POST',expect.objectContaining({
    project_id:'p',metrics:expect.objectContaining({title_used:'Actual published title',views:0,retention_30:112,impressions:null})
  })));
  const body=vi.mocked(api).mock.calls[0][2] as any;
  expect(body.metrics.ctr).toBeUndefined();
  expect(body.metrics.average_view_duration).toBeUndefined();
});

it('allows saving a snapshot without any performance metrics',async()=>{
  vi.mocked(api).mockResolvedValue({saved:true});
  render(<AudienceAnalytics data={data} projects={projects} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add analytics snapshot'}));
  fireEvent.change(screen.getByRole('combobox',{name:'Project'}),{target:{value:'p'}});
  fireEvent.click(screen.getByRole('button',{name:'Save snapshot'}));
  await waitFor(()=>expect(api).toHaveBeenCalledOnce());
  expect(vi.mocked(api).mock.calls[0][2]).toEqual(expect.objectContaining({project_id:'p'}));
});

it('prefills the historical observation date when adding a seven-day result later',()=>{
  render(<AudienceAnalytics data={{...data,reminders:[{project_id:'p',title:'A finished story',horizon_days:7}]}} projects={projects} act={act}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add results'}));
  expect(screen.getByLabelText('Snapshot date')).toHaveValue('2026-09-08');
  expect(screen.getByRole('spinbutton',{name:'Observation age (days)'})).toHaveValue(7);
});

it('lets users dismiss the optional reminder without entering results',async()=>{
  vi.mocked(api).mockResolvedValue({dismissed:true});
  const onAdd=vi.fn();
  render(<AnalyticsReminders items={[{project_id:'p',title:'A finished story',horizon_days:7}]} act={act} onAdd={onAdd}/>);
  fireEvent.click(screen.getByRole('button',{name:'Dismiss reminder'}));
  await waitFor(()=>expect(screen.queryByText('Optional analytics reminders')).not.toBeInTheDocument());
  expect(api).toHaveBeenCalledWith('/projects/p/analytics-reminder-dismiss','POST',{horizon_days:7});
  expect(onAdd).not.toHaveBeenCalled();
});
