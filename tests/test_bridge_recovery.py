from copy import deepcopy
import pytest

from backend.bridge_recovery import output_error
from backend.models import Artifact, Job, Project
from conftest import build_story
from test_bridge_auto import bridge
from test_bridge_retry import authorize_correction


def pending(client, project, kind='content_direction'):
    client.patch('/api/settings', json={'provider_mode': 'browser', 'pipeline_mode': 'manual'}).raise_for_status()
    headers = bridge(client)
    response = client.post('/api/jobs', json={'kind': kind, 'project_id': project['id']})
    response.raise_for_status()
    identifier = response.json()['id']
    path = '/api/bridge/jobs/' + identifier
    client.post(path + '/claim', headers=headers, json={'owner': 'one', 'attempt': 1, 'authorize_send': True}).raise_for_status()
    return headers, identifier, path


def invalid_json(client, path, headers, repair_id=None):
    body = {'attempt': 1, 'result': 'The JSON is ready, but no JSON was returned.'}
    if repair_id:
        body['repair_id'] = repair_id
    response = client.post(path + '/parse-result', headers=headers, json=body)
    assert response.status_code == 422 and response.json()['code'] == 'INVALID_JSON'


def test_same_chat_correction_is_authorized_once_and_requires_a_real_rejection(client, project):
    headers, identifier, path = pending(client, project)
    body = {'owner': 'one', 'attempt': 1, 'repair_id': 'correction', 'reason': 'INVALID_JSON'}
    assert client.post(path + '/repair', headers=headers, json=body).status_code == 422
    invalid_json(client, path, headers)
    assert client.post(path + '/retry', headers=headers, json={**body, 'retry_id': 'too-early'}).status_code == 422
    first = client.post(path + '/repair', headers=headers, json=body)
    assert first.status_code == 200 and not first.json()['send']
    assert first.json()['repair']['prompt'].startswith('Hãy viết lại câu trả lời chuẩn Json')
    assert client.post(path + '/repair', headers=headers, json=body).json() == first.json()
    for override in ({'owner': 'another'}, {'attempt': 2}, {'repair_id': 'second'}, {'reason': 'TIMEOUT'}):
        assert client.post(path + '/repair', headers=headers, json={**body, **override}).status_code in (409, 422)
    send = {**body, 'authorize_send': True}
    assert client.post(path + '/repair', headers=headers, json=send).json()['send']
    assert not client.post(path + '/repair', headers=headers, json=send).json()['send']
    assert not client.post(path + '/claim', headers=headers, json={'owner': 'one', 'attempt': 1, 'authorize_send': True}).json()['send']
    with client.app.state.database.session() as db:
        job = db.get(Job, identifier)
        assert job.attempts == 1 and job.provider == 'chatgpt' and job.status == 'waiting_user'
        assert db.query(Artifact).filter_by(project_id=project['id'], kind='content_direction').count() == 0
        assert sum('correction authorized' in row['message'] for row in job.logs) == 1


def test_old_response_is_rejected_after_correction_and_new_response_completes_same_attempt(client, project):
    headers, identifier, path = pending(client, project)
    invalid_json(client, path, headers)
    repair_id = authorize_correction(client, path, headers)
    result = {'retain': [], 'transform': [], 'avoid': [], 'emotional_payoff': 'Trust', 'pacing': 'Measured'}
    for suffix, value in (('/result', result), ('/parse-result', '{}')):
        for key in (None, 'wrong-correction'):
            body = {'attempt': 1, 'result': value}
            if key:
                body['repair_id'] = key
            assert client.post(path + suffix, headers=headers, json=body).status_code == 409
    accepted = client.post(path + '/result', headers=headers, json={'attempt': 1, 'repair_id': repair_id, 'result': result})
    assert accepted.json()['accepted']
    with client.app.state.database.session() as db:
        record = db.get(Job, identifier)
        assert record.attempts == 1 and record.status == 'completed'
        artifact = db.query(Artifact).filter_by(project_id=project['id'], kind='content_direction').one()
        assert artifact.content == result and artifact.provider == 'chatgpt'


def test_new_request_needs_a_rejected_correction_and_cannot_reset_the_budget(client, project):
    headers, identifier, path = pending(client, project)
    invalid_json(client, path, headers)
    repair_id = authorize_correction(client, path, headers)
    retry = {'owner': 'one', 'attempt': 1, 'repair_id': repair_id, 'retry_id': 'new-chat', 'reason': 'INVALID_JSON'}
    assert client.post(path + '/retry', headers=headers, json=retry).status_code == 422
    invalid_json(client, path, headers, repair_id)
    first = client.post(path + '/retry', headers=headers, json=retry)
    assert first.status_code == 200
    assert client.post(path + '/retry', headers=headers, json=retry).json() == first.json()
    waiting = next(j for j in client.get('/api/bridge/jobs', headers=headers).json()['items'] if j['id'] == identifier)
    assert waiting['attempt'] == 2 and waiting['response_retry_count'] == 1 and waiting['provider'] == 'chatgpt'
    client.post(path + '/claim', headers=headers, json={'owner': 'one', 'attempt': 2, 'authorize_send': True}).raise_for_status()
    assert client.post(path + '/parse-result', headers=headers, json={'attempt': 2, 'result': 'Invalid again'}).status_code == 422
    assert client.post(path + '/repair', headers=headers, json={**retry, 'attempt': 2, 'repair_id': 'again'}).status_code == 409
    assert client.post(path + '/retry', headers=headers, json={**retry, 'attempt': 2, 'retry_id': 'again'}).status_code == 409
    with client.app.state.database.session() as db:
        assert db.get(Job, identifier).status == 'waiting_user'
        assert db.query(Artifact).filter_by(project_id=project['id'], kind='content_direction').count() == 0


def test_new_request_preserves_a_legacy_tasks_provider_instead_of_switching_to_the_current_default(client, project):
    headers, identifier, path = pending(client, project)
    with client.app.state.database.session() as db:
        db.get(Job, identifier).provider = 'gemini'
        db.commit()
    invalid_json(client, path, headers)
    repair_id = authorize_correction(client, path, headers)
    invalid_json(client, path, headers, repair_id)
    retry = {'owner': 'one', 'attempt': 1, 'repair_id': repair_id, 'retry_id': 'legacy-provider', 'reason': 'INVALID_JSON'}
    client.post(path+'/retry', headers=headers, json=retry).raise_for_status()
    current = next(j for j in client.get('/api/bridge/jobs', headers=headers).json()['items'] if j['id']==identifier)
    assert current['provider']=='gemini' and current['url']=='https://gemini.google.com/app'
    with client.app.state.database.session() as db:
        assert db.get(Job, identifier).result['provider']=='gemini'


def test_missing_fields_return_precise_feedback_and_keep_the_original_contract(client, project):
    headers, identifier, path = pending(client, project)
    rejected = client.post(path + '/result', headers=headers, json={'attempt': 1, 'result': {}})
    assert rejected.status_code == 422 and rejected.json()['code'] == 'OUTPUT_CONTRACT'
    assert 'retain' in rejected.json()['detail']
    body = {'owner': 'one', 'attempt': 1, 'repair_id': 'fields', 'reason': 'OUTPUT_CONTRACT'}
    response = client.post(path + '/repair', headers=headers, json=body)
    prompt = response.json()['repair']['prompt']
    assert prompt.startswith('Viết lại câu trả lời theo đúng yêu cầu') and 'Missing direction field: retain' in prompt
    assert 'emotional_payoff' in prompt and 'Không thay đổi kết luận kiểm duyệt' in prompt
    with client.app.state.database.session() as db:
        assert db.get(Job, identifier).prompt != prompt  # The full original request is retained for a new chat.


def test_length_validation_feedback_does_not_leak_the_rejected_output_and_can_be_repaired(client, project):
    from test_youtube_metadata import ready
    ready(client, project)
    headers, identifier, path = pending(client, project, 'youtube_metadata')
    with client.app.state.database.session() as db:
        record = db.get(Job, identifier)
        valid = client.app.state.workflow.mock.generate('youtube_metadata', client.app.state.workflow.context(db, record), record.prompt)
    bad = deepcopy(valid)
    bad['description'] = 'PRIVATE_RESPONSE_CONTENT ' * 350
    rejected = client.post(path + '/result', headers=headers, json={'attempt': 1, 'result': bad})
    assert rejected.status_code == 422 and rejected.json()['code'] == 'OUTPUT_CONTRACT'
    assert 'PRIVATE_RESPONSE_CONTENT' not in rejected.json()['detail']
    repair_id = authorize_correction(client, path, headers, reason='OUTPUT_CONTRACT')
    accepted = client.post(path + '/result', headers=headers, json={'attempt': 1, 'repair_id': repair_id, 'result': valid})
    assert accepted.status_code == 200 and accepted.json()['accepted']


def test_a_valid_failed_verification_is_saved_without_requesting_a_pass(client, project):
    build_story(client, project, lock=False)
    with client.app.state.database.session() as db:
        db.get(Project, project['id']).locked = False
        db.commit()
    headers, identifier, path = pending(client, project, 'final_verify_gemini')
    result = {'passed': False, 'critical': 1, 'high': 2, 'summary': 'The story still has unresolved issues.'}
    response = client.post(path + '/result', headers=headers, json={'attempt': 1, 'result': result})
    assert response.status_code == 200 and response.json()['accepted']
    with client.app.state.database.session() as db:
        record = db.get(Job, identifier)
        assert record.provider == 'gemini' and not record.result['passed']
        assert '_bridge_repair' not in record.payload and '_bridge_rejection' not in record.payload
        assert not db.get(Project, project['id']).locked


@pytest.mark.parametrize('message', [
    'Maximum audit cycles reached. Human review required.',
    'A premise is already selected. Create a new project for alternative directions.',
    'Replacement affects over 60% of the draft; use manual editing for structural rewrites',
    'Retention repairs must preserve the rest of the story; structural rewrites require manual editing',
    'Not enough narration for the selected videos',
])
def test_workflow_and_manual_editing_gates_are_not_response_format_errors(message):
    assert output_error(ValueError(message)) is None


def test_stale_context_cancelled_jobs_and_media_cannot_authorize_correction(client, project):
    headers, identifier, path = pending(client, project)
    invalid_json(client, path, headers)
    body = {'owner': 'one', 'attempt': 1, 'repair_id': 'repair', 'reason': 'INVALID_JSON'}
    with client.app.state.database.session() as db:
        db.get(Project, project['id']).draft = 'New input while the task was waiting.'
        db.commit()
    assert client.post(path + '/repair', headers=headers, json=body).status_code == 422
    with client.app.state.database.session() as db:
        db.get(Project, project['id']).draft = ''
        db.get(Job, identifier).kind = 'image_generation'
        db.commit()
    assert client.post(path + '/repair', headers=headers, json=body).status_code == 422
    with client.app.state.database.session() as db:
        db.get(Job, identifier).status = 'cancelled'
        db.commit()
    assert client.post(path + '/repair', headers=headers, json=body).status_code == 409


def test_invalid_containers_are_rejected_without_partial_scene_changes(client, project):
    build_story(client, project, lock=False)
    headers, identifier, path = pending(client, project, 'outline_rewrite')
    bad = {'scenes': ['invalid scene']}
    rejected = client.post(path + '/result', headers=headers, json={'attempt': 1, 'result': bad})
    assert rejected.status_code == 422 and rejected.json()['code'] == 'OUTPUT_CONTRACT'
    with client.app.state.database.session() as db:
        assert db.get(Job, identifier).status == 'waiting_user'
