from copy import deepcopy
import io
import json
import pytest
from PIL import Image
from conftest import job
from backend import premise_policy
from backend.models import Artifact, Job, Project
from backend.story_import import validate_import
from test_media import wav_data


def imported_project(client, project):
    response=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Supplied Bible',
                        'entry_mode':'existing_bible','target_minutes':5,'duration_mode':'5'})
    assert response.status_code==200,response.text
    return response.json()


def bible(client):
    return deepcopy(client.app.state.workflow.mock.fixture['story_bible'])


def test_import_mode_starts_at_bible_and_blocks_skipped_jobs(client,project):
    p=imported_project(client,project)
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['stage']=='BIBLE' and not detail['premises']
    assert detail['next']['action_kind']=='import_bible'
    assert client.post('/api/projects/'+p['id']+'/pipeline').json()['action_kind']=='import_bible'
    for kind in ('content_direction','premise_generation','premise_mini_test','story_bible'):
        assert client.post('/api/jobs',json={'kind':kind,'project_id':p['id']}).status_code==422
    assert not client.get('/api/projects/'+p['id']).json()['jobs']
    assert client.post('/api/projects',json={'channel_id':p['channel_id'],'title':'Bad mixed mode',
                        'source_id':project['source_id'],'entry_mode':'existing_bible'}).status_code==422


def test_import_accepts_fenced_json_preserves_extra_data_and_is_idempotent(client,project):
    p=imported_project(client,project)
    content=bible(client);content['custom_notes']={'plot_guard':'Keep the final decision','references':[1,2]}
    url='/api/projects/'+p['id']+'/story-bible/import'
    saved=client.post(url,json={'content':'```json\n'+json.dumps(content)+'\n```'})
    assert saved.status_code==200,saved.text
    assert saved.json()['content']==content and saved.json()['provider']=='manual_import'
    assert client.post(url,json={'content':{'story_bible':content}}).json()['id']==saved.json()['id']
    client.patch('/api/settings',json={'pipeline_mode':'manual'})
    assert client.post('/api/projects/'+p['id']+'/pipeline').json()['kind']=='outline'
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['artifacts']['story_bible']['content']==content
    assert 'outline' in detail['artifacts'] and not detail['selected_premise_id'] and not detail['premises']
    assert not set(detail['artifacts']) & {'content_direction','premise_generation'}
    with client.app.state.database.session() as db:
        outline=db.query(Job).filter_by(project_id=p['id'],kind='outline').one()
        assert 'authoritative story input supplied by the user' in outline.prompt
        assert 'custom_notes' in outline.prompt and 'Keep the final decision' in outline.prompt
    assert client.post(url,json={'content':content}).status_code==422


@pytest.mark.parametrize('content', ['{broken', [], {}, {'summary':'Story','characters':[],'world_rules':['Rule']},
    {'summary':'Story','characters':[{'name':'A'},{'name':'a'}],'world_rules':['Rule']},
    {'summary':'Story','characters':[{'name':'A'}],'world_rules':[]}])
def test_bad_import_does_not_replace_saved_bible(client,project,content):
    p=imported_project(client,project);url='/api/projects/'+p['id']+'/story-bible/import'
    saved=client.post(url,json={'content':bible(client)}).json()
    assert client.post(url,json={'content':content}).status_code==422
    current=client.get('/api/projects/'+p['id']).json()
    assert current['artifacts']['story_bible']['id']==saved['id'] and not current['jobs']


def test_imported_auto_pipeline_uses_bible_without_premises_and_waits_for_lock(client,project):
    p=imported_project(client,project)
    client.post('/api/projects/'+p['id']+'/story-bible/import',json={'content':bible(client)})
    client.patch('/api/settings',json={'pipeline_mode':'auto'})
    client.post('/api/projects/'+p['id']+'/pipeline')
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['draft'] and detail['lock_gate']['can_lock'],detail['jobs']
    assert not detail['locked'] and not detail['chunks'] and not detail['premises'] and not detail['selected_premise_id']
    assert detail['next']['checkpoint']=='Review and approve Story Lock.'
    assert not {j['kind'] for j in detail['jobs']} & {'story_bible','content_direction','premise_generation','premise_mini_test'}
    assert client.post('/api/projects/'+p['id']+'/pipeline').json()['gate']['can_lock']
    assert not client.get('/api/projects/'+p['id']).json()['locked']


def generated_batch(client,project,count=3):
    workflow=client.app.state.workflow
    with client.app.state.database.session() as db:
        context=workflow.context(db,Job(kind='premise_generation',project_id=project['id'],payload={'count':count}))
    return workflow.mock.generate('premise_generation',context,''), context


def test_source_close_is_pinned_and_scores_distinguish_alignment_from_copying(client,project):
    batch,context=generated_batch(client,project)
    primary=batch['premises'].pop(0);batch['premises'].append(primary)
    primary['scores']['source_dna_alignment']=95
    primary['scores']['source_similarity']=95  # An older rubric conflated conceptual affinity with copying.
    result=premise_policy.validate_batch(batch,context['source'],context['channel'],3)
    assert result['premises'][0]['title']==primary['title']
    assert result['premises'][0]['scores']['surface_similarity_risk']==12
    assert result['premises'][0]['scores']['source_similarity']==12
    assert [p['number'] for p in result['premises']]==[1,2,3]
    assert [p['category'] for p in generated_batch(client,project,10)[0]['premises']]==['Core']*4+['Adjacent']*3+['Experimental']*2+['Wildcard']


def test_failed_idea_one_repair_preserves_other_candidates_and_rejects_old_attempt(client,project):
    job(client,project,'content_direction')
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'auto'})
    client.headers['X-Bridge-Token']=client.post('/api/settings/pair-bridge').json()['token']
    pending=client.post('/api/jobs',json={'kind':'premise_generation','project_id':project['id'],'payload':{'count':3}}).json()
    batch,context=generated_batch(client,project)
    batch['premises'][0]['scores']['hook_clarity']=20
    url='/api/bridge/jobs/'+pending['id']+'/result'
    assert client.post(url,json={'attempt':1,'result':batch}).status_code==200
    current=client.get('/api/projects/'+project['id']).json()
    assert not current['premises']
    retry=next(j for j in current['jobs'] if j['id']==pending['id'])
    assert retry['attempts']==2 and retry['status']=='waiting_user'
    assert 'return ONLY one corrected candidate' in retry['prompt']
    fixed=deepcopy(batch);fixed['premises'][0]['scores']['hook_clarity']=95
    assert client.post(url,json={'attempt':1,'result':fixed}).status_code==422
    repaired={'premises':[fixed['premises'][0]],'source_core':fixed['source_core']}
    assert client.post(url,json={'attempt':2,'result':repaired}).status_code==200
    current=client.get('/api/projects/'+project['id']).json()
    assert [pr['title'] for pr in current['premises']]==[pr['title'] for pr in fixed['premises']]
    assert current['premises'][1]['scores']==batch['premises'][1]['scores']


def test_repair_is_bounded_and_cannot_auto_select_another_idea(client,project):
    job(client,project,'content_direction')
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'auto'})
    client.headers['X-Bridge-Token']=client.post('/api/settings/pair-bridge').json()['token']
    pending=client.post('/api/jobs',json={'kind':'premise_generation','project_id':project['id'],'payload':{'count':3}}).json()
    batch,_=generated_batch(client,project);batch['premises'][0]['scores']['transformative_distance']=1
    url='/api/bridge/jobs/'+pending['id']+'/result'
    assert client.post(url,json={'attempt':1,'result':batch}).status_code==200
    repair={'premises':[batch['premises'][0]],'source_core':batch['source_core']}
    assert client.post(url,json={'attempt':2,'result':repair}).status_code==200
    rejected=client.post(url,json={'attempt':3,'result':repair})
    assert rejected.status_code==422 and 'two repairs' in rejected.text
    detail=client.get('/api/projects/'+project['id']).json()
    assert not detail['selected_premise_id'] and not detail['premises']
    assert next(j for j in detail['jobs'] if j['id']==pending['id'])['attempts']==3


def test_source_expression_reuse_is_rejected(client,project):
    batch,context=generated_batch(client,project)
    context['source']['transcript']=batch['premises'][0]['logline']
    with pytest.raises(premise_policy.CandidateRepairNeeded,match='12-word source expression'):
        premise_policy.validate_batch(batch,context['source'],context['channel'],3)


def test_auto_chooses_first_even_if_another_mini_test_scores_higher(client,project):
    job(client,project,'content_direction');job(client,project,'premise_generation')
    client.patch('/api/settings',json={'pipeline_mode':'manual'})
    job(client,project,'premise_mini_test')
    with client.app.state.database.session() as db:
        rows=premise_policy.ordered(db,project['id']);first=rows[0].id
        rows[0].mini_test={**rows[0].mini_test,'scores':{'opening_strength':85}}
        rows[1].mini_test={**rows[1].mini_test,'scores':{'opening_strength':100}}
        db.commit()
    client.patch('/api/settings',json={'pipeline_mode':'auto','auto_select_premise':False})
    client.post('/api/projects/'+project['id']+'/pipeline')
    detail=client.get('/api/projects/'+project['id']).json()
    assert detail['selected_premise_id']==first and detail['draft'] and not detail['locked']
    assert client.post('/api/projects/'+project['id']+'/lock').status_code==200
    detail=client.get('/api/projects/'+project['id']).json()
    assert detail['locked'] and detail['chunks'] and not detail['scenes']
    assert 'Choose image/video counts' in client.post('/api/projects/'+project['id']+'/pipeline').json()['checkpoint']


def test_auto_sync_waits_for_first_render_until_user_requests_it(client,project):
    client.patch('/api/settings',json={'pipeline_mode':'auto','render_width':320,'render_height':180,'render_fps':12})
    client.post('/api/projects/'+project['id']+'/pipeline')
    client.post('/api/projects/'+project['id']+'/lock')
    job(client,project,'visual_director',{'count':2,'image_count':2,'video_count':0})
    detail=client.get('/api/projects/'+project['id']).json()
    url='/api/projects/'+project['id']
    for chunk in detail['chunks']:
        assert client.post(url+'/assets',files=[('files',(f"tts_{chunk['number']:03}.wav",wav_data(1.5,220+chunk['number']*50),'audio/wav'))]).status_code==200
    for scene in detail['scenes']:
        image=io.BytesIO();Image.new('RGB',(320,180),(scene['number']*45,60,90)).save(image,'PNG')
        assert client.post(url+'/assets',files=[('files',(f"scene_{scene['number']:03}.png",image.getvalue(),'image/png'))]).status_code==200
    job(client,project,'sync',{'auto_continue':True})
    detail=client.get(url).json()
    assert detail['next']['action_kind']=='render' and 'render_report' not in detail['artifacts']
    assert client.post(url+'/pipeline').json()['action_kind']=='render'
    assert not any(j['kind']=='render' for j in client.get(url).json()['jobs'])
    result=job(client,project,'render')
    assert result['status']=='READY'


def test_original_idea_one_does_not_claim_a_source(client,project):
    p=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Original story'}).json()
    job(client,p,'content_direction');job(client,p,'premise_generation')
    detail=client.get('/api/projects/'+p['id']).json()
    assert detail['premises'][0]['rank_role']=='ORIGINAL_PRIMARY'
    assert 'source_core' not in detail['artifacts']['premise_generation']['content']
    assert 'source_relationship' not in detail['premises'][0]


def test_generate_button_in_auto_mode_also_continues_to_story_lock(client,project):
    job(client,project,'content_direction')
    client.patch('/api/settings',json={'pipeline_mode':'auto'})
    job(client,project,'premise_generation',{'count':3})
    detail=client.get('/api/projects/'+project['id']).json()
    assert detail['selected_premise_id']==detail['premises'][0]['id']
    assert detail['draft'] and not detail['locked'] and not detail['chunks']
    assert detail['next']['gate']['can_lock']


def test_repeated_lock_approval_does_not_recreate_narration(client,project):
    client.patch('/api/settings',json={'pipeline_mode':'auto'})
    url='/api/projects/'+project['id']
    client.post(url+'/pipeline');client.post(url+'/lock')
    before=client.get(url).json()
    assert client.post(url+'/lock').status_code==200
    after=client.get(url).json()
    assert [c['id'] for c in before['chunks']]==[c['id'] for c in after['chunks']]
    assert len([j for j in after['jobs'] if j['kind']=='chunk_tts'])==1
