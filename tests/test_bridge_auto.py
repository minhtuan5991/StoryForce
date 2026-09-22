from backend.models import Job
from test_deletion import add


def bridge(client):
    return {'X-Bridge-Token': client.post('/api/settings/pair-bridge').json()['token']}


def test_claim_and_send_authorization_are_once_per_attempt(client):
    headers=bridge(client)
    id=add(client,Job(kind='content_direction',provider='chatgpt',status='waiting_user',attempts=1,payload={}))
    path='/api/bridge/jobs/'+id+'/claim'
    body={'owner':'browser-one','attempt':1}
    assert client.post(path,json=body,headers={'X-Bridge-Token':''}).status_code==403
    assert client.post(path,json=body,headers=headers).json()['claim']['phase']=='claimed'
    assert client.post(path,json={**body,'owner':'browser-two'},headers=headers).status_code==409
    assert client.post(path,json={**body,'authorize_send':True},headers=headers).json()['send'] is True
    assert client.post(path,json={**body,'authorize_send':True},headers=headers).json()['send'] is False
    jobs=client.get('/api/bridge/jobs',headers=headers).json()['items']
    assert jobs[0]['auto_claim']['phase']=='sent' and jobs[0]['attempt']==1
    with client.app.state.database.session() as db:
        job=db.get(Job,id);job.attempts=2;db.commit()
    assert client.post(path,json=body,headers=headers).status_code==409
    assert client.post(path,json={'owner':'browser-two','attempt':2,'authorize_send':True},headers=headers).json()['send'] is True


def test_cancelled_job_and_media_cannot_be_automatically_sent(client):
    headers=bridge(client)
    for kind,provider,status in [('outline','chatgpt','cancelled'),('image_generation','gemini','waiting_user'),('tts_context','aistudio','waiting_user')]:
        id=add(client,Job(kind=kind,provider=provider,status=status,attempts=1,payload={}))
        response=client.post('/api/bridge/jobs/'+id+'/claim',json={'owner':'one','attempt':1,'authorize_send':True},headers=headers)
        assert response.status_code in (409,422)
