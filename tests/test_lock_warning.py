from conftest import build_story


def test_warning_override_records_consent_without_changing_verification(client, project):
    path='/api/projects/'+project['id']
    original=build_story(client,project,lock=False)
    # Editing the draft invalidates both prior verifications.
    client.patch(path,json={'draft':original['draft']+'\nThe story continued.'})
    current=client.get(path).json()
    assert not current['lock_gate']['can_lock']
    assert client.post(path+'/lock').status_code==422
    body={'confirm_warnings':True,'approval_token':current['lock_gate']['approval_token']}
    response=client.post(path+'/lock',json=body)
    assert response.status_code==200,response.text
    after=client.get(path).json()
    assert after['locked']
    approval=after['artifacts']['story_lock_approval']
    assert approval['provider']=='human'
    assert approval['content']['confirmed_warnings']==current['lock_gate']['reasons']
    assert approval['story_version']==after['story_version']
    for kind in ('final_verify_gemini','final_verify_chatgpt'):
        assert after['artifacts'][kind]==current['artifacts'][kind]
    assert after['issues']==current['issues']


def test_warning_override_rejects_empty_stale_and_active_projects(client, project):
    path='/api/projects/'+project['id']
    empty=client.get(path).json()
    assert client.post(path+'/lock',json={'confirm_warnings':True,'approval_token':empty['lock_gate']['approval_token']}).status_code==422
    built=build_story(client,project,lock=False)
    client.patch(path,json={'draft':built['draft']+'\nNew draft.'})
    assert client.post(path+'/lock',json={'confirm_warnings':True,'approval_token':built['lock_gate']['approval_token']}).status_code==422
    current=client.get(path).json()
    client.patch('/api/settings',json={'provider_mode':'browser'})
    client.post('/api/jobs',json={'kind':'final_verify_gemini','project_id':project['id']})
    assert client.post(path+'/lock',json={'confirm_warnings':True,'approval_token':current['lock_gate']['approval_token']}).status_code==422
    assert not client.get(path).json()['locked']
