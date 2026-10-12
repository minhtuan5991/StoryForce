import io
import wave
from pathlib import Path

import pytest
from PIL import Image
from backend.models import Asset, Artifact, Chunk, Job, Project, Scene
from backend.thumbnail_packaging import current_plan, plan_identifier
from test_background_music import new_project, lock_fixture


def complete_text(client, project_id, kind):
    workflow=client.app.state.workflow
    with workflow.database.session() as db:
        record=db.query(Job).filter_by(project_id=project_id,kind=kind,status='waiting_user').one()
        output=workflow.mock.generate(kind,workflow.context(db,record),record.prompt)
        id,attempt=record.id,record.attempts
    workflow.complete_ai(id,output,expected_attempt=attempt)


def fail_batch(client, project_id):
    automation=client.app.state.workflow.media_automation
    with client.app.state.database.session() as db:
        batch_id=db.get(Project,project_id).settings.get('media_automation', {}).get('id')
    for _ in range(25):
        with client.app.state.database.session() as db:
            if db.get(Project,project_id).settings.get('media_automation', {}).get('id') != batch_id:
                return
            record=db.query(Job).filter_by(project_id=project_id,status='waiting_user').first()
            if not record or not record.payload.get('_media'):
                return
            id,attempt=record.id,record.attempts
        automation.claim(id,{'owner':'fixture','attempt':attempt,'authorize_send':True})
        automation.failure(id,{'owner':'fixture','attempt':attempt,'reason':'Fixture provider is unavailable'})
    pytest.fail('Media batch did not advance')


def test_assisted_preset_resources_run_all_three_thumbnails_and_queue_next_project(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    a=new_project(client,project['channel_id'],music_enabled=True)
    b=new_project(client,project['channel_id'],music_enabled=False)
    untouched=new_project(client,project['channel_id'],music_enabled=False)
    for item in (a,b,untouched):lock_fixture(client,item)
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'assisted'})
    workflow=client.app.state.workflow
    assert client.post('/api/projects/'+a['id']+'/pipeline').status_code==200
    assert client.get('/api/projects/'+a['id']).json()['settings']['media_automation']['kind']=='tts'
    fail_batch(client,a['id'])
    complete_text(client,a['id'],'visual_director')
    complete_text(client,a['id'],'thumbnail_plan')
    with workflow.database.session() as db:
        batch=db.get(Project,a['id']).settings['media_automation']
        current=db.get(Job,batch['current_job_id']).payload['_media']
        items=[current,*batch['pending']]
        assert [(i['variant_id'],i['filename']) for i in items if i['target_type']=='thumbnail']==[
            ('A','thumbnail_A.png'),('B','thumbnail_B.png'),('C','thumbnail_C.png')]
        assert len([i for i in items if i['target_type']=='scene'])==3
        assert not any(i['kind']=='video_generation' or i['provider']=='flow' for i in items)
        assert batch['manual_video_count']==2
        assert batch['confirmed_counts']=={'images':3,'videos':2}
    queued=client.post('/api/projects/'+b['id']+'/pipeline').json()
    assert queued['status']=='queued'
    assert not client.get('/api/projects/'+b['id']).json()['jobs']
    fail_batch(client,a['id'])
    with workflow.database.session() as db:
        music=db.query(Job).filter_by(project_id=a['id'],kind='music_generation',status='waiting_user').one()
        assert music.payload['_media']['target_type']=='background_music'
    fail_batch(client,a['id'])
    a_detail=client.get('/api/projects/'+a['id']).json()
    b_detail=client.get('/api/projects/'+b['id']).json()
    assert a_detail['settings']['assisted_queue']['status']=='resources_pending'
    assert a_detail['missing_resources'] and not a_detail['resource_review']['approved']
    assert b_detail['settings']['media_automation']['kind']=='tts'
    assert not any(j['kind'] in ('sync','render') for j in a_detail['jobs'])
    assert not client.get('/api/projects/'+untouched['id']).json()['jobs']


def test_assisted_tts_finishes_then_uses_preset_counts_without_another_confirmation(client,project,monkeypatch,tmp_path):
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    p=new_project(client,project['channel_id'],music_enabled=False);lock_fixture(client,p)
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'assisted'})
    result=client.post('/api/jobs',json={'project_id':p['id'],'kind':'chunk_tts','payload':{'auto_continue':True}})
    assert result.status_code==200,result.text
    before=client.get('/api/projects/'+p['id']).json()
    assert before['settings']['media_automation']['kind']=='tts'
    assert not before['scenes']
    fail_batch(client,p['id'])
    after=client.get('/api/projects/'+p['id']).json()
    plan=next(j for j in after['jobs'] if j['kind']=='visual_director')
    assert plan['payload']['confirmed_image_count']==3 and plan['payload']['confirmed_video_count']==2
    assert plan['status']=='waiting_user'
    assert not after['resource_review']['approved']


def reviewed_fixture(client,project,tmp_path):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.locked=True;p.story_version=1;p.draft='The door opened.'
        c=Chunk(project_id=p.id,number=1,text=p.draft,word_count=3,story_version=1)
        s=Scene(project_id=p.id,number=1,start_word=0,end_word=3,visual_type='IMAGE',story_version=1)
        db.add_all([c,s]);db.commit()
    # Import real files through the existing resource mapping API.
    wav=io.BytesIO()
    with wave.open(wav,'wb') as file:
        file.setnchannels(1);file.setsampwidth(2);file.setframerate(24000);file.writeframes(b'\0\0'*72000)
    png=io.BytesIO();Image.new('RGB',(1280,720),'navy').save(png,'PNG')
    response=client.post('/api/projects/'+project['id']+'/assets',files=[
        ('files',('tts_001.wav',wav.getvalue(),'audio/wav')),('files',('scene_001.png',png.getvalue(),'image/png'))])
    assert response.status_code==200,response.text
    return '/api/projects/'+project['id']


def test_complete_resources_need_no_approval_and_assisted_pipeline_never_launches_render(client,project,tmp_path):
    base=reviewed_fixture(client,project,tmp_path)
    detail=client.get(base).json();review=detail['resource_review']
    assert not review['required'] and review['ready'] and review['can_render']
    assert detail['next']['action_kind']=='render'
    assert client.post(base+'/pipeline').json()['action_kind']=='render'
    assert not client.get(base).json()['jobs']
    # An older open UI may still call this endpoint; no approval is persisted.
    assert client.post(base+'/resource-review',json={'confirmed':False,'fingerprint':'old'}).status_code==200
    assert 'resource_review' not in client.get(base).json()['settings']
    with client.app.state.database.session() as db:
        saved=db.query(Asset).filter_by(project_id=project['id'],kind='image').one()
        file=client.app.state.root/saved.path
    Image.new('RGB',(1280,720),'red').save(file,'PNG')
    assert client.get(base).json()['resource_review']['can_render']
    file.unlink()
    assert not client.get(base).json()['resource_review']['ready']
    assert client.post('/api/jobs',json={'kind':'render','project_id':project['id']}).status_code==422


def test_missing_publishing_thumbnails_do_not_block_manual_render(client,project,tmp_path):
    base=reviewed_fixture(client,project,tmp_path)
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.settings={**p.settings,'assisted_production':{'all_thumbnails':True}}
        db.commit()
    review=client.get(base).json()['resource_review']
    assert review['can_render'] and review['missing']==[]
    assert review['thumbnail_missing']==['thumbnail_A.png','thumbnail_B.png','thumbnail_C.png']
    assert review['warnings'] and 'does not block rendering' in review['warnings'][0]
    assert client.get(base).json()['next']['action_kind']=='render'
    assert client.post(base+'/pipeline').json()['action_kind']=='render'
    assert not client.get(base).json()['jobs']


def test_manual_thumbnails_are_recognized_despite_a_stale_plan_and_without_fabricating_metadata(client,project,tmp_path):
    base=reviewed_fixture(client,project,tmp_path)
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.settings={**p.settings,'assisted_production':{'all_thumbnails':True}}
        db.add(Artifact(project_id=p.id,kind='thumbnail_plan',story_version=1,
                        content={'content_fingerprint':'legacy-contract','plan_hash':'old-plan',
                                 'recommended_thumbnail_variant':'A'}))
        db.commit()
    files=[]
    for variant,color in zip(('A','B','C'),('blue','red','green')):
        png=io.BytesIO();Image.new('RGB',(1280,720),color).save(png,'PNG')
        files.append(('files',(f'thumbnail_{variant}.png',png.getvalue(),'image/png')))
    response=client.post(base+'/assets',files=files)
    assert response.status_code==200,response.text
    detail=client.get(base).json();review=detail['resource_review']
    assert not detail['thumbnail_packaging']['current']
    assert review['thumbnails']==['A','B','C'] and not review['thumbnail_missing']
    assert review['ready'] and review['can_render'] and not review['missing']
    assert detail['next']['action_kind']=='render'
    for asset in detail['assets']:
        assert 'thumbnail_plan_hash' not in asset['metadata_json']
    with client.app.state.database.session() as db:
        asset=db.query(Asset).filter_by(project_id=project['id'],name='thumbnail_C.png').one()
        client.app.state.root.joinpath(asset.path).unlink()
    review=client.get(base).json()['resource_review']
    assert review['thumbnails']==['A','B'] and review['can_render']
    assert review['thumbnail_missing']==['thumbnail_C.png']


def test_selected_ending_image_is_still_a_required_render_input(client,project,tmp_path):
    base=reviewed_fixture(client,project,tmp_path)
    png=io.BytesIO();Image.new('RGB',(1280,720),'red').save(png,'PNG')
    client.post(base+'/assets',files=[('files',('thumbnail_C.png',png.getvalue(),'image/png'))]).raise_for_status()
    with client.app.state.database.session() as db:
        asset=db.query(Asset).filter_by(project_id=project['id'],name='thumbnail_C.png').one()
        id,path=asset.id,client.app.state.root/asset.path
    client.patch(base+'/render-options',json={'ending_asset_id':id}).raise_for_status()
    assert client.get(base).json()['resource_review']['can_render']
    path.unlink()
    review=client.get(base).json()['resource_review']
    assert not review['ready'] and 'Ending thumbnail file is missing' in review['missing']
    assert client.post('/api/jobs',json={'kind':'render','project_id':project['id']}).status_code==422


def test_active_job_still_disables_the_manual_render_action(client,project,tmp_path):
    base=reviewed_fixture(client,project,tmp_path)
    with client.app.state.database.session() as db:
        db.add(Job(project_id=project['id'],kind='thumbnail_plan',status='waiting_user'))
        db.commit()
    review=client.get(base).json()['resource_review']
    assert review['ready'] and review['active'] and not review['can_render']


def test_complete_resources_can_render_without_approval_when_the_render_job_itself_is_active(client,project,tmp_path):
    base=reviewed_fixture(client,project,tmp_path)
    client.patch('/api/settings',json={'render_width':320,'render_height':180,'render_fps':12,'render_encoder':'cpu'})
    assert client.get(base).json()['resource_review']['can_render']
    from conftest import job
    result=job(client,project,'render')
    assert (client.app.state.root/result['file']).is_file()
    assert client.get(base).json()['next']['checkpoint']=='Review the rendered video. Use Render again after any changes.'


@pytest.mark.parametrize('mode',['manual','auto'])
def test_other_modes_keep_their_render_checkpoint_without_resource_approval(client,project,tmp_path,mode):
    base=reviewed_fixture(client,project,tmp_path)
    client.patch('/api/settings',json={'pipeline_mode':mode})
    detail=client.get(base).json()
    assert not detail['resource_review']['required'] and detail['resource_review']['ready']
    assert not detail['resource_review']['manual_render_required']
    assert detail['next'].get('action_kind')!='resource_review'
    assert client.post(base+'/resource-review',json={'confirmed':True}).status_code==200


def test_project_queue_survives_recreation_and_does_not_restart_cancelled_work(client,project):
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'assisted'})
    first=client.post('/api/projects/'+project['id']+'/pipeline').json()
    with client.app.state.database.session() as db:
        db.get(Job,first['id']).status='cancelled';db.commit()
    from backend.assisted_queue import AssistedQueue
    workflow=client.app.state.workflow;workflow.assisted_queue=AssistedQueue(workflow)
    workflow.assisted_queue.tick()
    detail=client.get('/api/projects/'+project['id']).json()
    assert len(detail['jobs'])==1
    assert detail['settings']['assisted_queue']['status']=='waiting_user'


def test_successful_real_download_imports_prepare_complete_resources_reuse_music_and_wait_for_manual_render(client,project,monkeypatch,tmp_path):
    from backend.media import find_binary, run_process
    from backend.config import DEFAULT_SETTINGS
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    p=new_project(client,project['channel_id'],music_enabled=True);lock_fixture(client,p)
    library_path=client.app.state.root/'background_music'/'library.wav'
    with wave.open(str(library_path),'wb') as file:
        file.setnchannels(1);file.setsampwidth(2);file.setframerate(24000);file.writeframes(b'\0\0'*720000)
    with client.app.state.database.session() as db:
        saved=db.get(Project,p['id'])
        chunks=db.query(Chunk).filter_by(project_id=p['id']).order_by(Chunk.number).all()
        text=saved.draft.split();mid=len(text)//2
        for chunk,part in zip(chunks,(text[:mid],text[mid:])):
            chunk.text=' '.join(part);chunk.word_count=len(part)
        db.add(Asset(project_id=None,kind='music',name='mystery.wav',path='background_music/library.wav',
                     duration=30,size=library_path.stat().st_size,sha256='shared',story_version=0,
                     metadata_json={'library_profile':'mystery','music_profile_version':2,'has_audio':True}))
        db.commit()
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'assisted'})
    automation=client.app.state.workflow.media_automation
    assert client.post('/api/projects/'+p['id']+'/pipeline').status_code==200
    clip=tmp_path/'fixture.mp4'
    run_process([find_binary('ffmpeg',DEFAULT_SETTINGS),'-v','error','-y','-f','lavfi',
                 '-i','color=c=navy:s=160x90:r=1','-t','10','-c:v','libx264',str(clip)])
    for sequence in range(30):
        with client.app.state.database.session() as db:
            record=db.query(Job).filter_by(project_id=p['id'],status='waiting_user').first()
            if not record:break
            id,attempt,kind=record.id,record.attempts,record.kind
            media=record.payload.get('_media')
        if not media:
            complete_text(client,p['id'],kind)
            continue
        automation.claim(id,{'owner':'download-test','attempt':attempt,'authorize_send':True})
        path=Path(media['download_path'])/media['filename']
        if media['target_type']=='chunk':
            with wave.open(str(path),'wb') as file:
                file.setnchannels(1);file.setsampwidth(2);file.setframerate(24000);file.writeframes(b'\0\0'*720000)
        elif kind=='video_generation':pytest.fail('Flow cannot be an automatic request')
        else:Image.new('RGB',(1280,720),(sequence*7,30,70)).save(path,'PNG')
        result=automation.complete(id,{'owner':'download-test','attempt':attempt,'download_state':'complete',
                                      'download_id':sequence+100,'path':str(path),
                                      **({'expected_duration':30} if media['target_type']=='chunk' else {})})
        assert result['accepted']
    else:pytest.fail('Successful fixture did not finish')
    detail=client.get('/api/projects/'+p['id']).json()
    assert not detail['resource_review']['can_render']
    assert detail['settings']['assisted_queue']['status']=='resources_pending'
    for scene in detail['scenes']:
        if scene['visual_type']=='VIDEO':
            imported=client.post('/api/projects/'+p['id']+'/assets',files=[('files',(f"scene_{scene['number']:03}.mp4",clip.read_bytes(),'video/mp4'))])
            assert imported.status_code==200,imported.text
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['settings']['background_music']['status']=='ready'
    assert not any(j['kind']=='music_generation' for j in detail['jobs'])
    assert detail['resource_review']['thumbnails']==['A','B','C']
    assert detail['resource_review']['can_render'] and not detail['resource_review']['required']
    assert detail['next']['action_kind']=='render'
    assert detail['settings']['assisted_queue']['status']=='ready_to_render'
    assert not detail['missing_resources']
    assert not any(j['kind'] in ('sync','render') for j in detail['jobs'])
    # Reopening the visual batch reuses all three files and scenes.
    report=client.app.state.workflow.media_automation.preview
    with client.app.state.database.session() as db:
        preview=report(db,db.get(Project,p['id']))
    state=automation.start(p['id'],{'kind':'visuals',**preview})
    assert state['total']==0 and state['skipped']==6 and state['manual_video_count']==2
