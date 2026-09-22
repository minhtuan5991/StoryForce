import io
from PIL import Image
from conftest import build_story,job
from test_media import wav_data
from backend.models import Chunk,Asset

def prepare(client,project,upload=True):
    build_story(client,project)
    job(client,project,'chunk_tts')
    job(client,project,'visual_director',{'count':2})
    p=client.get('/api/projects/'+project['id']).json()
    if upload:
        for c in p['chunks']:
            r=client.post('/api/projects/'+p['id']+'/assets',files=[('files',(f"tts_{c['number']:03}.wav",wav_data(frequency=220+c['number']*50),'audio/wav'))])
            assert r.status_code==200,r.text
        for s in p['scenes']:
            buffer=io.BytesIO();Image.new('RGB',(320,180),(s['number']*50,70,120)).save(buffer,format='PNG')
            r=client.post('/api/projects/'+p['id']+'/assets',files=[('files',(f"scene_{s['number']:03}.png",buffer.getvalue(),'image/png'))])
            assert r.status_code==200,r.text
    client.patch('/api/settings',json={'provider_mode':'browser','allow_visual_fallback':True})
    response=client.post('/api/jobs',json={'kind':'tts_context','project_id':p['id'],'payload':{'chunk_id':p['chunks'][0]['id'],'text':p['chunks'][0]['text']}})
    assert response.status_code==200,response.text
    return response.json()['id']

def test_manual_tts_verifies_uploads_and_queues_sync_once(client,project):
    jid=prepare(client,project)
    response=client.post('/api/jobs/'+jid+'/complete-resources')
    assert response.status_code==200,response.text
    result=response.json();assert result['completed'] and result['validation']['valid'],result
    repeat=client.post('/api/jobs/'+jid+'/complete-resources').json()
    assert repeat['next_job_id']==result['next_job_id']
    jobs=client.get('/api/jobs').json()['items']
    assert len([j for j in jobs if j['kind']=='sync'])==1
    assert next(j for j in jobs if j['id']==jid)['status']=='completed'
    assert next(j for j in jobs if j['id']==result['next_job_id'])['status']=='completed'
    assert not any(j['kind']=='render' for j in jobs)

def test_missing_assets_preserves_waiting_even_if_placeholders_enabled(client,project):
    jid=prepare(client,project,upload=False)
    result=client.post('/api/jobs/'+jid+'/complete-resources').json()
    assert not result['completed']
    assert any('tts_' in m for m in result['validation']['missing'])
    assert any('scene_' in m for m in result['validation']['missing'])
    jobs=client.get('/api/jobs').json()['items']
    assert next(j for j in jobs if j['id']==jid)['status']=='waiting_user'
    assert not any(j['kind']=='sync' for j in jobs)

def test_missing_disk_file_and_stale_chunk_block_confirmation(client,project):
    jid=prepare(client,project)
    with client.app.state.database.session() as db:
        c=db.query(Chunk).filter_by(project_id=project['id']).first()
        c.status='STALE';db.commit()
    assert not client.post('/api/jobs/'+jid+'/complete-resources').json()['completed']
    with client.app.state.database.session() as db:
        c=db.query(Chunk).filter_by(project_id=project['id']).first();c.status='ATTACHED'
        a=db.get(Asset,c.asset_id);a.path='projects/missing.wav';db.commit()
    assert not client.post('/api/jobs/'+jid+'/complete-resources').json()['completed']
    client.post('/api/jobs/'+jid+'/cancel')
    assert client.post('/api/jobs/'+jid+'/complete-resources').status_code==422

def test_wrong_kind_and_changed_draft_are_rejected(client,project):
    jid=prepare(client,project)
    jobs=client.get('/api/jobs').json()['items']
    other=next(j for j in jobs if j['kind']=='visual_director')
    assert client.post('/api/jobs/'+other['id']+'/complete-resources').status_code==422
    p=client.get('/api/projects/'+project['id']).json()
    client.patch('/api/projects/'+project['id'],json={'draft':p['draft']+' New ending.'})
    assert client.post('/api/jobs/'+jid+'/complete-resources').status_code==422
