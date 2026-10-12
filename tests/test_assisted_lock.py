from copy import deepcopy

import pytest

from conftest import build_story, job
from backend import audience
from backend.intelligence import digest
from backend.models import Artifact, Issue, Job, Project, StoryVersion
from backend.workflow import assisted_lock_ready, auto_lock_story, latest, lock_story, verification_fingerprint


def draft_before_review(client, project):
    client.patch('/api/settings', json={'pipeline_mode': 'manual'}).raise_for_status()
    for kind in ('content_direction', 'premise_generation', 'premise_mini_test'):
        job(client, project, kind)
    detail = client.get('/api/projects/' + project['id']).json()
    client.post('/api/projects/' + project['id'] + '/select-premise',
                json={'premise_id': detail['premises'][0]['id']}).raise_for_status()
    for kind in ('story_bible', 'outline', 'outline_audit', 'outline_rewrite', 'full_draft'):
        job(client, project, kind)


def disputed_current_reviews(client, project):
    build_story(client, project)
    client.patch('/api/settings', json={'pipeline_mode': 'assisted', 'provider_mode': 'browser'}).raise_for_status()
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        p.locked = False
        db.query(StoryVersion).filter_by(project_id=p.id, version=p.story_version).one().locked = False
        issue = db.query(Issue).filter_by(project_id=p.id, scope='story', cycle=p.audit_cycle).one()
        issue.final_status, issue.fix_status = 'HUMAN_REVIEW', 'OPEN'
        db.add(Artifact(project_id=p.id, kind='disagreement_resolver', story_version=p.story_version,
                        content={'resolutions': [{'issue_id': issue.issue_key, 'verdict': 'UNCERTAIN',
                                                 'reason': 'The review did not settle this issue.'}]}))
        db.flush()
        for kind in ('final_verify_gemini', 'final_verify_chatgpt'):
            report = latest(db, p.id, kind)
            report.content = {**report.content, 'passed': False, 'high': 1, 'critical': 0,
                              'verified_hash': digest(p.draft), 'verification_fingerprint': verification_fingerprint(db, p),
                              'audit_cycle': p.audit_cycle}
        db.commit()


def test_assisted_repairs_confirmed_issues_and_keeps_disputes_then_locks_and_continues(client, project, monkeypatch):
    draft_before_review(client, project)
    workflow = client.app.state.workflow
    original = workflow.mock.generate

    def generate(kind, context, prompt):
        output = original(kind, context, prompt)
        if kind == 'gemini_story_audit':
            confirmed = deepcopy(output['issues'][0])
            confirmed.update(issue_id='FIX-002', severity='MEDIUM', evidence=context['project']['draft'].split('.')[0] + '.')
            output['issues'].append(confirmed)
        elif kind == 'chatgpt_cross_review':
            for review in output['reviews']:
                if review['issue_id'] == 'INV-001':
                    review['verdict'] = 'UNCERTAIN'
        elif kind == 'disagreement_resolver':
            for resolution in output['resolutions']:
                resolution['verdict'] = 'UNCERTAIN'
        return output

    monkeypatch.setattr(workflow.mock, 'generate', generate)
    client.patch('/api/settings', json={'pipeline_mode': 'assisted'}).raise_for_status()
    response = client.post('/api/projects/' + project['id'] + '/pipeline')
    assert response.status_code == 200, response.text
    detail = client.get('/api/projects/' + project['id']).json()
    assert detail['locked'] and detail['chunks'] and not detail['lock_gate']['can_lock']
    issues = {issue['issue_key']: issue for issue in detail['issues'] if issue['scope'] == 'story'}
    assert issues['INV-001']['final_status'] == 'HUMAN_REVIEW' and issues['INV-001']['fix_status'] == 'OPEN'
    assert issues['FIX-002']['final_status'] == 'CONFIRMED' and issues['FIX-002']['fix_status'] == 'FIXED'
    assert all(not detail['artifacts'][kind]['content']['passed'] for kind in ('final_verify_gemini', 'final_verify_chatgpt'))
    approval = detail['artifacts']['story_lock_approval']
    assert approval['provider'] == 'automatic' and approval['content']['automatic']
    assert approval['content']['remaining_warnings'] == detail['lock_gate']['reasons']
    assert all(job['status'] == 'completed' for job in detail['jobs'])
    assert not any(job['kind'] in ('sync', 'render') for job in detail['jobs'])


@pytest.mark.parametrize('invalid', ['missing_verify', 'old_draft', 'old_context', 'old_cycle', 'missing_cross', 'pending', 'active', 'manual', 'auto'])
def test_assisted_does_not_bypass_missing_stale_or_in_progress_reviews_or_other_modes(client, project, invalid):
    disputed_current_reviews(client, project)
    if invalid in ('manual', 'auto'):
        client.patch('/api/settings', json={'pipeline_mode': invalid}).raise_for_status()
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        report = latest(db, p.id, 'final_verify_chatgpt')
        if invalid == 'missing_verify': db.delete(report)
        elif invalid == 'old_draft': report.content = {**report.content, 'verified_hash': 'old'}
        elif invalid == 'old_context': report.content = {**report.content, 'verification_fingerprint': 'old'}
        elif invalid == 'old_cycle': report.content = {**report.content, 'audit_cycle': p.audit_cycle - 1}
        elif invalid == 'missing_cross': db.delete(latest(db, p.id, 'chatgpt_cross_review'))
        elif invalid == 'pending': db.query(Issue).filter_by(project_id=p.id, scope='story').one().final_status = 'PENDING'
        elif invalid == 'active': db.add(Job(project_id=p.id, kind='final_verify_chatgpt', status='waiting_user'))
        db.flush()
        assert not assisted_lock_ready(db, p)
        with pytest.raises(ValueError, match='Complete all current review'):
            lock_story(db, p, automatic=True)
        assert not p.locked


@pytest.mark.parametrize('status', ['queued', 'running'])
def test_assisted_queue_continues_a_reviewed_project_after_restart_with_warnings(client, project, status):
    disputed_current_reviews(client, project)
    workflow = client.app.state.workflow
    with workflow.database.session() as db:
        p = db.get(Project, project['id'])
        workflow.assisted_queue.enroll(p, status)
        db.commit()
    workflow.assisted_queue.tick()
    detail = client.get('/api/projects/' + project['id']).json()
    assert detail['locked'] and detail['chunks']
    assert detail['settings']['media_automation']['kind'] == 'tts'
    assert detail['settings']['assisted_queue']['status'] == 'running'
    assert any(job['kind'] == 'tts_context' and job['status'] == 'waiting_user' for job in detail['jobs'])
    assert not any(job['kind'] in ('sync', 'render') for job in detail['jobs'])


def test_failed_retention_is_repaired_to_limit_before_assisted_lock(client, project):
    disputed_current_reviews(client, project)
    workflow = client.app.state.workflow
    with workflow.database.session() as db:
        p = db.get(Project, project['id'])
        context = workflow.context(db, Job(kind='retention_audit', project_id=p.id, payload={}))
        audit = workflow.mock.generate('retention_audit', context, '')
        zone = audience.timed_zones(p.draft, p.wpm)['zones'][0]
        quote = p.draft[zone['start_char']:zone['start_char'] + 50]
        audit.update(retention_readiness_passed=False, issues=[{
            'issue_id': 'RET-OPENING', 'zone_id': zone['id'], 'severity': 'HIGH', 'type': 'WEAK_HOOK',
            'evidence': quote, 'retention_risk': 'The opening still needs more momentum.',
            'suggested_repair': 'Make the immediate uncertainty clearer.'}])
        audit['zones'][0]['status'] = 'FAIL'
        latest(db, p.id, 'retention_audit').content = audience.validate_audit(db, p, audit)
        db.flush()
        assert not assisted_lock_ready(db, p)
        assert workflow.next_step(db, p)['kind'] == 'retention_rewrite'
        for _ in range(3):
            db.add(Artifact(project_id=p.id, kind='retention_rewrite', story_version=p.story_version,
                            content={'summary': 'Completed targeted repair pass.'}))
        db.flush()
        assert assisted_lock_ready(db, p)
        # Exhausting repair passes never replaces a current final verification.
        report = latest(db, p.id, 'final_verify_chatgpt')
        current = report.content
        report.content = {**current, 'verified_hash': 'old'}
        assert workflow.next_step(db, p)['kind'] == 'final_verify_chatgpt'
        assert not assisted_lock_ready(db, p)
        report.content = current
        workflow.assisted_queue.enroll(p)
        db.commit()
    workflow.assisted_queue.tick()
    detail = client.get('/api/projects/' + project['id']).json()
    assert detail['locked'] and detail['settings']['media_automation']['kind'] == 'tts'
    assert not detail['audience_readiness']['retention_readiness_passed']
    assert detail['artifacts']['story_lock_approval']['content']['remaining_warnings']


def test_assisted_passed_verification_from_an_old_cycle_is_checked_again_before_lock(client, project):
    build_story(client, project)
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        p.locked = False
        p.audit_cycle += 1
        db.commit()
    client.patch('/api/settings', json={'pipeline_mode': 'assisted'}).raise_for_status()
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        assert not auto_lock_story(db, p)
        assert not p.locked
        assert client.app.state.workflow.next_step(db, p)['kind'] == 'final_verify_gemini'
