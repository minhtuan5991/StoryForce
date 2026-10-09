from copy import deepcopy

import pytest

from conftest import job
from backend import audience
from backend.models import Artifact, Job, Project


def clean_story_audit(client, monkeypatch):
    original = client.app.state.workflow.mock.generate
    def generate(kind, context, prompt):
        if kind == 'gemini_story_audit':
            return {'issues': [], 'summary': 'Independent audit found no issues.'}
        return original(kind, context, prompt)
    monkeypatch.setattr(client.app.state.workflow.mock, 'generate', generate)


def through_outline(client, project):
    client.patch('/api/settings', json={'pipeline_mode': 'manual'})
    for kind in ('content_direction', 'premise_generation', 'premise_mini_test'):
        job(client, project, kind)
    detail = client.get('/api/projects/' + project['id']).json()
    client.post('/api/projects/' + project['id'] + '/select-premise',
                json={'premise_id': detail['premises'][0]['id']})
    for kind in ('story_bible', 'outline', 'outline_audit'):
        job(client, project, kind)


@pytest.mark.parametrize('compact', [True, False])
def test_automatic_calls_are_reduced_without_removing_final_checks_or_human_gates(client, project, monkeypatch, compact):
    clean_story_audit(client, monkeypatch)
    client.patch('/api/settings', json={'pipeline_mode': 'auto', 'streamlined_workflow': compact})
    response = client.post('/api/projects/' + project['id'] + '/pipeline')
    assert response.status_code == 200, response.text
    detail = client.get('/api/projects/' + project['id']).json()
    records = [r for r in client.get('/api/jobs').json()['items'] if r['project_id'] == project['id']]
    assert all(r['status'] == 'completed' for r in records), records
    rewrite = next(r for r in records if r['kind'] == 'outline_rewrite')
    assert rewrite['provider'] == ('local' if compact else 'mock:chatgpt')
    assert ('opening_variants' in detail['artifacts']) == (not compact)
    assert any(r['kind'] == 'retention_audit' for r in records) == (not compact)
    assert sum(bool(p['mini_test']) for p in detail['premises']) == (1 if compact else 3)
    assert detail['selected_premise_id'] == detail['premises'][0]['id']
    assert detail['audience_readiness']['retention_readiness_passed']
    assert detail['lock_gate']['can_lock']
    assert not detail['locked'] and not detail['chunks'] and not detail['scenes']
    assert detail['next']['checkpoint'] == 'Review and approve Story Lock.'
    assert detail['artifacts']['final_verify_gemini']['provider'] == 'mock:gemini'
    assert detail['artifacts']['final_verify_chatgpt']['provider'] == 'mock:chatgpt'
    if compact:
        assert detail['artifacts']['chatgpt_cross_review']['content']['retention_status'] == 'ASSESSED'
        draft = next(r for r in records if r['kind'] == 'full_draft')
        assert 'strongest single opening directly in this draft' in draft['prompt']


@pytest.mark.parametrize('change', ['none', 'issues', 'changed_outline', 'legacy_hash', 'manual'])
def test_outline_reuse_requires_current_passed_audit_and_automatic_request(client, project, change):
    through_outline(client, project)
    with client.app.state.database.session() as db:
        outline = db.query(Artifact).filter_by(project_id=project['id'], kind='outline').one()
        audit = db.query(Artifact).filter_by(project_id=project['id'], kind='outline_audit').one()
        original = deepcopy(outline.content)
        if change == 'issues':
            audit.content = {**audit.content, 'issues': [{'issue_id': 'STRUCTURE-1'}]}
        elif change == 'changed_outline':
            outline.content = {**outline.content, 'summary': 'Changed after audit.'}
        elif change == 'legacy_hash':
            audit.content = {k: v for k, v in audit.content.items() if k != 'audited_outline_hash'}
        db.commit()
    result = job(client, project, 'outline_rewrite', {'auto_continue': change != 'manual'})
    with client.app.state.database.session() as db:
        record = db.query(Job).filter_by(project_id=project['id'], kind='outline_rewrite').one()
        assert (record.provider == 'local') == (change == 'none')
        if change == 'none':
            assert result['scenes'] == original['scenes']
            assert db.query(Artifact).filter_by(project_id=project['id'], kind='outline').one().content == original


def pending_combined_review(client, project, monkeypatch):
    clean_story_audit(client, monkeypatch)
    through_outline(client, project)
    for kind in ('outline_rewrite', 'full_draft', 'gemini_story_audit'):
        job(client, project, kind)
    client.patch('/api/settings', json={'provider_mode': 'browser'})
    record = client.post('/api/jobs', json={'kind': 'chatgpt_cross_review', 'project_id': project['id']}).json()
    with client.app.state.database.session() as db:
        saved = db.get(Job, record['id'])
        assert saved.payload['_combined_retention']
        assert 'Combined response contract' in saved.prompt
        context = client.app.state.workflow.context(db, saved)
        response = client.app.state.workflow.mock.generate('chatgpt_cross_review', context, saved.prompt)
    return record['id'], response


@pytest.mark.parametrize('invalid', ['missing', 'zones', 'invented_evidence'])
def test_invalid_combined_retention_keeps_independent_review_and_requires_separate_audit(client, project, monkeypatch, invalid):
    id, output = pending_combined_review(client, project, monkeypatch)
    if invalid == 'missing':output.pop('retention')
    elif invalid == 'zones':output['retention']['zones'] = []
    else:output['retention']['zones'][0]['evidence'] = 'An invented sentence that never appears.'
    result = client.post('/api/jobs/' + id + '/result', json={'result': output})
    assert result.status_code == 200, result.text
    detail = client.get('/api/projects/' + project['id']).json()
    assert detail['artifacts']['chatgpt_cross_review']['content']['retention_status'] == 'NEEDS_SEPARATE_ASSESSMENT'
    assert 'retention_audit' not in detail['artifacts']
    assert not detail['lock_gate']['can_lock']
    assert detail['next']['kind'] == 'retention_audit'


def test_combined_assessment_cannot_apply_after_outline_changes(client, project, monkeypatch):
    id, output = pending_combined_review(client, project, monkeypatch)
    with client.app.state.database.session() as db:
        outline = db.query(Artifact).filter_by(project_id=project['id'], kind='outline_rewrite').one()
        outline.content = {**outline.content, 'summary': 'A revised current outline.'}
        db.commit()
    result = client.post('/api/jobs/' + id + '/result', json={'result': output})
    assert result.status_code == 422 and 'packaging changed' in result.text
    detail = client.get('/api/projects/' + project['id']).json()
    assert 'chatgpt_cross_review' not in detail['artifacts'] and 'retention_audit' not in detail['artifacts']


def test_repair_after_combined_audit_requires_current_retention_reassessment(client, project):
    through_outline(client, project)
    for kind in ('outline_rewrite', 'full_draft', 'gemini_story_audit', 'chatgpt_cross_review'):
        job(client, project, kind)
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        assert audience.readiness(db, p)['status'] == 'ASSESSED'
    job(client, project, 'targeted_rewrite')
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        assert audience.readiness(db, p)['status'] == 'STALE'
        assert client.app.state.workflow.next_step(db, p)['kind'] == 'retention_audit'


def test_efficiency_settings_remain_user_options_with_boolean_validation(client):
    initial = client.get('/api/settings').json()
    assert initial['streamlined_workflow'] and initial['render_smart_join']
    result = client.patch('/api/settings', json={'streamlined_workflow': False, 'render_smart_join': False})
    assert result.status_code == 200
    saved = client.get('/api/settings').json()
    assert not saved['streamlined_workflow'] and not saved['render_smart_join']
    assert client.patch('/api/settings', json={'render_smart_join': 'false'}).status_code == 422
