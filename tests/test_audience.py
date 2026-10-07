from copy import deepcopy
import sqlite3
import pytest
from conftest import build_story, job
from backend import audience
from backend.database import Database
from backend.models import Project, Premise, Artifact, Job
from backend.channel_learning import learning_data, ObservedMetrics


def test_retention_requires_real_evidence_all_zones_and_no_false_pass(client,project):
    detail=build_story(client,project)
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.locked=False
        result=deepcopy(detail['artifacts']['retention_audit']['content'])
        result['zones'][0]['status']='FAIL'
        with pytest.raises(ValueError,match='cannot pass'):audience.validate_audit(db,p,result)
        result['zones'][0]['status']='PASS';result['zones'][0]['evidence']='Invented evidence that is not in the story'
        with pytest.raises(ValueError,match='exact evidence'):audience.validate_audit(db,p,result)
        result=deepcopy(detail['artifacts']['retention_audit']['content']);result['zones'].pop()
        with pytest.raises(ValueError,match='every provided'):audience.validate_audit(db,p,result)
        result=deepcopy(detail['artifacts']['retention_audit']['content'])
        result['zones'][3]['status']='NOT_APPLICABLE'
        with pytest.raises(ValueError,match='Only time zones'):audience.validate_audit(db,p,result)


def test_long_story_checks_late_stalls_short_story_skips_nonexistent_zones():
    clock=audience.timed_zones(' '.join(['word']*9000),150)
    assert any(z['start_seconds']<=480<z['end_seconds'] for z in clock['zones'])
    assert clock['zones'][-1]['end_seconds']==3600
    short=audience.timed_zones(' '.join(['word']*60),150)
    assert short['estimated_seconds']==24
    assert not next(z for z in short['zones'] if z['id']=='60-90')['applicable']


def test_failed_reset_gate_is_reported_and_targeted_repair_invalidates_dual_verify(client,project):
    detail=build_story(client,project)
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.locked=False
        a=db.get(Artifact,detail['artifacts']['retention_audit']['id'])
        # Make each passage unique, then assess that exact current text.
        p.draft=' '.join(f'Sentence {i} records another decision and its immediate consequence.' for i in range(90))
        context=client.app.state.workflow.context(db,Job(kind='retention_audit',project_id=p.id,payload={}))
        result=client.app.state.workflow.mock.generate('retention_audit',context,'')
        zone=audience.timed_zones(p.draft,p.wpm)['zones'][2]
        quote=p.draft[zone['start_char']:zone['start_char']+80]
        result.update(retention_readiness_passed=False,issues=[{'issue_id':'RET-RESET','zone_id':'30-60','severity':'HIGH','type':'RESET_AFTER_HOOK',
                                                              'evidence':quote,'retention_risk':'Background resets the opening','suggested_repair':'Continue the current question'}])
        result['zones'][2]['status']='FAIL'
        a.content=audience.validate_audit(db,p,result);db.commit()
    path='/api/projects/'+project['id']
    current=client.get(path).json()
    assert not current['lock_gate']['can_lock'] and current['next']['kind']=='retention_rewrite'
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);version=p.story_version
        from backend.workflow import set_draft
        lo=p.draft.index(quote)
        old=p.draft[lo:lo+180]
        with pytest.raises(ValueError):audience.apply_repairs(db,p,{'replacements':[{'issue_id':'RET-RESET','old_text':'invented','new_text':'new'}]},set_draft)
        audience.apply_repairs(db,p,{'replacements':[{'issue_id':'RET-RESET','old_text':old,'new_text':old+' A new signal interrupted me.'}]},set_draft)
        assert p.story_version==version+1
        assert audience.readiness(db,p)['status']=='STALE'


def test_existing_project_not_assessed_and_no_forced_production_block(client,project):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.settings={};db.commit()
    detail=client.get('/api/projects/'+project['id']).json()
    assert detail['audience_readiness']['status']=='NOT_ASSESSED'
    assert not detail['audience_readiness']['required']


def test_passed_verification_locks_automatically_even_when_old_setting_is_off(client,project):
    client.patch('/api/settings',json={'auto_lock':False})
    detail=build_story(client,project,lock=False)
    assert detail['locked'] and detail['chunks']
    assert detail['audience_readiness']['youtube_readiness_passed']
    changed=client.patch('/api/projects/'+project['id'],json={'draft':detail['draft']+' Another clue.'}).json()
    assert not changed['locked']
    assert client.get('/api/projects/'+project['id']).json()['audience_readiness']['status']=='STALE'


def test_current_pass_starts_browser_tts_without_a_visual_plan_or_user_lock(client,project):
    detail=build_story(client,project)
    with client.app.state.database.session() as db:
        from backend.models import Chunk
        p=db.get(Project,project['id']);p.locked=False
        db.query(Chunk).filter_by(project_id=p.id).delete()
        trigger=db.query(Job).filter_by(project_id=p.id,kind='final_verify_chatgpt',status='completed').one().id
        db.commit()
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'manual','auto_lock':False})
    token=client.post('/api/settings/pair-bridge').json()['token']
    client.app.state.workflow.continue_pipeline(trigger)
    current=client.get('/api/projects/'+project['id']).json()
    assert current['locked'] and current['chunks'] and not current['scenes']
    assert current['settings']['media_automation']['kind']=='tts'
    waiting=client.get('/api/bridge/jobs',headers={'X-Bridge-Token':token}).json()['items']
    assert len(waiting)==1 and waiting[0]['media']['filename']=='tts_001.wav'
    assert not current['settings'].get('production_queue')


def test_missing_observed_values_null_optional_reminders_do_not_block(client,project):
    path='/api/projects/'+project['id']
    client.patch(path,json={'publish':{'url':'https://www.youtube.com/watch?v=test','date':'2026-08-01','title':'Actual title'}})
    reminders=client.get('/api/analytics/reminders').json()['items']
    assert {r['horizon_days'] for r in reminders}=={7,28}
    assert client.post(path+'/analytics-reminder-dismiss',json={'horizon_days':7}).json()['optional']
    r=client.post('/api/analytics',json={'project_id':project['id'],'date':'2026-08-08','metrics':{'video_duration_seconds':300,'horizon_days':7,'views':0}})
    assert r.status_code==200,r.text
    m=r.json()['metrics'];assert m['ctr'] is None and m['views']==0 and m['title_used']=='Actual title'
    assert m['retention_600'] is None
    assert client.get('/api/projects/'+project['id']).json()['next']['kind']=='content_direction'
    assert client.post('/api/analytics',json={'project_id':project['id'],'date':'2026-08-09','metrics':{'video_duration_seconds':60,'retention_90':10}}).status_code==422


def test_learning_requires_comparable_data_and_is_consumed_without_copying(client,project):
    channel=project['channel_id'];rows=[]
    with client.app.state.database.session() as db:
        for i in range(10):
            p=Project(channel_id=channel,title=f'Observed {i}');db.add(p);db.flush()
            pr=Premise(project_id=p.id,title=p.title,logline='Different surface',packaging={'abstract_pattern':'Warning creates a moral choice'})
            db.add(pr);db.flush();p.selected_premise_id=pr.id;rows.append(p.id)
        db.commit()
    for i,id in enumerate(rows):
        metrics={'video_duration_seconds':600,'horizon_days':7,'traffic_source':'Browse','views':400,'impressions':4000,
                 'ctr':8 if i<3 else 4,'retention_30':90 if i<3 else 60,'average_percentage_viewed':75 if i<3 else 40}
        assert client.post('/api/analytics',json={'project_id':id,'date':'2026-09-08','metrics':metrics}).status_code==200
        if i==1:
            assert not client.get('/api/analytics').json()['learning']['learned_patterns']
    learned=client.get('/api/analytics').json()['learning']
    assert learned['learned_patterns'][0]['promising_count']==3
    assert not learned['automatic_dna_changes']
    with client.app.state.database.session() as db:
        context=client.app.state.workflow.context(db,Job(kind='premise_generation',project_id=project['id'],payload={}))
        assert context['channel_learning']['learned_patterns']
    job(client,project,'content_direction');job(client,project,'premise_generation')
    premises=client.get('/api/projects/'+project['id']).json()['premises']
    assert all(any(w['scope']=='LEARNED_PATTERN' for w in p['warnings']) for p in premises)
    assert all(p['scores']['channel_repetition']>=30 for p in premises)


def test_schema_migration_preserves_old_rows_and_adds_optional_fields(tmp_path):
    tmp_path.mkdir(exist_ok=True)
    first=Database(tmp_path)
    with first.session() as db:
        from backend.models import Channel
        c=Channel(name='Preserved channel');db.add(c);db.flush()
        p=Project(channel_id=c.id,title='Preserved project');db.add(p);db.commit();pid=p.id
    first.engine.dispose()
    with sqlite3.connect(tmp_path/'storyforge.db') as db:
        db.execute('ALTER TABLE premises DROP COLUMN packaging');db.execute('ALTER TABLE analytics DROP COLUMN metrics')
        db.execute('DELETE FROM schema_migrations WHERE version>=2')
    updated=Database(tmp_path)
    with updated.session() as db:
        assert db.get(Project,pid).title=='Preserved project' and not db.get(Project,pid).settings
        assert db.execute(__import__('sqlalchemy').text('SELECT MAX(version) FROM schema_migrations')).scalar()==3
    updated.engine.dispose()
