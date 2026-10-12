from copy import deepcopy
import json
import zipfile
from io import BytesIO

import pytest
from sqlalchemy import text

from backend import channel_guidance as guidance, premise_policy
from backend.config import RESOURCE_ROOT
from backend.database import Database
from backend.draft_inputs import full_draft_inputs
from backend.models import Channel, ChannelGuidance, DNAVersion, Job, Novelty, Project, Setting, serialize


def channel(client, name='Heart & Hurdles', niche='Family drama'):
    response = client.post('/api/channels', json={'name':name, 'niche':niche, 'status':'ESTABLISHED'})
    assert response.status_code == 200, response.text
    return response.json()


def project_for(client, c):
    response = client.post('/api/projects', json={'channel_id':c['id'], 'title':'An original story', 'target_minutes':10})
    assert response.status_code == 200, response.text
    return response.json()


def detail(client, c):
    return client.get('/api/channels/'+c['id']).json()


def research(client, c, **body):
    response = client.post('/api/channels/'+c['id']+'/research-dna', json=body)
    assert response.status_code == 200, response.text
    record = next(r for r in detail(client,c)['creative_guidance']['items'] if r['id']==response.json()['guidance_id'])
    return response.json(), record


def apply(client, c, record):
    return client.post('/api/channels/'+c['id']+'/guidance/'+record['id']+'/apply')


def mock_reply(client, identifier):
    with client.app.state.database.session() as db:
        job = db.get(Job,identifier)
        context = client.app.state.workflow.context(db,job)
        return client.app.state.workflow.mock.generate(job.kind,context,job.prompt)


def test_research_is_channel_scoped_three_parts_previewed_and_cached(client):
    c = channel(client,'A new family channel')
    before = detail(client,c)
    _, record = research(client,c)
    assert record['status']=='draft' and record['completed_parts']==3
    assert detail(client,c)['creative_guidance']['active_id'] is None
    assert detail(client,c)['dna']==before['dna'] and detail(client,c)['settings']==before['settings']
    with client.app.state.database.session() as db:
        jobs = db.query(Job).filter_by(channel_id=c['id'],kind='channel_research').all()
        assert len(jobs)==3
        assert [j.payload['part'] for j in jobs]==list(guidance.PARTS)
        assert all(j.status=='completed' and j.provider=='mock:chatgpt' for j in jobs)
        assert all('output_schema' in j.prompt and 'current' not in j.error for j in jobs)
    response, cached = research(client,c)
    assert response['cached'] and cached['id']==record['id']
    assert apply(client,c,record).status_code==200
    assert detail(client,c)['creative_guidance']['active_id']==record['id']


def test_apply_versions_keep_project_snapshot_and_allow_exact_rollback(client):
    c = channel(client)
    p = project_for(client,c)
    frozen = deepcopy(p['settings']['channel_guidance'])
    _, record = research(client,c)
    assert apply(client,c,record).status_code==200
    p2 = project_for(client,c)
    assert p2['settings']['channel_guidance']['id']==record['id']
    with client.app.state.database.session() as db:
        old = db.get(Project,p['id'])
        assert old.settings['channel_guidance']==frozen
        ctx = client.app.state.workflow.context(db,Job(kind='full_draft',project_id=p['id'],payload={}))
        assert ctx['channel_guidance']['id']==frozen['id']
        assert 'channel_guidance' not in ctx['project']['settings']
        assert full_draft_inputs(ctx)['channel_guidance']['id']==frozen['id']
    assert apply(client,c,{'id':frozen['id']}).status_code==200
    assert detail(client,c)['creative_guidance']['active_id']==frozen['id']


def test_dna_change_rejects_old_apply_and_stale_pending_output(client):
    c = channel(client)
    _, record = research(client,c)
    dna = detail(client,c)['dna']
    dna['creative_brief']['hook_style']='Open on a concrete family decision with immediate emotional stakes.'
    assert client.post('/api/channels/'+c['id']+'/dna',json={'dna':dna}).status_code==200
    assert apply(client,c,record).status_code==422
    client.patch('/api/settings',json={'provider_mode':'browser'})
    response, pending = research(client,c,regenerate=True)
    output = mock_reply(client,response['job_id'])
    dna['tone']='Changed while research was pending'
    client.post('/api/channels/'+c['id']+'/dna',json={'dna':dna})
    rejected = client.post('/api/jobs/'+response['job_id']+'/result',json={'result':output})
    assert rejected.status_code==422
    updated = next(r for r in detail(client,c)['creative_guidance']['items'] if r['id']==pending['id'])
    assert updated['stale'] and updated['parts']=={}
    _, fresh = research(client,c,regenerate=True)
    assert fresh['id']!=pending['id']


def test_browser_research_rejects_bad_partial_reply_and_resumes_saved_parts(client):
    c = channel(client)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    response, record = research(client,c)
    path = '/api/jobs/'+response['job_id']+'/result'
    assert client.post(path,json={'result':{'identity':{'audience_promise':'Incomplete'}}}).status_code==422
    assert apply(client,c,record).status_code==422
    with client.app.state.database.session() as db:
        j = db.get(Job,response['job_id'])
        assert j.provider=='chatgpt' and 'creative_brief' in j.prompt
    assert client.post(path,json={'result':mock_reply(client,response['job_id'])}).status_code==200
    saved = next(r for r in detail(client,c)['creative_guidance']['items'] if r['id']==record['id'])
    assert saved['completed_parts']==1
    writing_id = saved['job_ids']['writing']
    with client.app.state.database.session() as db:
        db.get(Job,writing_id).status='failed';db.commit()
    resumed = client.post('/api/channels/'+c['id']+'/guidance/'+record['id']+'/resume')
    assert resumed.status_code==200
    next_id = resumed.json()['job_id']
    assert next_id!=writing_id
    assert client.post('/api/jobs/'+next_id+'/result',json={'result':mock_reply(client,next_id)}).status_code==200
    saved = next(r for r in detail(client,c)['creative_guidance']['items'] if r['id']==record['id'])
    review_id=saved['job_ids']['review_packaging']
    assert client.post('/api/jobs/'+review_id+'/result',json={'result':mock_reply(client,review_id)}).status_code==200
    assert next(r for r in detail(client,c)['creative_guidance']['items'] if r['id']==record['id'])['status']=='draft'
    assert client.post('/api/jobs/'+writing_id+'/result',json={'result':{}}).status_code==422


def test_duplicate_research_click_does_not_dispatch_twice(client):
    c = channel(client)
    calls=[]
    client.app.state.workflow.executor.submit=lambda *args:calls.append(args)
    first, record=research(client,c)
    second, record2=research(client,c,regenerate=True)
    assert first['guidance_id']==second['guidance_id'] and record['job_ids']==record2['job_ids']
    assert len(calls)==1


def test_research_restart_resumes_only_interrupted_section(client):
    c = channel(client)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    response, record = research(client,c)
    client.post('/api/jobs/'+response['job_id']+'/result',json={'result':mock_reply(client,response['job_id'])})
    saved = next(r for r in detail(client,c)['creative_guidance']['items'] if r['id']==record['id'])
    interrupted = saved['job_ids']['writing']
    with client.app.state.database.session() as db:
        db.get(Job,interrupted).step = 'Interrupted by restart. Resume this job.'
        db.commit()
    resumed = client.post('/api/channels/'+c['id']+'/guidance/'+record['id']+'/resume')
    assert resumed.status_code == 200
    assert resumed.json()['job_id'] != interrupted
    with client.app.state.database.session() as db:
        assert db.get(Job,interrupted).status == 'cancelled'
        current = db.get(ChannelGuidance,record['id'])
        assert current.parts == saved['parts']
        assert db.get(Job,resumed.json()['job_id']).payload['part'] == 'writing'


def test_dna_edit_between_saved_section_and_continuation_keeps_completed_job(client):
    c = channel(client)
    calls=[]
    client.app.state.workflow.executor.submit=lambda *args:calls.append(args)
    response, record = research(client,c)
    output=mock_reply(client,response['job_id'])
    with client.app.state.database.session() as db:
        j=db.get(Job,response['job_id'])
        guidance.accept_part(db,j,output)
        j.status='completed'
        changed=db.get(Channel,c['id'])
        changed.dna={**changed.dna,'tone':'A new direction'}
        db.commit()
    client.app.state.workflow.continue_pipeline(response['job_id'])
    with client.app.state.database.session() as db:
        assert db.get(Job,response['job_id']).status == 'completed'
        current=db.get(ChannelGuidance,record['id'])
        assert current.status == 'obsolete' and len(current.parts)==1
    assert len(calls)==1


def test_profiles_isolate_history_and_adapt_horror_source_to_family(client):
    c=channel(client)
    p=project_for(client,c)
    other=channel(client,'The Midnight Log','Horror')
    source={'transcript':'A keeper was isolated in a storm and found a warning that could not be trusted.', 'dna':{'primary_genre':'Horror'}}
    with client.app.state.database.session() as db:
        db.add_all([Novelty(channel_id=c['id'],title='Family memory',signature={}),Novelty(channel_id=other['id'],title='Night memory',signature={})])
        db.commit()
        ctx=client.app.state.workflow.context(db,Job(kind='premise_generation',project_id=p['id'],payload={}))
        assert [n['title'] for n in ctx['novelty_memory']]==['Family memory']
        result=client.app.state.workflow.mock.generate('premise_generation',{**ctx,'source':source},'')
    for item in result['premises']:item['scores']['horror_promise']=None
    validated=premise_policy.validate_batch(result,source,serialize_dict_channel(c,ctx),10,genre_mode='family_drama')
    assert validated['premises'][0]['scores']['genre_promise']>=85
    with pytest.raises(premise_policy.CandidateRepairNeeded):
        premise_policy.validate_batch(result,source,{'niche':'Horror'},10)


def serialize_dict_channel(c,ctx):
    return ctx.get('channel',c)


@pytest.mark.parametrize('kind',['content_direction','premise_generation','story_bible','outline','full_draft','gemini_story_audit','retention_audit'])
def test_midnight_context_and_templates_remain_legacy(client,kind):
    c=channel(client,'The Midnight Log','Mystery and horror')
    p=project_for(client,c)
    assert 'creative_brief' not in c['dna'] and 'channel_guidance' not in p['settings']
    with client.app.state.database.session() as db:
        j=Job(kind=kind,project_id=p['id'],payload={})
        workflow=client.app.state.workflow
        assert workflow.context(db,j)==workflow.base_context(db,j)
    assert not detail(client,c)['creative_guidance']['items']


def test_migration_preserves_midnight_and_old_projects_and_runs_only_once(tmp_path):
    root=tmp_path/'workspace';root.mkdir()
    db1=Database(root)
    dna={'primary_genres':['Horror'],'tone':'Existing tone','core_tropes':[],'narration_style':'Existing voice'}
    with db1.session() as db:
        rows=[Channel(name=n,niche=n,dna=deepcopy(dna),settings={'voice_name':'Enzo'}) for n in ('The Midnight Log','Heart & Hurdles','The Veiled Signal')]
        db.add_all(rows);db.flush()
        p=Project(channel_id=rows[0].id,title='Existing project',settings={'entry_mode':'standard'},draft='An existing draft')
        db.add(p);db.add(Setting(key='pipeline_mode',value='assisted'));db.commit()
        midnight=serialize(rows[0]);old_project=serialize(p)
        db.execute(text('DELETE FROM schema_migrations WHERE version>=6'));db.commit()
    midnight['settings']['narration_voice']={'speaker':'Enzo','style':'Friendly'}
    old_project['settings']['narration_voice']={'speaker':'Enzo','style':'Friendly'}
    db1.engine.dispose()
    db2=Database(root)
    with db2.session() as db:
        assert serialize(db.get(Channel,midnight['id']))==midnight
        assert serialize(db.get(Project,old_project['id']))==old_project
        assert db.get(Setting,'pipeline_mode').value=='assisted'
        assert db.query(ChannelGuidance).count()==2
        family=db.query(Channel).filter_by(name='Heart & Hurdles').one()
        assert family.dna['creative_brief']['genre_mode']=='family_drama'
        family.dna={**family.dna,'tone':'User edited later'};db.commit()
    assert list((root/'backups').glob('before-channel-guidance-*.db'))
    db2.engine.dispose()
    db3=Database(root)
    with db3.session() as db:
        assert db.query(ChannelGuidance).count()==2
        assert db.query(Channel).filter_by(name='Heart & Hurdles').one().dna['tone']=='User edited later'
    db3.engine.dispose()


def test_reference_contract_rejects_false_web_claim_and_settings(client):
    c=channel(client)
    record=guidance.baseline(guidance.default_brief('Heart & Hurdles'))
    part={key:record[key] for key in ('identity','global_rules','hook_examples','avoid','research')}
    part['research']={'mode':'web_references','sources':[],'notes':'No sources'}
    with pytest.raises(ValueError):guidance.validate_part('identity',part)
    part['research']={'mode':'dna_only','sources':[],'notes':'Compiled only'}
    part['settings']={'voice_name':'Different voice'}
    with pytest.raises(ValueError):guidance.validate_part('identity',part)
    dna=detail(client,c)['dna'];dna['creative_brief']['avoid']='Not an array'
    assert client.post('/api/channels/'+c['id']+'/dna',json={'dna':dna}).status_code==422


def test_each_channel_composes_different_prompt_without_changing_settings(client):
    prompts=[]
    for name,niche in [('The Midnight Log','Horror'),('Heart & Hurdles','Family drama'),('The Veiled Signal','Science-fiction mystery')]:
        c=channel(client,name,niche);p=project_for(client,c)
        client.patch('/api/settings',json={'provider_mode':'browser'})
        request=client.post('/api/jobs',json={'kind':'content_direction','project_id':p['id']})
        assert request.status_code==200
        with client.app.state.database.session() as db:
            j=db.get(Job,request.json()['id']);prompts.append(j.prompt)
            assert j.provider=='chatgpt'
            assert db.get(Channel,c['id']).settings=={}
    assert 'CHANNEL CREATIVE DIRECTIONS:' not in prompts[0]
    assert 'family_drama' in prompts[1] and 'plausible human' in prompts[1]
    assert 'speculative_mystery' in prompts[2] and 'fictional hidden' in prompts[2]
    assert len(set(prompts))==3


def test_channel_export_includes_guidance_and_project_snapshot(client):
    c=channel(client);project_for(client,c)
    exported=client.get('/api/channels/'+c['id']+'/export')
    assert exported.status_code==200
    with zipfile.ZipFile(BytesIO(exported.content)) as archive:
        state=json.loads(archive.read('creative_guidance.json'))
        assert state['active_id'] and len(state['items'])==1


def test_thumbnail_and_metadata_fingerprints_use_the_frozen_guidance(client):
    from conftest import job
    from backend.thumbnail_packaging import plan_fingerprint, variant_prompt
    from backend.youtube_metadata import metadata_fingerprint
    from backend.models import Artifact
    c=channel(client);p=project_for(client,c)
    with client.app.state.database.session() as db:
        story=db.get(Project,p['id'])
        story.draft='My brother refused to let our mother come home from the hospital. He gave me a key to a house I had never seen. I found her letters inside and understood why she had been afraid to tell us the truth.'
        story.locked=True;story.story_version=1;db.commit()
    thumbnail=job(client,p,'thumbnail_plan')
    metadata=job(client,p,'youtube_metadata')
    with client.app.state.database.session() as db:
        story=db.get(Project,p['id'])
        assert thumbnail['content_fingerprint']==plan_fingerprint(db,story)
        assert metadata['content_fingerprint']==metadata_fingerprint(db,story)
        plan=db.query(Artifact).filter_by(project_id=p['id'],kind='thumbnail_plan').one()
        prompt=variant_prompt(plan,'A')
        assert 'ominous but readable serif' not in prompt
        assert 'family' in prompt and 'headline are mandatory' in prompt
        db.get(Channel,c['id']).dna={**c['dna'],'tone':'A new future voice'};db.commit()
        assert thumbnail['content_fingerprint']==plan_fingerprint(db,story)
        assert metadata['content_fingerprint']==metadata_fingerprint(db,story)


def test_custom_genre_is_not_classified_by_avoided_horror_or_source(client):
    c=channel(client,'Other channel','Romance')
    source={'transcript':'A strange storm forced a difficult choice that was later explained.', 'dna':{'primary_genre':'Horror'}}
    with client.app.state.database.session() as db:
        ctx={'channel':c,'source':source,'payload':{'count':1}}
        result=client.app.state.workflow.mock.generate('premise_generation',ctx,'')
    result['premises'][0]['scores']['horror_promise']=None
    assert premise_policy.validate_batch(result,source,{'niche':'Romance','dna':{'primary_genres':['Romance'],'avoid_genres':['Horror']}},1,genre_mode='custom')
