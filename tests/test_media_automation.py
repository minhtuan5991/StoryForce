import io
import wave
from pathlib import Path

import pytest
from PIL import Image

from backend.models import Project, Chunk, Scene, Job, Asset
from backend.media_automation import download_folder
from conftest import job, build_story


@pytest.fixture
def production(client, project, monkeypatch, tmp_path):
    download = tmp_path / 'Downloads'
    monkeypatch.setattr('backend.media_automation.downloads_root', lambda: download)
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.locked=True;p.story_version=1;p.draft='First scene. Second scene.'
        db.add_all([Chunk(project_id=p.id,story_version=1,number=i,text=f'Audio {i}.',word_count=2,status='PENDING') for i in (1,2)])
        db.add_all([Scene(project_id=p.id,story_version=1,number=i,scene_key=f'scene_{i:03}',visual_type='VIDEO' if i==2 else 'IMAGE',prompt=f'Visual {i}.') for i in (1,2)])
        db.commit()
    client.patch('/api/settings',json={'provider_mode':'browser'})
    token=client.post('/api/settings/pair-bridge').json()['token']
    return {'path':'/api/projects/'+project['id']+'/media-automation', 'headers':{'X-Bridge-Token':token},'download':download,'id':project['id']}


def media_job(client,p):
    return client.get('/api/bridge/jobs',headers=p['headers']).json()['items'][0]


def start(client,p,kind='tts',**body):
    response=client.post(p['path']+'/start',json={'kind':kind,**body})
    assert response.status_code==200,response.text
    return response.json()


def claim(client,p,j,owner='one'):
    response=client.post('/api/bridge/media/'+j['id']+'/claim',headers=p['headers'],json={'owner':owner,'attempt':j['attempt'],'authorize_send':True})
    assert response.status_code==200,response.text
    return response.json()


def result(client,p,j,path,id=10):
    return client.post('/api/bridge/media/'+j['id']+'/result',headers=p['headers'],json={'owner':'one','attempt':j['attempt'],'download_id':id,'download_state':'complete','path':str(path)})


def wav(path):
    path.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(path),'wb') as audio:
        audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(24000);audio.writeframes(b'\0\0'*24000)


def test_visuals_require_exact_current_count_confirmation(client,production):
    p=production
    preview=client.get(p['path']+'/preview').json()
    for body in ({},{'confirmation':preview['confirmation'],'image_count':9,'video_count':1},{'confirmation':'old','image_count':1,'video_count':1}):
        assert client.post(p['path']+'/start',json={'kind':'visuals',**body}).status_code==422
    assert not client.get('/api/bridge/jobs',headers=p['headers']).json()['items']
    state=start(client,p,'visuals',**{k:preview[k] for k in ('confirmation','image_count','video_count')})
    assert state['total']==3 and state['confirmed_counts']=={'images':1,'videos':1}
    j=media_job(client,p)
    assert j['media']['target_type']=='thumbnail' and j['media']['filename']=='thumbnail.png'


def test_tts_downloads_attach_once_and_queue_next_in_order(client,production):
    p=production;state=start(client,p)
    j=media_job(client,p)
    assert j['media']['filename']=='tts_001.wav' and j['media']['voice']=='Enzo' and j['media']['style']=='Friendly'
    assert claim(client,p,j)['send'] is True
    assert claim(client,p,j)['send'] is False
    wrong=client.post('/api/bridge/media/'+j['id']+'/claim',headers=p['headers'],json={'owner':'two','attempt':1,'authorize_send':True})
    assert wrong.status_code==422
    path=Path(state['download_path'])/'tts_001.wav';wav(path)
    r=result(client,p,j,path);assert r.status_code==200,r.text
    aid=r.json()['asset_id']
    assert result(client,p,j,path).json()['asset_id']==aid
    next_job=media_job(client,p)
    assert next_job['media']['filename']=='tts_002.wav'
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['chunks'][0]['asset_id']==aid and detail['chunks'][0]['real_duration']==pytest.approx(1)
    assert detail['settings']['media_automation']['completed']==1 and len(detail['assets'])==1


def test_completed_thumbnail_then_scene_then_exact_flow_settings(client,production):
    p=production;preview=client.get(p['path']+'/preview').json()
    state=start(client,p,'visuals',**{k:preview[k] for k in ('confirmation','image_count','video_count')})
    for name in ('thumbnail.png','scene_001.png'):
        j=media_job(client,p);assert j['media']['filename']==name;claim(client,p,j)
        path=Path(state['download_path'])/name
        Image.new('RGB',(1280,720),'navy').save(path)
        response=result(client,p,j,path);assert response.status_code==200,response.text
    video=media_job(client,p)
    assert video['media']['filename']=='scene_002.mp4'
    assert video['media']['flow']=={'mode':'Video','input_mode':'Ingredients','aspect':'16:9','model':'Omni 1.1 Flash','resolution':'720p','seconds':10,'outputs':1}
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['publish']['thumbnail_asset_id'] and detail['scenes'][0]['asset_id']


def test_changed_story_or_prompt_and_cancel_never_accept_old_result(client,production):
    p=production;state=start(client,p);j=media_job(client,p);claim(client,p,j)
    path=Path(state['download_path'])/'tts_001.wav';wav(path)
    with client.app.state.database.session() as db:
        c=db.get(Chunk,j['media']['target_id']);c.text='Changed audio';db.commit()
    assert result(client,p,j,path).status_code==422
    assert not client.get('/api/projects/'+p['id']).json()['assets']
    assert client.post(p['path']+'/stop').status_code==200
    assert result(client,p,j,path).status_code==422
    assert not client.get('/api/bridge/jobs',headers=p['headers']).json()['items']


def test_download_requires_completed_expected_file_in_project_folder(client,production,tmp_path):
    p=production;state=start(client,p);j=media_job(client,p);claim(client,p,j)
    outside=tmp_path/'tts_001.wav';wav(outside)
    assert result(client,p,j,outside).status_code==422
    wrong=Path(state['download_path'])/'tts_002.wav';wav(wrong)
    assert result(client,p,j,wrong).status_code==422
    bad=Path(state['download_path'])/'tts_001.wav';bad.write_bytes(b'not audio')
    assert result(client,p,j,bad).status_code==422
    assert not client.get('/api/projects/'+p['id']).json()['assets']


def test_existing_valid_resources_are_skipped_and_manual_jobs_do_not_autostart(client,production):
    p=production;state=start(client,p);j=media_job(client,p);claim(client,p,j)
    path=Path(state['download_path'])/'tts_001.wav';wav(path);assert result(client,p,j,path).status_code==200
    client.post(p['path']+'/stop')
    assert start(client,p)['total']==1
    assert media_job(client,p)['media']['filename']=='tts_002.wav'
    client.post(p['path']+'/stop')
    response=client.post('/api/jobs',json={'project_id':p['id'],'kind':'image_generation','payload':{'prompt':'Image'}})
    assert response.status_code==200
    manual=media_job(client,p)
    assert manual['media'] is None
    assert client.post('/api/bridge/media/'+manual['id']+'/claim',headers=p['headers'],json={'owner':'one','attempt':1,'authorize_send':True}).status_code==422


def test_filename_sanitizes_windows_reserved_names_and_traversal():
    assert '/' not in download_folder('../A: B\\C')
    assert download_folder('CON')=='StoryForge_CON'
    assert download_folder('...')=='StoryForge'


def test_custom_browser_downloads_directory_is_preserved_for_the_whole_batch(client,production,tmp_path):
    p=production;state=start(client,p);j=media_job(client,p);claim(client,p,j)
    folder=tmp_path/'Browser Downloads'/state['folder']
    path=folder/'tts_001.wav';wav(path)
    response=result(client,p,j,path);assert response.status_code==200,response.text
    assert client.get('/api/projects/'+p['id']).json()['settings']['media_automation']['download_path']==str(folder)
    second=media_job(client,p);claim(client,p,second)
    wrong=Path(state['download_path'])/'tts_002.wav';wav(wrong)
    assert result(client,p,second,wrong).status_code==422
    path=folder/'tts_002.wav';wav(path)
    assert result(client,p,second,path).status_code==200


def test_assigned_video_in_an_image_scene_is_kept_unless_regeneration_is_selected(client,production):
    p=production
    root=client.app.state.root
    path=root/'assigned.mp4';path.write_bytes(b'existing validated media')
    with client.app.state.database.session() as db:
        asset=Asset(project_id=p['id'],name='assigned.mp4',kind='video',path='assigned.mp4',story_version=1)
        db.add(asset);db.flush()
        scene=db.query(Scene).filter_by(project_id=p['id'],number=1).one();scene.asset_id=asset.id;scene.status='ATTACHED';db.commit()
    preview=client.get(p['path']+'/preview').json()
    state=start(client,p,'visuals',**{k:preview[k] for k in ('confirmation','image_count','video_count')})
    assert state['skipped']==1 and state['total']==2
