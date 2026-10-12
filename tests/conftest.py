import sys
from pathlib import Path
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.api import create_app


def pytest_configure(config):
    # Keep isolated test databases/media beside the project, including on hosts
    # whose shared Windows temp folder is owned by a different account.
    if not config.option.basetemp:
        (Path(__file__).resolve().parents[1] / '.runtime').mkdir(exist_ok=True)
        config.option.basetemp = str(
            Path(__file__).resolve().parents[1] / '.runtime' / ('pytest-' + uuid4().hex)
        )


class InlineExecutor:
    def submit(self,fn,*args,**kwargs):
        fn(*args,**kwargs)
    def shutdown(self,**kwargs):pass


@pytest.fixture
def client(tmp_path):
    app=create_app(tmp_path)
    app.state.workflow.executor.shutdown(wait=True)
    app.state.workflow.executor=InlineExecutor()
    with TestClient(app) as client:
        token=client.get('/api/session').json()['token']
        client.headers['X-StoryForge-Token']=token
        yield client


@pytest.fixture
def project(client):
    channel=client.post('/api/channels',json={'name':'Test archive','status':'ESTABLISHED','niche':'Mystery'}).json()
    source=client.post('/api/sources',json={'title':'Original motif','transcript':'A storm isolates a station. The keeper must choose whether to trust a warning.','channel_id':channel['id']}).json()
    project=client.post('/api/projects',json={'channel_id':channel['id'],'source_id':source['id'],'title':'Signal test','target_minutes':5,'duration_mode':'5'}).json()
    return project


def job(client,project,kind,payload=None):
    response=client.post('/api/jobs',json={'kind':kind,'project_id':project['id'],'payload':payload or {}})
    assert response.status_code==200,response.text
    records=client.get('/api/jobs').json()['items']
    record=next(j for j in records if j['id']==response.json()['id'])
    assert record['status']=='completed',record
    return record['result']


def confirm_setup(client, project, **overrides):
    production=project.get('settings',{}).get('production_options') or {'music_enabled':False,'image_count':3,'video_count':2}
    response=client.post('/api/projects/'+project['id']+'/setup',json={
        'confirmed':True,'target_minutes':project['target_minutes'],
        'production_options':{key:production[key] for key in ('music_enabled','image_count','video_count')},
        'narration_voice':None,**overrides})
    assert response.status_code==200,response.text
    return response.json()


def build_story(client,project,lock=True):
    # This fixture executes individual steps deliberately; assisted selection
    # now continues the entire pipeline and would duplicate these fixture jobs.
    mode=client.get('/api/settings').json()['pipeline_mode']
    client.patch('/api/settings',json={'pipeline_mode':'manual'}).raise_for_status()
    try:
        for kind in ('content_direction','premise_generation','premise_mini_test'):
            job(client,project,kind)
        detail=client.get('/api/projects/'+project['id']).json()
        response=client.post('/api/projects/'+project['id']+'/select-premise',json={'premise_id':detail['premises'][0]['id']})
        assert response.status_code==200,response.text
        for kind in ('story_bible','outline','outline_audit','outline_rewrite','opening_variants','full_draft','gemini_story_audit','chatgpt_cross_review','targeted_rewrite','retention_audit','final_verify_gemini','final_verify_chatgpt'):
            job(client,project,kind)
        if lock:
            response=client.post('/api/projects/'+project['id']+'/lock')
            assert response.status_code==200,response.text
    finally:
        client.patch('/api/settings',json={'pipeline_mode':mode}).raise_for_status()
    return client.get('/api/projects/'+project['id']).json()


def approve_resources(client,project):
    base='/api/projects/'+project['id']
    review=client.get(base).json()['resource_review']
    response=client.post(base+'/resource-review',json={'confirmed':True,'fingerprint':review['fingerprint']})
    assert response.status_code==200,response.text
    return response.json()
