import json
import sqlite3
from pathlib import Path
from conftest import job,build_story
from backend.models import Job,Issue,Project,Setting
from backend.database import Database
from backend.config import initialize_folders


def test_channel_crud_dna_history(client):
    c=client.post('/api/channels',json={'name':'Channel one'}).json()
    assert c['status']=='DISCOVERY'
    result=client.patch('/api/channels/'+c['id'],json={'name':'Renamed'})
    assert result.json()['name']=='Renamed'
    dna={'primary_genres':['Mystery'],'tone':'Measured'}
    assert client.post('/api/channels/'+c['id']+'/dna',json={'dna':dna}).status_code==200
    assert client.get('/api/channels/'+c['id']).json()['dna']==dna
    assert len(client.get('/api/channels/'+c['id']).json()['dna_versions'])==2
    assert client.delete('/api/channels/'+c['id']).status_code==200
    assert client.get('/api/channels/'+c['id']).status_code==404


def test_story_dna_persistence_and_fit(client,project):
    response=client.post('/api/jobs',json={'kind':'story_dna','source_id':project['source_id']})
    assert response.status_code==200,response.text
    s=client.get('/api/sources/'+project['source_id']).json()
    assert s['status']=='ANALYZED'
    assert s['dna']['source_specific_elements_to_avoid_copying']
    assert s['fits'][0]['channel_id']==project['channel_id']


def test_empty_url_source_requires_paste(client):
    s=client.post('/api/sources',json={'title':'URL','url':'https://example.com'}).json()
    result=client.post('/api/jobs',json={'kind':'story_dna','source_id':s['id']})
    assert result.status_code==422
    assert 'Paste' in result.text


def test_discovery_establish_requires_explicit_action(client,project):
    client.post('/api/jobs',json={'kind':'discovery','channel_id':project['channel_id']})
    c=client.get('/api/channels/'+project['channel_id']).json()
    assert 2<=len(c['discovery'][0]['content']['hypotheses'])<=5
    plan=client.post('/api/channels/'+c['id']+'/test-plan',json={'hypothesis':'Mystery','count':5})
    assert plan.json()['created']==5
    assert client.get('/api/calendar').json()['items'][0]['category']=='Experimental'


def test_lock_requires_dual_verification_and_exact_version(client,project):
    assert client.post('/api/projects/'+project['id']+'/lock').status_code==422
    detail=build_story(client,project)
    assert detail['locked']
    assert detail['lock_gate']['can_lock']
    assert detail['issues'][0]['fix_status']=='FIXED'
    assert detail['artifacts']['final_verify_gemini']['provider']=='mock:gemini'
    assert detail['artifacts']['final_verify_chatgpt']['provider']=='mock:chatgpt'
    assert 'The emergency radio had no battery.' not in detail['draft']
    changed=client.patch('/api/projects/'+project['id'],json={'draft':detail['draft']+'\n\nThe tide was rising again.'}).json()
    assert not changed['locked']
    assert changed['story_version']==detail['story_version']+1
    assert client.post('/api/projects/'+project['id']+'/lock').status_code==422
    assert len(client.get('/api/novelty').json()['items'])==1


def test_bible_edit_invalidates_verification(client,project):
    detail=build_story(client,project)
    bible=detail['artifacts']['story_bible']
    content={**bible['content'],'world_rules':['No electricity in the station']}
    response=client.patch('/api/artifacts/'+bible['id'],json={'content':content})
    assert response.status_code==200,response.text
    assert not client.get('/api/projects/'+project['id']).json()['lock_gate']['can_lock']
    assert client.get('/api/projects/'+project['id']).json()['next']['kind']=='retention_audit'


def test_cross_review_requires_coverage_and_independent_audit(client,project):
    for k in ('content_direction','premise_generation'):job(client,project,k)
    detail=client.get('/api/projects/'+project['id']).json()
    client.post('/api/projects/'+project['id']+'/select-premise',json={'premise_id':detail['premises'][0]['id']})
    for k in ('story_bible','outline','outline_audit','outline_rewrite','full_draft','gemini_story_audit'):job(client,project,k)
    client.patch('/api/settings',json={'provider_mode':'browser'})
    result=client.post('/api/jobs',json={'project_id':project['id'],'kind':'chatgpt_cross_review'}).json()
    malformed=client.post('/api/jobs/'+result['id']+'/result',json={'result':{'reviews':[],'new_issues':[]}})
    assert malformed.status_code==422
    result=client.post('/api/jobs/'+result['id']+'/result',json={'result':{'reviews':[{'issue_id':'INV-001','verdict':'REJECTED','reason':'Disputed evidence'}],'new_issues':[],'independent_audit_summary':'Independent sweep complete'}})
    assert result.status_code==200,result.text
    detail=client.get('/api/projects/'+project['id']).json()
    assert detail['issues'][0]['final_status']=='RECHECK'
    resolver=client.post('/api/jobs',json={'project_id':project['id'],'kind':'disagreement_resolver'}).json()
    result=client.post('/api/jobs/'+resolver['id']+'/result',json={'result':{'resolutions':[{'issue_id':'INV-001','verdict':'UNCERTAIN','reason':'Evidence remains ambiguous'}]}})
    assert result.status_code==200
    issue=client.get('/api/projects/'+project['id']).json()['issues'][0]
    assert issue['final_status']=='HUMAN_REVIEW'
    assert client.post('/api/projects/'+project['id']+'/lock').status_code==422
    assert client.post('/api/issues/'+issue['id']+'/resolve',json={'status':'CONFIRMED','reason':'The radio must have a battery.'}).status_code==200


def test_pipeline_stops_at_human_checkpoints(client,project):
    client.patch('/api/settings',json={'pipeline_mode':'auto'})
    response=client.post('/api/projects/'+project['id']+'/pipeline')
    assert response.status_code==200
    detail=client.get('/api/projects/'+project['id']).json()
    assert len(detail['premises'])==10
    assert detail['selected_premise_id']==detail['premises'][0]['id']
    assert detail['draft'] and not detail['locked'] and not detail['chunks']
    assert detail['next']['checkpoint']=='Review and approve Story Lock.'
    assert detail['lock_gate']['can_lock']
    assert sum(bool(pr['mini_test']) for pr in detail['premises'])==1


def test_manual_mode_and_default_premise_count(client,project):
    client.patch('/api/settings',json={'pipeline_mode':'manual','default_premise_count':7})
    url='/api/projects/'+project['id']
    assert client.post(url+'/pipeline').status_code==200
    detail=client.get(url).json()
    assert 'content_direction' in detail['artifacts']
    assert not detail['premises']
    assert client.post(url+'/pipeline').status_code==200
    detail=client.get(url).json()
    assert len(detail['premises'])==7
    assert not any(pr['mini_test'] for pr in detail['premises'])
    assert detail['workflow_settings']['default_premise_count']==7
    assert client.patch('/api/settings',json={'pipeline_mode':'invalid'}).status_code==422


def test_assisted_mode_pauses_for_outline_and_draft_review(client,project):
    url='/api/projects/'+project['id']
    client.post(url+'/pipeline')
    detail=client.get(url).json()
    client.post(url+'/select-premise',json={'premise_id':detail['premises'][0]['id']})
    # Selecting a premise now resumes automatically to the outline checkpoint.
    detail=client.get(url).json()
    assert 'outline_rewrite' in detail['artifacts']
    assert not detail['draft']
    client.post(url+'/pipeline')
    detail=client.get(url).json()
    assert detail['draft']
    assert not detail['issues']
    client.post(url+'/pipeline')
    detail=client.get(url).json()
    assert detail['lock_gate']['can_lock']
    assert detail['locked']
    assert detail['chunks']


def test_analytics_latest_snapshot_not_double_counted(client,project):
    for day,views in [('2026-09-01',100),('2026-09-05',250)]:
        assert client.post('/api/analytics',json={'project_id':project['id'],'date':day,'views':views,'ctr':5.2}).status_code==200
    data=client.get('/api/analytics').json()
    assert data['learning']['total_views']==250
    assert data['learning']['sample_size']==1
    assert data['learning']['confidence']=='Insufficient'
    assert not data['learning']['automatic_dna_changes']


def test_security_origin_csrf_and_bridge_pairing(client):
    assert client.post('/api/channels',json={'name':'bad'},headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/channels',json={'name':'bad'},headers={'X-StoryForge-Token':''}).status_code==403
    assert client.get('/api/bridge/jobs').status_code==403
    token=client.post('/api/settings/pair-bridge').json()['token']
    assert client.get('/api/bridge/jobs',headers={'X-Bridge-Token':token}).status_code==200
    assert '_bridge_token' not in client.get('/api/settings').json()
    assert token not in client.get('/api/diagnostics').text
    assert client.get('/api/backup',headers={'Sec-Fetch-Site':'cross-site'}).status_code==403
    assert client.patch('/api/settings',json={'render_width':321}).status_code==422


def test_restart_marks_running_job_resumable(tmp_path):
    initialize_folders(tmp_path)
    first=Database(tmp_path)
    with first.session() as db:
        db.add(Job(kind='render',status='running'));db.commit()
    first.engine.dispose()
    second=Database(tmp_path)
    with second.session() as db:
        assert db.query(Job).first().status=='waiting_user'
    second.engine.dispose()


def test_backup_export_and_csv_import(client,project):
    response=client.post('/api/sources/import',files={'file':('sources.csv',b'title,summary,tags\nTest,A mystery,"one,two"','text/csv')})
    assert response.status_code==200,response.text
    assert response.json()['count']==1
    assert client.get('/api/backup').content.startswith(b'SQLite format 3')
    assert client.get('/api/projects/'+project['id']+'/export').content.startswith(b'PK')
    assert client.post('/api/restore',files={'file':('bad.db',b'not a database')}).status_code in (422,400)
