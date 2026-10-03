import json

import pytest

from backend.ai_result import parse_ai_result


EVIDENCE = '''Draft text reads: '"We're going back to the desk." / Back in the lobby, I tried my temporary badge on the testing-lab reader.' '''.strip()


def audit_sample():
    result = {'issues': [
        {'issue_id': f'ISSUE-DRAFT-{i+1:03}', 'severity': severity,
         'type': 'CONTINUITY', 'location': f'project.draft (paragraph {i+1})',
         'evidence': EVIDENCE if i == 2 else 'The badge was in his hand.',
         'explanation': 'Check the on-page setup.', 'suggested_repair': 'Clarify the transition.',
         'bible_references': ['artifacts.story_bible.locations']}
        for i, severity in enumerate(['HIGH', 'MEDIUM', 'LOW', 'SUGGESTION'])],
        'summary': 'Keep every issue and its original severity.'}
    text = json.dumps(result, ensure_ascii=False, indent=2)
    return result, text.replace(json.dumps(EVIDENCE), '"' + EVIDENCE + '"')


@pytest.mark.parametrize('wrapper', ['{}', '```json\n{}\n```', 'Here is the audit:\n```json\n{}\n```', '\ufeff{}'])
def test_recovers_gemini_dialogue_quotes_without_changing_any_audit_field(wrapper):
    expected, malformed = audit_sample()
    with pytest.raises(json.JSONDecodeError):
        json.loads(malformed)
    assert parse_ai_result(wrapper.format(malformed)) == expected


def test_valid_json_escapes_unicode_and_literals_remain_unchanged():
    result = {'issues': [], 'summary': 'He said "stop". 中文, tiếng Việt.\nC:\\media\\clip.wav',
              'nested': {'flag': False, 'null': None, 'numbers': [0, 1.25, -12]}}
    assert parse_ai_result(json.dumps(result, ensure_ascii=False)) == result


def test_literal_newlines_and_unescaped_quotes_preserve_the_text():
    assert parse_ai_result('{"summary":"He said "hello".\nThen he left."}') == {
        'summary': 'He said "hello".\nThen he left.'}


@pytest.mark.parametrize('text', [
    '{"issues":[', '{"issues":[],"summary":"unfinished',
    '{"issues":[],"summary":"finished"', '{"issues":[],}',
    '{"evidence":"one" "summary":"two"}', '{"evidence":"one""summary":"two"}',
    '{"items":["one" "two"]}', '{"items":["one"1]}',
    '{"summary":"The label "Status": Closed"}',
    '{"summary":"He said "hello".","summary":"duplicate"}',
    '{"summary":"bad\\q"}', '[]', '[{"issues":[]}]',
    '{"issues":[]} {"issues":[]}', 'Still generating...',
])
def test_does_not_invent_structure_or_merge_fields_from_invalid_json(text):
    with pytest.raises(ValueError):
        parse_ai_result(text)


def pending_audit(client, project):
    client.patch('/api/projects/' + project['id'], json={'draft': 'A finished draft to audit.'})
    client.patch('/api/settings', json={'provider_mode': 'browser'})
    job = client.post('/api/jobs', json={'project_id': project['id'], 'kind': 'gemini_story_audit'}).json()
    assert client.get('/api/jobs/' + job['id']).json()['status'] == 'waiting_user'
    return job


@pytest.mark.parametrize('bridge', [False, True])
def test_manual_and_bridge_result_routes_keep_all_four_issues(client, project, bridge):
    job = pending_audit(client, project)
    expected, text = audit_sample()
    token = client.post('/api/settings/pair-bridge').json()['token']
    path = '/api/bridge/jobs/' if bridge else '/api/jobs/'
    response = client.post(path + job['id'] + '/result', json={'result': text},
                           headers={'X-Bridge-Token': token} if bridge else {})
    assert response.status_code == 200, response.text
    saved = client.get('/api/jobs/' + job['id']).json()
    assert saved['status'] == 'completed' and saved['result'] == expected
    issues = client.get('/api/projects/' + project['id']).json()['issues']
    assert len(issues) == 4
    assert [issue['severity'] for issue in sorted(issues, key=lambda item: item['issue_key'])] == ['HIGH', 'MEDIUM', 'LOW', 'SUGGESTION']
    assert next(issue for issue in issues if issue['issue_key'] == 'ISSUE-DRAFT-003')['evidence'] == EVIDENCE


def test_bridge_parse_is_paired_read_only_and_rejects_stale_attempts(client, project):
    job = pending_audit(client, project)
    expected, text = audit_sample()
    path = '/api/bridge/jobs/' + job['id'] + '/parse-result'
    body = {'result': text, 'attempt': 1}
    assert client.post(path, json=body).status_code == 403
    headers = {'X-Bridge-Token': client.post('/api/settings/pair-bridge').json()['token']}
    assert client.post(path, json={**body, 'attempt': 2}, headers=headers).status_code == 422
    response = client.post(path, json=body, headers=headers)
    assert response.status_code == 200 and response.json()['result'] == expected
    assert client.get('/api/jobs/' + job['id']).json()['status'] == 'waiting_user'
    assert client.get('/api/projects/' + project['id']).json()['issues'] == []
    assert client.post(path, json={'result': '{"issues":[', 'attempt': 1}, headers=headers).status_code == 422
    assert client.get('/api/jobs/' + job['id']).json()['status'] == 'waiting_user'


def test_recovery_does_not_bypass_audit_schema_or_draft_hash_checks(client, project):
    job = pending_audit(client, project)
    _, text = audit_sample()
    assert client.post('/api/jobs/' + job['id'] + '/result', json={'result': text.replace('"HIGH"', '"URGENT"')}).status_code == 422
    assert client.get('/api/projects/' + project['id']).json()['issues'] == []
    client.patch('/api/projects/' + project['id'], json={'draft': 'A different draft.'})
    response = client.post('/api/jobs/' + job['id'] + '/result', json={'result': text})
    assert response.status_code == 422 and 'draft changed' in response.json()['detail'].lower()
    assert client.get('/api/projects/' + project['id']).json()['issues'] == []
