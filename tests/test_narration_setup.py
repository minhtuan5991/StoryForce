import pytest
from conftest import confirm_setup, build_story
from backend.models import Artifact, Chunk, Job, Project, Channel
from backend.narration import project_voice
from test_story_entry import imported_project, bible
from test_premise_reuse import finished
from test_deletion import preview, confirm


def voice(client, channel_id, speaker='Fola', style='Calm, intimate, measured pauses.'):
    response=client.put('/api/channels/'+channel_id+'/narration',json={'speaker':speaker,'style':style})
    assert response.status_code==200,response.text
    return response.json()['settings']['narration_voice']


def test_channel_voice_is_saved_without_changing_dna_or_other_settings(client,project):
    before=client.get('/api/channels/'+project['channel_id']).json()
    chosen=voice(client,project['channel_id'],'  Fola  ','  A steady pace.  ')
    after=client.get('/api/channels/'+project['channel_id']).json()
    assert chosen=={'speaker':'Fola','style':'A steady pace.'}
    assert after['dna']==before['dna'] and after['creative_guidance']==before['creative_guidance']
    assert {k:v for k,v in after['settings'].items() if k!='narration_voice'}=={k:v for k,v in before['settings'].items() if k!='narration_voice'}
    assert client.put('/api/channels/'+project['channel_id']+'/narration',json={'speaker':'   '}).status_code==422


def test_new_project_inherits_channel_voice_and_override_is_frozen(client,project):
    chosen=voice(client,project['channel_id'])
    base={'channel_id':project['channel_id'],'title':'New channel voice'}
    inherited=client.post('/api/projects',json=base).json()
    override=client.post('/api/projects',json={**base,'narration_voice':{'speaker':'Kore','style':''}}).json()
    voice(client,project['channel_id'],'Another speaker','Another style')
    assert client.get('/api/projects/'+inherited['id']).json()['narration_voice']==chosen
    assert client.get('/api/projects/'+override['id']).json()['narration_voice']=={'speaker':'Kore','style':''}
    assert client.get('/api/projects/'+project['id']).json()['narration_voice']=={'speaker':'Enzo','style':'Friendly'}


@pytest.mark.parametrize('mode',['manual','assisted','auto'])
def test_customize_waits_for_setup_even_after_import_and_direct_jobs_cannot_bypass(client,project,mode):
    client.patch('/api/settings',json={'pipeline_mode':mode,'provider_mode':'browser'})
    p=imported_project(client,project,confirm=False)
    base='/api/projects/'+p['id']
    assert client.post(base+'/story-bible/import',json={'content':bible(client)}).status_code==200
    assert client.post(base+'/pipeline').json()['action_kind']=='project_setup'
    result=client.post('/api/jobs',json={'project_id':p['id'],'kind':'outline','payload':{'auto_continue':True}})
    assert result.status_code==422 and 'Overview' in result.json()['detail']
    assert not client.get(base).json()['jobs']
    chosen=voice(client,project['channel_id'])
    confirm_setup(client,p,target_minutes=12.5,production_options={'music_enabled':True,'image_count':7,'video_count':3})
    detail=client.get(base).json()
    assert not detail['setup_pending'] and detail['target_minutes']==12.5
    assert detail['settings']['visual_options']=={'mode':'custom','image_count':7,'video_count':3}
    assert detail['narration_voice']==chosen
    assert len(detail['jobs'])==1 and detail['jobs'][0]['kind']=='outline'
    assert detail['artifacts']['story_bible']['content']==bible(client)
    assert client.post(base+'/setup',json={'confirmed':True,'target_minutes':8,'production_options':{'image_count':3,'video_count':2}}).status_code==422


def test_setup_rejects_invalid_counts_without_enrolling_or_saving_partial_voice(client,project):
    p=imported_project(client,project,confirm=False);base='/api/projects/'+p['id']
    bad={'confirmed':True,'target_minutes':1,'production_options':{'image_count':3,'video_count':6},'narration_voice':{'speaker':'Fola','style':'Slow'}}
    assert client.post(base+'/setup',json=bad).status_code==422
    bad['production_options']['video_count']=2;bad['confirmed']=False
    assert client.post(base+'/setup',json=bad).status_code==422
    detail=client.get(base).json()
    assert detail['setup_pending'] and not detail['jobs'] and 'assisted_queue' not in detail['settings']


def test_extend_uses_current_channel_voice_and_confirmed_counts_without_new_ideas(client,project):
    ideas,_,_=finished(client,project)
    chosen=voice(client,project['channel_id'])
    client.patch('/api/settings',json={'pipeline_mode':'auto','provider_mode':'browser'})
    child=client.post('/api/projects/'+project['id']+'/select-premise',json={'premise_id':ideas[1]['id']}).json()
    detail=client.get('/api/projects/'+child['id']).json()
    assert detail['setup_pending'] and not detail['jobs']
    assert detail['narration_voice']==chosen
    confirm_setup(client,child,target_minutes=20,production_options={'image_count':10,'video_count':2,'music_enabled':False})
    detail=client.get('/api/projects/'+child['id']).json()
    assert len(detail['premises'])==1 and detail['premises'][0]['title']==ideas[1]['title']
    assert [j['kind'] for j in detail['jobs']]==['story_bible']
    assert detail['channel_id']==project['channel_id'] and detail['source_id']==project['source_id']


@pytest.mark.parametrize('completed',[False,True])
def test_deleting_extend_returns_only_unfinished_idea_and_preserves_full_step_choice(client,project,completed):
    ideas,_,_=finished(client,project)
    child=client.post('/api/projects/'+project['id']+'/select-premise',json={'premise_id':ideas[1]['id']}).json()
    if completed:
        with client.app.state.database.session() as db:
            db.add(Artifact(project_id=child['id'],kind='render_report',story_version=1,
                content={'file':'projects/old/final_video.mp4','status':'READY','checks':{'video':True,'audio':True}}))
            db.commit()
    assert confirm(client,preview(client,'projects',child['id'])).status_code==200
    detail=client.get('/api/projects/'+project['id']).json()
    assert ideas[0]['id'] in detail['premise_pool']['used_premise_ids']
    assert (ideas[1]['id'] in detail['premise_pool']['used_premise_ids'])==completed
    result=client.post('/api/projects/'+project['id']+'/select-premise',json={'premise_id':ideas[1]['id']})
    assert result.status_code==(422 if completed else 200)
    if not completed:assert result.json()['id']!=child['id']


def test_tts_chunks_and_browser_job_use_the_same_confirmed_voice(client,project):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.settings={**p.settings,'narration_voice':{'speaker':'Fola','style':'Calm and clear.'}};db.commit()
    build_story(client,project)
    result=client.post('/api/jobs',json={'project_id':project['id'],'kind':'chunk_tts'})
    assert result.status_code==200,result.text
    detail=client.get('/api/projects/'+project['id']).json()
    assert all(c['voice_profile']['voice_name']=='Fola' and c['voice_profile']['style']=='Calm and clear.' for c in detail['chunks'])
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'manual'})
    response=client.post('/api/projects/'+project['id']+'/media-automation/start',json={'kind':'tts'})
    assert response.status_code==200,response.text
    detail=client.get('/api/projects/'+project['id']).json()
    pending=next(j for j in detail['jobs'] if j['kind']=='tts_context')
    media=pending['payload']['_media']
    assert (media['voice'],media['style'])==('Fola','Calm and clear.')
    assert media['tts']=={'voice':'Fola','style':'Calm and clear.','model':'Gemini 3.8 Flash TTS'}


def test_correcting_voice_before_tts_updates_all_chunks_but_refuses_existing_audio(client,project):
    with client.app.state.database.session() as db:
        db.add(Chunk(project_id=project['id'],story_version=0,number=1,text='Narration',word_count=1,estimated_duration=1,voice_profile={'segment_role':'outro'}));db.commit()
    base='/api/projects/'+project['id']+'/narration'
    assert client.put(base,json={'speaker':'Fola','style':'Soft'}).status_code==200
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);c=db.query(Chunk).filter_by(project_id=p.id).one()
        assert c.voice_profile=={'segment_role':'outro','voice_name':'Fola','style':'Soft'}
        c.asset_id='already-produced';db.commit()
    response=client.put(base,json={'speaker':'Kore','style':'New'})
    assert response.status_code==422
    assert client.get('/api/projects/'+project['id']).json()['narration_voice']=={'speaker':'Fola','style':'Soft'}
