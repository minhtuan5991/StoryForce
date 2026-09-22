from backend.models import Job
from test_deletion import add
from test_bridge_auto import bridge

class Recorder:
    def __init__(self):self.calls=[]
    def submit(self,*args):self.calls.append(args)
    def shutdown(self,**kwargs):pass

def setup_retry(client,reason='INVALID_JSON'):
    headers=bridge(client)
    jid=add(client,Job(kind='outline',provider='chatgpt',status='waiting_user',attempts=1,payload={'_bridge_auto':{'owner':'one','attempt':1,'phase':'sent' if reason=='INVALID_JSON' else 'claimed'}}))
    recorder=Recorder();client.app.state.workflow.executor=recorder
    body={'owner':'one','attempt':1,'retry_id':'retry-1','reason':reason}
    return headers,jid,body,recorder

def test_retry_is_idempotent_and_records_reason(client):
    headers,jid,body,recorder=setup_retry(client)
    path='/api/bridge/jobs/'+jid+'/retry'
    assert client.post(path,json=body,headers={'X-Bridge-Token':''}).status_code==403
    first=client.post(path,json=body,headers=headers)
    assert first.status_code==200,first.text
    assert client.post(path,json=body,headers=headers).json()==first.json()
    assert len(recorder.calls)==1
    with client.app.state.database.session() as db:
        j=db.get(Job,jid);assert j.status=='queued' and j.attempts==1
        assert j.payload['_bridge_retry']['count']==1
        assert 'INVALID_JSON' in j.logs[-1]['message']

def test_retry_budget_persists_and_owner_attempt_status_are_checked(client):
    headers,jid,body,recorder=setup_retry(client)
    path='/api/bridge/jobs/'+jid+'/retry'
    for change in [{'owner':'other'},{'attempt':0},{'reason':'TIMEOUT'}]:
        assert client.post(path,json={**body,**change},headers=headers).status_code in (409,422)
    for attempt in range(1,4):
        with client.app.state.database.session() as db:
            j=db.get(Job,jid);j.status='waiting_user';j.attempts=attempt
            j.payload={**j.payload,'_bridge_auto':{'owner':'one','attempt':attempt,'phase':'sent'}};db.commit()
        response=client.post(path,json={**body,'attempt':attempt,'retry_id':f'retry-{attempt}'},headers=headers)
        assert response.json()['retry_count']==attempt
    with client.app.state.database.session() as db:
        j=db.get(Job,jid);j.status='waiting_user';j.attempts=4
        j.payload={**j.payload,'_bridge_auto':{'owner':'one','attempt':4,'phase':'sent'}};db.commit()
    assert client.post(path,json={**body,'attempt':4,'retry_id':'four'},headers=headers).status_code==409
    assert len(recorder.calls)==3
    with client.app.state.database.session() as db:
        j=db.get(Job,jid);j.status='cancelled';db.commit()
    assert client.post(path,json={**body,'attempt':4,'retry_id':'cancelled'},headers=headers).status_code==409

def test_presend_retry_and_stale_result_rejection(client):
    headers,jid,body,recorder=setup_retry(client,'SEND_NOT_READY')
    assert client.post('/api/bridge/jobs/'+jid+'/retry',json=body,headers=headers).status_code==200
    with client.app.state.database.session() as db:
        j=db.get(Job,jid);j.status='waiting_user';j.attempts=2
        j.payload={**j.payload,'_bridge_auto':{'owner':'one','attempt':2,'phase':'sent'}};db.commit()
    assert client.post('/api/bridge/jobs/'+jid+'/result',json={'attempt':1,'result':{}},headers=headers).status_code==422
    assert client.post('/api/bridge/jobs/'+jid+'/retry',json={**body,'attempt':2,'retry_id':'other'},headers=headers).status_code==422


def test_real_workflow_retry_regenerates_prompt_and_new_attempt_accepts_result(client,project):
    client.patch('/api/settings',json={'provider_mode':'browser','pipeline_mode':'manual'})
    headers=bridge(client)
    jid=client.post('/api/jobs',json={'kind':'content_direction','project_id':project['id']}).json()['id']
    path='/api/bridge/jobs/'+jid
    old=next(j for j in client.get('/api/bridge/jobs',headers=headers).json()['items'] if j['id']==jid)
    client.post(path+'/claim',headers=headers,json={'owner':'one','attempt':1,'authorize_send':True})
    body={'owner':'one','attempt':1,'retry_id':'real','reason':'INVALID_JSON'}
    assert client.post(path+'/retry',headers=headers,json=body).status_code==200
    new=next(j for j in client.get('/api/bridge/jobs',headers=headers).json()['items'] if j['id']==jid)
    assert new['attempt']==2 and new['prompt']==old['prompt']
    assert client.post(path+'/claim',headers=headers,json={'owner':'one','attempt':2,'authorize_send':True}).json()['send']
    result={'retain':[],'transform':[],'avoid':[],'emotional_payoff':'Trust','pacing':'Measured'}
    assert client.post(path+'/result',headers=headers,json={'attempt':1,'result':result}).status_code==422
    assert client.post(path+'/result',headers=headers,json={'attempt':2,'result':result}).json()['accepted']
    assert not client.get('/api/bridge/jobs',headers=headers).json()['items']
