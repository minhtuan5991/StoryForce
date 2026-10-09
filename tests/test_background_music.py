from pathlib import Path
import wave
import math
from array import array

import pytest

from backend.background_music import production_suggestion, music_volume_filter, MUSIC_PROMPT, LEASE_KEY
from backend.config import DEFAULT_SETTINGS
from backend.media import find_binary, run_process, probe
from backend.models import Asset, Artifact, Chunk, Job, Project, Setting
from backend.project_files import private_file_plan


def new_project(client, channel_id, **production):
    result=client.post('/api/projects',json={'channel_id':channel_id,'title':'Music test','duration_mode':'5',
        'target_minutes':5,'production_options':{'image_count':3,'video_count':2,'music_enabled':True,**production}})
    assert result.status_code==200,result.text
    return result.json()


def lock_fixture(client,p):
    with client.app.state.database.session() as db:
        item=db.get(Project,p['id']);item.locked=True;item.story_version=1
        item.draft=' '.join(['A door opened without a sound.']*30)
        db.add(Artifact(project_id=item.id,kind='story_bible',content={'characters':[]},story_version=1))
        db.add_all([Chunk(project_id=item.id,story_version=1,number=i,text='A door opened without a sound.',word_count=6,status='PENDING') for i in (1,2)])
        db.commit()


def test_project_creation_minimums_suggestions_and_legacy_mode(client,project):
    p=new_project(client,project['channel_id'])
    assert p['settings']['visual_options']=={'mode':'custom','image_count':3,'video_count':2}
    assert p['settings']['production_options']['preset_counts']
    assert production_suggestion(1)=={'image_count':3,'video_count':2,'video_seconds':10}
    assert production_suggestion(30)['video_count']==3
    assert client.get('/api/duration?minutes=20').json()['production_suggestion']['image_count']==20
    for counts in ({'image_count':2,'video_count':2},{'image_count':3,'video_count':1},
                   {'image_count':198,'video_count':3},{'image_count':True,'video_count':2}):
        result=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Invalid','production_options':counts})
        assert result.status_code==422
    assert 'production_options' not in project['settings']  # Existing projects keep their approval flow.


def test_preset_visual_plan_starts_once_after_tts_queue_without_another_count_approval(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    p=new_project(client,project['channel_id'],music_enabled=False);lock_fixture(client,p)
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'auto'})
    workflow=client.app.state.workflow
    state=workflow.media_automation.start(p['id'],{'kind':'tts'})
    for i in (1,2):
        with client.app.state.database.session() as db:
            active=db.query(Job).filter_by(project_id=p['id'],status='waiting_user').one();id,attempt=active.id,active.attempts
            assert active.kind=='tts_context'
        workflow.media_automation.claim(id,{'owner':'test','attempt':attempt,'authorize_send':True})
        workflow.media_automation.failure(id,{'owner':'test','attempt':attempt,'reason':'Synthetic failure of a browser fixture'})
    with client.app.state.database.session() as db:
        plan=db.query(Job).filter_by(project_id=p['id'],kind='visual_director').one()
        assert plan.status=='waiting_user'
        assert plan.payload['confirmed_image_count']==3 and plan.payload['confirmed_video_count']==2
        context=workflow.context(db,plan);output=workflow.mock.generate(plan.kind,context,plan.prompt)
        id,attempt=plan.id,plan.attempts
    workflow.complete_ai(id,output,expected_attempt=attempt)
    with client.app.state.database.session() as db:
        preparation=db.query(Job).filter_by(project_id=p['id'],kind='thumbnail_plan').one()
        assert preparation.status=='waiting_user'
        context=workflow.context(db,preparation);output=workflow.mock.generate(preparation.kind,context,preparation.prompt)
        id,attempt=preparation.id,preparation.attempts
    workflow.complete_ai(id,output,expected_attempt=attempt)
    workflow.drain_production_queue(p['id'])
    detail=client.get('/api/projects/'+p['id']).json()
    assert sum(s['visual_type']=='VIDEO' for s in detail['scenes'])==2
    assert len(detail['scenes'])==5
    assert detail['settings']['media_automation']['confirmed_counts']=={'images':3,'videos':2}
    assert detail['settings']['media_automation']['kind']=='visuals'
    assert [j['kind'] for j in detail['jobs']].count('visual_director')==1
    assert detail['jobs'][0]['payload']['_media']['target_type']=='thumbnail'


def test_shared_generation_lease_import_loop_and_project_cleanup_preserve_one_track(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    a=new_project(client,project['channel_id']);b=new_project(client,project['channel_id'])
    lock_fixture(client,a);lock_fixture(client,b)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    automation=client.app.state.workflow.media_automation
    first=automation.start(a['id'],{'kind':'music'})
    second=automation.start(b['id'],{'kind':'music'})
    assert second['status']=='waiting_library'
    with client.app.state.database.session() as db:
        jobs=db.query(Job).filter_by(kind='music_generation').all()
        assert len(jobs)==1
        id,attempt=jobs[0].id,jobs[0].attempts
        assert jobs[0].prompt==MUSIC_PROMPT
    automation.claim(id,{'owner':'music','attempt':attempt,'authorize_send':True})
    source=Path(first['download_path'])/'bgm_mystery.mp3'
    binary=find_binary('ffmpeg',DEFAULT_SETTINGS)
    run_process([binary,'-v','error','-y','-f','lavfi','-i','sine=frequency=185:sample_rate=24000',
                 '-t','60','-c:a','libmp3lame',str(source)])
    accepted=automation.complete(id,{'owner':'music','attempt':attempt,'download_state':'complete','download_id':91,'path':str(source)})
    assert accepted['accepted']
    with client.app.state.database.session() as db:
        library=db.query(Asset).filter_by(project_id=None,kind='music').one()
        assert 29<library.duration<30
        assert library.metadata_json['source_duration']>59
        links=db.query(Asset).filter(Asset.project_id.in_([a['id'],b['id']]),Asset.kind=='music').all()
        assert len(links)==2 and links[0].path==links[1].path==library.path
        assert db.get(Project,b['id']).settings['background_music']['status']=='ready'
        path=tmp_path/library.path
        plan=private_file_plan(db,tmp_path,[a['id']])
        assert library.path not in [f['path'] for f in plan['files']]
    assert automation.start(b['id'],{'kind':'music'})['status']=='ready'
    assert path.is_file()
    assert client.get('/api/assets/'+library.id+'/file').status_code==200
    assert len(client.get('/api/background-music').json()['items'])==1


def test_music_failure_is_optional_and_not_regenerated_for_each_new_project(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    a=new_project(client,project['channel_id']);b=new_project(client,project['channel_id']);lock_fixture(client,a);lock_fixture(client,b)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    automation=client.app.state.workflow.media_automation
    state=automation.start(a['id'],{'kind':'music'})
    automation.start(b['id'],{'kind':'music'})
    with client.app.state.database.session() as db:
        j=db.get(Job,state['current_job_id']);id,attempt=j.id,j.attempts
    automation.claim(id,{'owner':'music','attempt':attempt,'authorize_send':True})
    automation.failure(id,{'owner':'music','attempt':attempt,'reason':'Lyria quota fixture'})
    for p in (a,b):
        assert automation.start(p['id'],{'kind':'music'})['status']=='missing'
        detail=client.get('/api/projects/'+p['id']).json()
        assert next(r for r in detail['missing_resources'] if r['target_type']=='background_music')['optional']
    with client.app.state.database.session() as db:assert db.query(Job).filter_by(kind='music_generation').count()==1


def test_intro_envelope_is_quieter_after_opening(tmp_path):
    binary=find_binary('ffmpeg',DEFAULT_SETTINGS)
    source=tmp_path/'music.wav';output=tmp_path/'envelope.wav'
    run_process([binary,'-v','error','-y','-f','lavfi','-i','sine=frequency=180:sample_rate=24000','-t','45',str(source)])
    asset={'metadata_json':{'envelope_version':1,'intro_db':-23,'body_db':-31,'intro_seconds':30}}
    run_process([binary,'-v','error','-y','-i',str(source),'-af',music_volume_filter(asset,-28),'-c:a','pcm_s16le',str(output)])
    with wave.open(str(output),'rb') as audio:
        rate=audio.getframerate();samples=array('h',audio.readframes(audio.getnframes()))
    def rms(start):
        window=samples[int(start*rate):int((start+3)*rate)]
        return math.sqrt(sum(float(value)*value for value in window)/len(window))
    difference=20*math.log10(rms(10)/rms(38))
    assert difference==pytest.approx(8,abs=.3)
    assert music_volume_filter({'metadata_json':{}},-28)=='volume=-28dB'


def test_library_without_project_can_be_reused_and_rendered_without_duplicate_beds(client,project,tmp_path):
    from PIL import Image
    from backend.media import render_project
    from test_media import wav_data
    automation=client.app.state.workflow.media_automation
    config={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':12,'render_encoder':'cpu'}
    source=tmp_path/'bed.wav'
    run_process([find_binary('ffmpeg',config),'-v','error','-y','-f','lavfi','-i','sine=frequency=185.3:sample_rate=24000',
                 '-t','16',str(source)])
    with client.app.state.database.session() as db:
        library=automation.music.import_track(db,None,source,config)
        assert automation.music.import_track(db,None,source,config).id==library.id
        with wave.open(str(tmp_path/library.path),'rb') as audio:
            samples=array('h',audio.readframes(audio.getnframes()))
        adjacent=max(abs(samples[i+2]-samples[i]) for i in range(0,len(samples)-2,2))
        assert abs(samples[-2]-samples[0])<=adjacent*1.5
        p=db.get(Project,project['id']);p.story_version=1
        link=automation.music.link(db,p,library);db.commit()
        project_data={'id':p.id,'title':p.title,'story_version':1,'settings':{**p.settings,'render_options':{'subtitles':False}}}
        from backend.models import serialize
        music=serialize(link)
    (tmp_path/'voice.wav').write_bytes(wav_data(18))
    Image.new('RGB',(320,180),(20,50,70)).save(tmp_path/'scene.png')
    assets=[{'id':'voice','kind':'audio','path':'voice.wav','duration':18,'story_version':1,'metadata_json':probe(tmp_path/'voice.wav',config)},
            {'id':'image','kind':'image','path':'scene.png','story_version':1},music,
            {**music,'id':'old-link','path':'nonexistent-old-music.wav'}]
    chunks=[{'id':'chunk','number':1,'text':'Synthetic narration fixture.', 'asset_id':'voice','real_duration':18,'story_version':1,'status':'ATTACHED'}]
    scenes=[{'id':'scene','number':1,'scene_key':'scene_001','asset_id':'image','duration':18,'offset':0,'story_version':1,'status':'ATTACHED'}]
    report=render_project(tmp_path,project_data,chunks,scenes,assets,config,lambda *args:None)
    assert all(report['checks'].values()),report
    assert probe(tmp_path/report['file'],config)['duration']==pytest.approx(18,abs=.1)
