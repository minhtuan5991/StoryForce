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
        assert jobs[0].payload['_media']['lyria']=={'duration':'full','model':'lyria-3-pro-preview','instrumental':True,
                                                  'surface':'aistudio_music'}
        assert jobs[0].result['url']=='https://aistudio.google.com/new_music?model=lyria-3-pro-preview'
    automation.claim(id,{'owner':'music','attempt':attempt,'authorize_send':True})
    source=Path(first['download_path'])/'bgm_mystery.mp3'
    binary=find_binary('ffmpeg',DEFAULT_SETTINGS)
    run_process([binary,'-v','error','-y','-f','lavfi','-i','sine=frequency=185:sample_rate=24000',
                 '-t','120','-c:a','libmp3lame',str(source)])
    accepted=automation.complete(id,{'owner':'music','attempt':attempt,'download_state':'complete','download_id':91,'path':str(source),
                                     'expected_duration':120})
    assert accepted['accepted']
    with client.app.state.database.session() as db:
        library=db.query(Asset).filter_by(project_id=None,kind='music').one()
        assert 118<library.duration<120
        assert library.metadata_json['source_duration']>119
        assert library.metadata_json['music_profile_version']==2
        assert library.metadata_json['provider_duration']==120
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


@pytest.mark.parametrize('sent', [False, True])
def test_new_lyria_route_replaces_a_legacy_music_session_without_changing_the_speech_session(client,project,monkeypatch,tmp_path,sent):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    p=new_project(client,project['channel_id']);lock_fixture(client,p)
    speech={'url':'https://aistudio.google.com/prompts/narration','tts':{'voice':'Enzo'}}
    with client.app.state.database.session() as db:
        item=db.get(Project,p['id'])
        item.settings={**item.settings,'media_sessions':{'aistudio':speech,'lyria':{'url':'https://gemini.google.com/app/old-music'}}}
        db.commit()
    client.patch('/api/settings',json={'provider_mode':'browser'})
    token=client.post('/api/settings/pair-bridge').json()['token']
    automation=client.app.state.workflow.media_automation
    state=automation.start(p['id'],{'kind':'music'})
    current=next(j for j in client.get('/api/bridge/jobs',headers={'X-Bridge-Token':token}).json()['items']
                 if j['id']==state['current_job_id'])
    assert current['url']=='https://aistudio.google.com/new_music?model=lyria-3-pro-preview'
    assert current['provider']=='lyria' and current['media']['lyria']['surface']=='aistudio_music'
    body={'owner':'music-session','attempt':current['attempt']}
    automation.claim(current['id'],{**body,'authorize_send':sent})
    saved=automation.save_session(current['id'],{**body,'url':'https://aistudio.google.com/prompts/music-new?account=private'})
    assert saved['session']['url']=='https://aistudio.google.com/prompts/music-new'
    with client.app.state.database.session() as db:
        assert db.get(Project,p['id']).settings['media_sessions']['aistudio']==speech
    with pytest.raises(ValueError,match='Invalid provider session URL'):
        automation.save_session(current['id'],{**body,'url':'https://gemini.google.com/app/another'})


def test_new_long_music_rejects_short_download_and_keeps_old_library(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    p=new_project(client,project['channel_id']);lock_fixture(client,p)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    automation=client.app.state.workflow.media_automation
    old=tmp_path/'old.wav'
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-v','error','-y','-f','lavfi','-i',
                 'sine=frequency=185:sample_rate=24000','-t','30',str(old)])
    with client.app.state.database.session() as db:
        item=db.get(Project,p['id'])
        link=automation.music.import_track(db,item,old,DEFAULT_SETTINGS)
        old_id=link.id
        db.get(Asset,link.metadata_json['shared_library_id']).metadata_json={**link.metadata_json,'music_profile_version':1}
        # This is a pre-upgrade auto choice, not a new manual selection.
        item.settings={**item.settings,'background_music':{k:v for k,v in item.settings['background_music'].items() if k!='selection_mode'}}
        db.add(Setting(key='background_music_generation_v1',value={'job_id':'previous-failed-job'}))
        db.commit()
    # A previous short track/failed generation must not prevent the upgrade.
    state=automation.start(p['id'],{'kind':'music'})
    id=state['current_job_id']
    with client.app.state.database.session() as db:
        assert db.get(Project,p['id']).settings['background_music']['asset_id']==old_id
        attempt=db.get(Job,id).attempts
    automation.claim(id,{'owner':'music','attempt':attempt,'authorize_send':True})
    download=Path(state['download_path'])/'bgm_mystery.mp3'
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-v','error','-y','-i',str(old),str(download)])
    with pytest.raises(ValueError,match='đoạn nhạc ngắn'):
        automation.complete(id,{'owner':'music','attempt':attempt,'download_state':'complete','download_id':99,'path':str(download)})
    # A file exceeding the minimum can still be an incomplete download of the
    # visible player. Reject it before replacing the old track or creating files.
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-v','error','-y','-f','lavfi','-i',
                 'sine=frequency=185:sample_rate=24000','-t','100',str(download)])
    original_files={path.name:path.stat().st_size for path in (tmp_path/'background_music').iterdir()}
    for expected in (140, True, 0, '140', float('nan'), float('inf'), 601):
        with pytest.raises(ValueError,match=r'\[MUSIC_INCOMPLETE\]'):
            automation.complete(id,{'owner':'music','attempt':attempt,'download_state':'complete','download_id':99,
                                    'path':str(download),'expected_duration':expected})
        with client.app.state.database.session() as db:
            assert db.get(Project,p['id']).settings['background_music']['asset_id']==old_id
            assert db.query(Asset).filter_by(project_id=None,kind='music').count()==1
            assert db.get(Job,id).status=='waiting_user'
        assert {path.name:path.stat().st_size for path in (tmp_path/'background_music').iterdir()}==original_files
    automation.failure(id,{'owner':'music','attempt':attempt,'reason':'Full music unavailable in fixture'})
    with client.app.state.database.session() as db:
        item=db.get(Project,p['id'])
        assert item.settings['background_music']['asset_id']==old_id
        assert item.settings['background_music']['status']=='ready'
        assert db.query(Asset).filter_by(project_id=None,kind='music').count()==1
        assert (tmp_path/db.get(Asset,old_id).path).is_file()


def test_force_new_music_works_with_an_existing_track_and_deduplicates_requests(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    a=new_project(client,project['channel_id']);b=new_project(client,project['channel_id'])
    lock_fixture(client,a);lock_fixture(client,b)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    source=tmp_path/'track.wav'
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-v','error','-y','-f','lavfi','-i',
                 'sine=frequency=190:sample_rate=24000','-t','120',str(source)])
    automation=client.app.state.workflow.media_automation
    with client.app.state.database.session() as db:
        link=automation.music.import_track(db,db.get(Project,a['id']),source,DEFAULT_SETTINGS)
        link_id=link.id
        db.commit()
    reused=client.post('/api/projects/'+a['id']+'/background-music',json={})
    assert reused.status_code==200 and reused.json()['status']=='ready'
    fresh=client.post('/api/projects/'+a['id']+'/background-music',json={'regenerate':True})
    assert fresh.status_code==200,fresh.text
    assert fresh.json()['phase']=='running'
    waiting=client.post('/api/projects/'+b['id']+'/background-music',json={'regenerate':True})
    assert waiting.status_code==200 and waiting.json()['status']=='waiting_library'
    with client.app.state.database.session() as db:
        assert db.query(Job).filter_by(kind='music_generation').count()==1
        assert db.get(Project,a['id']).settings['background_music']['asset_id']==link_id


def test_shared_folder_tracks_are_discovered_selected_per_project_and_never_modified(client,project,tmp_path,monkeypatch):
    a=new_project(client,project['channel_id']);b=new_project(client,project['channel_id'])
    lock_fixture(client,a);lock_fixture(client,b)
    with client.app.state.database.session() as db:
        for p in (a,b):
            item=db.get(Project,p['id']);item.publish={**item.publish,'final_reviewed':True}
        db.commit()
    folder=tmp_path/'background_music'
    originals={}
    binary=find_binary('ffmpeg',DEFAULT_SETTINGS)
    for filename,freq in (('Midnight mystery.wav',183),('Curious pulse.mp3',220)):
        file=folder/filename
        run_process([binary,'-v','error','-y','-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=24000','-t','16',str(file)])
        originals[filename]=file.read_bytes()
    (folder/'not-audio.wav').write_bytes(b'not an audio file')
    (folder/'ignored.txt').write_text('Not audio',encoding='utf-8')
    import backend.background_music as music
    actual_probe=music.probe;calls=[]
    def counted_probe(path,config):
        calls.append(Path(path).name);return actual_probe(path,config)
    monkeypatch.setattr(music,'probe',counted_probe)
    result=client.get('/api/background-music')
    assert result.status_code==200,result.text
    items=result.json()['items']
    assert {item['name'] for item in items}==set(originals)
    assert all(item['available'] for item in items)
    assert result.json()['errors'][0]['name']=='not-audio.wav'
    ids={item['name']:item['id'] for item in items}
    for p,filename in ((a,'Midnight mystery.wav'),(b,'Curious pulse.mp3')):
        selected=client.post('/api/projects/'+p['id']+'/background-music/select',json={'library_id':ids[filename]})
        assert selected.status_code==200,selected.text
        detail=client.get('/api/projects/'+p['id']).json()
        assert detail['settings']['background_music']['library_id']==ids[filename]
        assert detail['settings']['background_music']['selection_mode']=='manual'
        assert not detail['publish']['final_reviewed']
    calls.clear()
    again=client.get('/api/background-music').json()
    assert len(again['items'])==2
    assert not any(filename in calls for filename in originals)  # Already registered files are not re-probed.
    with client.app.state.database.session() as db:
        item=db.get(Project,a['id'])
        assert client.app.state.workflow.media_automation.music.prepare(db,item)=='ready'
        assert item.settings['background_music']['library_id']==ids['Midnight mystery.wav']
        assert db.query(Job).filter_by(kind='music_generation').count()==0
        cleanup=private_file_plan(db,tmp_path,[a['id']])
        assert not any(f['path'].startswith('background_music') for f in cleanup['files'])
    for filename,contents in originals.items():assert (folder/filename).read_bytes()==contents
    # A failed full-length upgrade keeps a manually selected folder track.
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    client.patch('/api/settings',json={'provider_mode':'browser'})
    automation=client.app.state.workflow.media_automation
    state=automation.start(a['id'],{'kind':'music','regenerate':True})
    with client.app.state.database.session() as db:attempt=db.get(Job,state['current_job_id']).attempts
    claim={'owner':'folder-music','attempt':attempt}
    automation.claim(state['current_job_id'],{**claim,'authorize_send':True})
    automation.failure(state['current_job_id'],{**claim,'reason':'Full Lyria unavailable in fixture'})
    detail=client.get('/api/projects/'+a['id']).json()
    assert detail['settings']['background_music']['library_id']==ids['Midnight mystery.wav']
    assert detail['settings']['background_music']['selection_mode']=='manual'
    base='/api/projects/'+a['id']+'/background-music/select'
    assert client.post(base,json={'library_id':'not-found'}).status_code==422
    assert client.post(base,json={'library_id':selected.json()['asset_id']}).status_code==422  # A project link is not a library entry.
    (folder/'Midnight mystery.wav').unlink()
    assert client.post(base,json={'library_id':ids['Midnight mystery.wav']}).status_code==422
    assert not next(item for item in client.get('/api/background-music').json()['items'] if item['id']==ids['Midnight mystery.wav'])['available']
    damaged=folder/'Curious pulse.mp3'
    damaged.write_bytes(b'x'*len(originals[damaged.name]))  # Same size must not make unreadable audio selectable.
    public=client.get('/api/background-music').json()
    assert not next(item for item in public['items'] if item['id']==ids[damaged.name])['available']
    assert client.post('/api/projects/'+b['id']+'/background-music/select',json={'library_id':ids[damaged.name]}).status_code==422
    damaged.write_bytes(originals[damaged.name])
    assert next(item for item in client.get('/api/background-music').json()['items'] if item['id']==ids[damaged.name])['available']


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


def test_legacy_music_metadata_does_not_lower_music_after_opening(tmp_path):
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
    assert difference==pytest.approx(0,abs=.1)
    assert music_volume_filter({'metadata_json':{}},-28)=='volume=-28dB'


def test_library_without_project_can_be_reused_and_rendered_without_duplicate_beds(client,project,tmp_path):
    from PIL import Image
    from backend.media import render_project
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
        source_peak=max(abs(s) for s in samples)
        adjacent=max(abs(samples[i+2]-samples[i]) for i in range(0,len(samples)-2,2))
        assert abs(samples[-2]-samples[0])<=adjacent*1.5
        p=db.get(Project,project['id']);p.story_version=1
        link=automation.music.link(db,p,library);db.commit()
        project_data={'id':p.id,'title':p.title,'story_version':1,'settings':{**p.settings,'render_options':{'subtitles':False}}}
        from backend.models import serialize
        music=serialize(link)
    # Quiet speech, loud speech, then a pause: the music must not react to any of them.
    run_process([find_binary('ffmpeg',config),'-v','error','-y','-f','lavfi','-i','sine=frequency=900:sample_rate=48000',
                 '-t','18','-af',"volume='if(gte(t,12),0,if(gte(t,6),1.88,1))':eval=frame",str(tmp_path/'voice.wav')])
    Image.new('RGB',(320,180),(20,50,70)).save(tmp_path/'scene.png')
    assets=[{'id':'voice','kind':'audio','path':'voice.wav','duration':18,'story_version':1,'metadata_json':probe(tmp_path/'voice.wav',config)},
            {'id':'image','kind':'image','path':'scene.png','story_version':1},music,
            {**music,'id':'old-link','path':'nonexistent-old-music.wav'}]
    chunks=[{'id':'chunk','number':1,'text':'Synthetic narration fixture.', 'asset_id':'voice','real_duration':18,'story_version':1,'status':'ATTACHED'}]
    scenes=[{'id':f'scene_{i}','number':i+1,'scene_key':f'scene_{i+1:03}','asset_id':'image',
             'duration':9,'offset':i*9,'story_version':1,'status':'ATTACHED'} for i in range(2)]
    report=render_project(tmp_path,project_data,chunks,scenes,assets,config,lambda *args:None)
    assert all(report['checks'].values()),report
    assert probe(tmp_path/report['file'],config)['duration']==pytest.approx(18,abs=.1)
    assert report['audio_mix']['music_present']
    assert not report['audio_mix']['ducking'] and report['audio_mix']['volume_mode']=='constant'
    balance=report['audio_mix']['music'][0]
    assert balance['asset_id']==music['id'] and balance['measured']
    # Measure the music frequency in the real render output, independent of the speech tone.
    with wave.open(str((tmp_path/report['file']).parent/'final_audio.wav'),'rb') as audio:
        rate,channels=audio.getframerate(),audio.getnchannels()
        samples=array('h',audio.readframes(audio.getnframes()))
    def music_amplitude(start):
        block=samples[start*rate*channels:(start+2)*rate*channels:channels]
        omega=2*math.pi*185.3/rate
        cosine=sum(value*math.cos(omega*i) for i,value in enumerate(block))
        sine=sum(value*math.sin(omega*i) for i,value in enumerate(block))
        return 2*math.hypot(cosine,sine)/len(block)
    quiet,loud,pause=[music_amplitude(start) for start in (2,8,13)]
    assert quiet>0
    assert 20*math.log10(loud/quiet)==pytest.approx(0,abs=.1)
    assert 20*math.log10(pause/quiet)==pytest.approx(0,abs=.1)
    assert max(abs(s) for s in samples)<=32767*.951
    warm=render_project(tmp_path,project_data,chunks,scenes,assets,config,lambda *args:None)
    assert warm['render_performance']['audio_cached']
    assert warm['render_performance']['cached_scenes']==2
    config['music_db']=-25
    changed=render_project(tmp_path,project_data,chunks,scenes,assets,config,lambda *args:None)
    assert changed['render_performance']['audio_cached']
    assert changed['render_performance']['timeline_cached']
    assert changed['render_performance']['narration_cached']
    assert changed['audio_mix']['music'][0]['body_db']==balance['body_db']==0
    assert balance['source_level_preserved']
    assert quiet==pytest.approx(source_peak,rel=.015)  # Prepared source amplitude, with no per-track reduction.
