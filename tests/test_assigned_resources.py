import io
import json

import pytest
from PIL import Image, ImageChops

from backend.config import DEFAULT_SETTINGS
from backend.media import find_binary, probe, render_project, run_process, render_inputs_hash
from backend.models import Asset, Chunk, Scene, Project, Job
from test_media import wav_data


def picture(color='red'):
    data=io.BytesIO();Image.new('RGBA',(64,64),color).save(data,'PNG');return data.getvalue()


def seed(client, project):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.locked=True;p.story_version=1
        c=Chunk(project_id=p.id,story_version=1,number=1,text='One two three four.',word_count=4)
        s=Scene(project_id=p.id,story_version=1,number=1,scene_key='S001',start_word=0,end_word=4,visual_type='IMAGE')
        db.add_all([c,s]);db.commit();return c.id,s.id


def upload(client, project, name, data):
    response=client.post('/api/projects/'+project['id']+'/assets',files=[('files',(name,data))])
    assert response.status_code==200,response.text
    return response.json()['items'][0]


def test_arbitrary_named_video_is_sufficient_and_sync_uses_assigned_audio(client,project,tmp_path):
    c,s=seed(client,project)
    ffmpeg=find_binary('ffmpeg',DEFAULT_SETTINGS)
    path=tmp_path/'clip.mp4'
    run_process([ffmpeg,'-y','-f','lavfi','-i','testsrc2=s=160x90:r=12','-t','0.4','-c:v','libx264',str(path)])
    video=upload(client,project,'my holiday.mp4',path.read_bytes())
    audio=upload(client,project,'Narrator final.wav',wav_data(2.5))
    for item,target,kind in ((video,s,'scene'),(audio,c,'tts')):
        assert client.patch('/api/assets/'+item['id'],json={'target_id':target,'target_type':kind}).status_code==200
    base='/api/projects/'+project['id']
    validation=client.get(base+'/validate').json()
    assert validation['valid'] and validation['visuals']==[1,1],validation
    from conftest import job
    timeline=job(client,project,'sync')
    assert timeline['duration']==2.5
    assert timeline['scenes'][0]['duration']==2.5
    assert client.get(base).json()['next']=={'kind':'render'}


def test_delete_assets_clears_maps_and_logo_keeps_shared_and_rendered_files(client,project):
    c,s=seed(client,project)
    audio=upload(client,project,'tts_001.wav',wav_data())
    image=upload(client,project,'scene_001.png',picture())
    keep=upload(client,project,'keep.png',picture('blue'))
    base='/api/projects/'+project['id']
    assert client.patch(base+'/render-options',json={'overlay':True,'logo_asset_id':image['id']}).status_code==200
    root=client.app.state.root
    rendered=root/'projects'/project['id']/'render'/'final.mp4';rendered.write_bytes(b'previous video')
    result=client.post(base+'/assets/delete',json={'ids':[audio['id'],image['id']]}).json()
    assert result['count']==2
    assert not (root/audio['path']).exists() and not (root/image['path']).exists()
    assert (root/keep['path']).is_file() and rendered.read_bytes()==b'previous video'
    p=client.get(base).json()
    assert p['chunks'][0]['asset_id'] is None and p['chunks'][0]['real_duration'] is None
    assert p['scenes'][0]['asset_id'] is None
    assert not p['settings']['render_options']['overlay']
    assert not client.get(base+'/validate').json()['valid']
    # A second asset record sharing a path protects the physical file.
    with client.app.state.database.session() as db:
        shared=Asset(project_id=project['id'],name='shared',path=keep['path'],kind='image',sha256='other')
        db.add(shared);db.commit()
    assert client.post(base+'/assets/delete',json={'ids':[keep['id']]}).status_code==200
    assert (root/keep['path']).is_file()


def test_delete_rejects_other_project_and_active_workers(client,project):
    seed(client,project)
    a=upload(client,project,'logo.png',picture())
    other=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Other'}).json()
    assert client.post('/api/projects/'+other['id']+'/assets/delete',json={'ids':[a['id']]}).status_code==409
    with client.app.state.database.session() as db:
        j=Job(project_id=project['id'],kind='render',status='cancelled');db.add(j);db.commit();jid=j.id
    client.app.state.workflow.active_jobs[jid]=1
    try:
        assert client.post('/api/projects/'+project['id']+'/assets/delete',json={'ids':[a['id']]}).status_code==409
    finally:
        del client.app.state.workflow.active_jobs[jid]
    assert client.get('/api/assets/'+a['id']+'/file').status_code==200


def test_render_options_validate_logo_and_invalidate_review(client,project):
    seed(client,project)
    base='/api/projects/'+project['id']
    assert client.patch(base+'/render-options',json={'waveform':True}).status_code==422
    assert client.patch(base+'/render-options',json={'overlay':True}).status_code==422
    image=upload(client,project,'logo.png',picture())
    client.patch(base,json={'publish':{'final_reviewed':True}})
    r=client.patch(base+'/render-options',json={'subtitles':False,'waveform':True,'overlay':True,'logo_asset_id':image['id']})
    assert r.status_code==200,r.text
    p=client.get(base).json()
    assert p['settings']['render_options']['waveform'] and not p['publish']['final_reviewed']
    h=render_inputs_hash(p,[],[],[image],DEFAULT_SETTINGS)
    p['settings']['render_options']['waveform']=False
    assert render_inputs_hash(p,[],[],[image],DEFAULT_SETTINGS)!=h


@pytest.mark.parametrize('options',[
    {'subtitles':False,'waveform':False,'overlay':False},
    {'subtitles':False,'waveform':True,'overlay':True,'logo_asset_id':'logo'},
    {'subtitles':True,'waveform':False,'overlay':True,'logo_asset_id':'logo'},
])
def test_real_render_loops_short_video_and_composites_options(tmp_path,options):
    root=tmp_path;(root/'logs').mkdir()
    ffmpeg=find_binary('ffmpeg',DEFAULT_SETTINGS)
    video=root/'arbitrary.mp4'
    run_process([ffmpeg,'-y','-f','lavfi','-i','testsrc2=s=320x180:r=12','-t','0.4','-c:v','libx264',str(video)])
    (root/'audio.wav').write_bytes(wav_data(2.4))
    Image.new('RGB',(320,180),(20,90,50)).save(root/'still.png')
    (root/'logo.png').write_bytes(picture())
    assets=[{'id':'a','path':'audio.wav','kind':'audio','duration':2.4,'metadata_json':probe(root/'audio.wav',DEFAULT_SETTINGS)},
            {'id':'v','path':video.name,'kind':'video','duration':.4},
            {'id':'i','path':'still.png','kind':'image'}, {'id':'logo','path':'logo.png','kind':'image'}]
    chunks=[{'id':'c','number':1,'asset_id':'a','real_duration':2.4,'text':'One two. Three four.','story_version':1,'status':'ATTACHED'}]
    scenes=[{'id':str(i),'number':i+1,'scene_key':str(i),'offset':1.2*i,'duration':1.2,'asset_id':'v' if i==0 else 'i',
             'visual_type':'IMAGE','story_version':1,'status':'ATTACHED'} for i in range(2)]
    p={'id':'p','story_version':1,'title':'Options','settings':{'render_options':options}}
    config={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':12,'transition_seconds':.15}
    r=render_project(root,p,chunks,scenes,assets,config,lambda *a:None)
    assert all(r['checks'].values()),r
    assert r['captions_burned_in']==options['subtitles']
    output=root/r['file']
    streams=json.loads(run_process([find_binary('ffprobe',config),'-v','error','-show_streams','-of','json',str(output)]).stdout)['streams']
    assert any(s['codec_type']=='subtitle' for s in streams)==options['subtitles']
    frames=[]
    for n,at in enumerate((1.7,1.9)):
        f=root/f'frame{n}.png'
        run_process([ffmpeg,'-y','-ss',str(at),'-i',str(output),'-frames:v','1',str(f)])
        with Image.open(f) as image:frames.append(image.convert('RGB').copy())
    # Last scene is green; no early video freeze or truncation.
    assert frames[0].getpixel((160,35))[1]>70
    if options['overlay']:
        red=frames[0].getpixel((296,20));assert red[0]>180 and red[1]<50
    if options['waveform']:
        lower=frames[0].crop((20,150,300,174))
        assert sum(1 for r,g,b in lower.getdata() if b>120 and r>60)>10
        assert ImageChops.difference(frames[0].crop((20,150,300,174)),frames[1].crop((20,150,300,174))).getbbox()
