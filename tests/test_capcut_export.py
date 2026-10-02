import copy
import json
from pathlib import Path

import pytest
from PIL import Image

from backend.capcut import export_project, drafts_folder
from backend.config import DEFAULT_SETTINGS
from backend.media import find_binary, run_process
from backend.models import Project, Scene, Chunk, Asset, serialize
from test_media import wav_data


def inputs(root):
    folder=root/'projects'/'p'
    folder.mkdir(parents=True,exist_ok=True)
    (folder/'voice.wav').write_bytes(wav_data(4))
    Image.new('RGB',(320,180),'blue').save(folder/'still.png')
    Image.new('RGBA',(320,180),(0,0,0,0)).save(folder/'logo.png')
    video=folder/'clip.mp4'
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-y','-f','lavfi','-i','color=c=red:s=320x180:r=30',
                 '-f','lavfi','-i','sine=frequency=440','-t','1','-c:v','libx264','-c:a','aac',str(video)])
    def asset(aid,filename,kind):
        return {'id':aid,'name':filename,'path':'projects/p/'+filename,'kind':kind,'metadata_json':{},'duration':None}
    assets=[asset('a','voice.wav','audio'),asset('i','still.png','image'),asset('v','clip.mp4','video'),asset('l','logo.png','image')]
    chunks=[{'id':'c','number':1,'text':'One two three four.', 'word_count':4,'story_version':1,'asset_id':'a','status':'ATTACHED','real_duration':999}]
    scenes=[{'id':'s1','number':1,'scene_key':'scene_001','start_word':0,'end_word':2,'offset':0,'duration':2,'story_version':1,'asset_id':'i','status':'ATTACHED'},
            {'id':'s2','number':2,'scene_key':'scene_002','start_word':2,'end_word':4,'offset':2,'duration':2,'story_version':1,'asset_id':'v','status':'ATTACHED'}]
    project={'id':'p','title':'Native CapCut QA','story_version':1,'publish':{},'settings':{'render_options':{'subtitles':True,'ending_asset_id':'i','overlay':True,'logo_asset_id':'l'}}}
    settings={**DEFAULT_SETTINGS,'render_width':320,'render_height':180}
    return project,chunks,scenes,assets,settings


def test_native_export_preserves_video_anchor_and_duration_and_copies_media(tmp_path):
    values=inputs(tmp_path)
    before=copy.deepcopy(values)
    drafts=tmp_path/'CapCut Drafts';drafts.mkdir()
    result=export_project(tmp_path,*values,str(drafts))
    assert values==before  # read-only original app inputs
    folder=Path(result['folder']);draft=json.loads((folder/'draft_content.json').read_text())
    tracks={t['name']:t for t in draft['tracks']}
    visual=tracks['Scenes']['segments']
    assert [(s['target_timerange']['start'],s['target_timerange']['duration']) for s in visual]==[(0,2_000_000),(2_000_000,1_000_000),(3_000_000,1_000_000)]
    assert draft['duration']==4_000_000
    assert visual[1]['speed']==1 and visual[1]['source_timerange']['duration']==1_000_000
    assert all(s['volume']==0 for s in visual)
    assert tracks['Narration']['segments'][0]['target_timerange']['duration']==4_000_000
    assert tracks['Subtitles']['segments'] and tracks['Logo']['segments'][0]['clip']['scale']=={'x':1,'y':1}
    assert tracks['Logo']['segments'][0]['track_render_index']>tracks['Subtitles']['segments'][0]['track_render_index']
    for category in ('videos','audios'):
        for mat in draft['materials'][category]:
            assert Path(mat['path']).is_file() and Path(mat['path']).parent==folder/'media'
    assert len(list((folder/'media').iterdir()))==4  # ending thumbnail shares the image
    meta=json.loads((folder/'draft_meta_info.json').read_text());assert meta['draft_id']==draft['id']
    second=export_project(tmp_path,*values,str(drafts))
    assert second['folder']!=result['folder'] and folder.exists()
    assert not list((tmp_path/'exports').glob('capcut-*'))


def test_waveform_loop_chroma_logo_order_and_no_subtitles(tmp_path):
    p,chunks,scenes,assets,settings=inputs(tmp_path)
    path=tmp_path/'projects/p/wave.mp4'
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-y','-f','lavfi','-i','color=c=0x28A745:s=320x180:r=30',
                 '-vf','drawbox=x=20:y=140:w=60:h=15:color=white:t=fill','-t','1.5','-c:v','libx264',str(path)])
    assets.append({'id':'w','name':'wave.mp4','path':'projects/p/wave.mp4','kind':'video','metadata_json':{}})
    p['settings']['render_options'].update(waveform=True,waveform_asset_id='w')
    drafts=tmp_path/'drafts';drafts.mkdir()
    result=export_project(tmp_path,p,chunks,scenes,assets,settings,str(drafts))
    doc=json.loads((Path(result['folder'])/'draft_content.json').read_text())
    tracks={t['name']:t for t in doc['tracks']}
    assert 'Subtitles' not in tracks
    wave=tracks['Waveform']['segments']
    assert len(wave)==3 and sum(s['target_timerange']['duration'] for s in wave)==4_000_000
    assert all(s['volume']==0 and s['clip']['scale']=={'x':1,'y':1} and s['clip']['transform']=={'x':0,'y':0} for s in wave)
    assert wave[-1]['source_timerange']['duration']==1_000_000
    assert doc['materials']['chromas'][0]['color'].lower()!='#00ff00ff'
    assert wave[0]['track_render_index']<tracks['Logo']['segments'][0]['track_render_index']


def test_export_rejects_missing_or_stale_media_without_partial_draft(tmp_path):
    values=list(inputs(tmp_path));drafts=tmp_path/'drafts';drafts.mkdir()
    (tmp_path/'projects/p/voice.wav').unlink()
    with pytest.raises(ValueError,match='Missing assets'):export_project(tmp_path,*values,str(drafts))
    assert not list(drafts.iterdir())
    with pytest.raises(ValueError):drafts_folder(str(tmp_path/'no-folder'))
    with pytest.raises(ValueError):drafts_folder('relative')
    (drafts/'draft_content.json').write_text('{}')
    with pytest.raises(ValueError):drafts_folder(str(drafts))


def test_capcut_export_api_uses_local_job_and_preserves_original_archive(client,project,tmp_path):
    p,chunks,scenes,assets,settings=inputs(client.app.state.root)
    with client.app.state.database.session() as db:
        actual=db.get(Project,project['id']);actual.locked=True;actual.story_version=1;actual.settings=p['settings']
        for a in assets:db.add(Asset(project_id=actual.id,story_version=1,**a))
        for c in chunks:db.add(Chunk(project_id=actual.id,**c))
        for s in scenes:db.add(Scene(project_id=actual.id,**s))
        db.commit()
    client.patch('/api/settings',json={'render_width':320,'render_height':180})
    drafts=tmp_path/'drafts';drafts.mkdir()
    r=client.post('/api/projects/'+project['id']+'/export-capcut',json={'drafts_folder':str(drafts)})
    assert r.status_code==200,r.text
    job=client.get('/api/jobs/'+r.json()['id']).json()
    assert job['status']=='completed',job
    assert job['provider']=='local' and job['result']['scene_count']==3
    assert client.get('/api/projects/'+project['id']+'/export?capcut=true').status_code==410
    assert client.get('/api/projects/'+project['id']+'/export').status_code==200
    assert client.get('/api/capcut').status_code==200


def test_unsorted_narration_uses_real_lengths_and_declared_still_fallback(tmp_path):
    p,chunks,scenes,assets,settings=inputs(tmp_path)
    for aid,filename,duration in [('a1','first.wav',1.5),('a2','second.wav',2.5)]:
        (tmp_path/'projects/p'/filename).write_bytes(wav_data(duration))
        assets.append({'id':aid,'name':filename,'path':'projects/p/'+filename,'kind':'audio','metadata_json':{}})
    chunks=[{**chunks[0],'id':'c2','number':2,'text':'Three four.','asset_id':'a2'},
            {**chunks[0],'id':'c1','number':1,'text':'One two.','asset_id':'a1'}]
    (tmp_path/'projects/p/clip.mp4').unlink()
    scenes[1]['fallback_asset_id']='i'
    drafts=tmp_path/'drafts';drafts.mkdir()
    result=export_project(tmp_path,p,chunks,scenes,assets,settings,str(drafts))
    doc=json.loads((Path(result['folder'])/'draft_content.json').read_text())
    narration=next(t for t in doc['tracks'] if t['name']=='Narration')['segments']
    assert [(s['target_timerange']['start'],s['target_timerange']['duration']) for s in narration]==[(0,1_500_000),(1_500_000,2_500_000)]
    assert all(m['type']=='photo' for m in doc['materials']['videos'])
    assert doc['duration']==4_000_000 and result['alignment_note']


def test_cancellation_during_publish_removes_only_the_new_draft(tmp_path,monkeypatch):
    import backend.capcut as capcut
    values=inputs(tmp_path);drafts=tmp_path/'drafts';drafts.mkdir()
    existing=drafts/'user-project';existing.mkdir();(existing/'keep.txt').write_text('keep')
    state={'cancelled':False};copy=capcut.shutil.copytree
    def cancel_after_copy(*args,**kwargs):
        result=copy(*args,**kwargs);state['cancelled']=True;return result
    monkeypatch.setattr(capcut.shutil,'copytree',cancel_after_copy)
    with pytest.raises(ValueError,match='cancelled'):
        export_project(tmp_path,*values,str(drafts),cancelled=lambda:state['cancelled'])
    assert list(drafts.iterdir())==[existing] and (existing/'keep.txt').read_text()=='keep'
    assert not list((tmp_path/'exports').iterdir())
