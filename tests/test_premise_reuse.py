import pytest

from conftest import job
from backend.media import render_inputs_hash
from backend.models import Artifact, Channel, Job, Premise, Project, serialize
from backend.workflow import settings_for


def finished(client, project):
    client.patch('/api/settings', json={'pipeline_mode': 'manual'})
    for kind in ('content_direction', 'premise_generation'):
        job(client, project, kind)
    detail = client.get('/api/projects/' + project['id']).json()
    candidates = detail['premises'][:3]
    with client.app.state.database.session() as db:
        for pr in candidates:
            db.get(Premise, pr['id']).warnings = []
        p = db.get(Project, project['id'])
        p.selected_premise_id = candidates[0]['id']
        p.story_version, p.locked, p.draft = 1, True, 'Finished narration that must remain unchanged.'
        p.publish = {'final_reviewed': True, 'url': 'https://youtube.com/watch?v=finished'}
        p.settings = {'visual_options': {'mode': 'custom', 'image_count': 2, 'video_count': 1},
                      'render_options': {'overlay': True, 'logo_asset_id': 'old-logo'}, 'media_automation': {'old': 1}}
        file = client.app.state.root / 'projects' / p.id / 'render' / 'v1' / 'final_video.mp4'
        file.parent.mkdir(parents=True)
        file.write_bytes(b'original completed video')
        report = Artifact(project_id=p.id, kind='render_report', story_version=1,
                          content={'story_version': 1, 'file': str(file.relative_to(client.app.state.root)),
                                   'inputs_hash': render_inputs_hash(serialize(p), [], [], [], settings_for(db, db.get(Channel, p.channel_id))),
                                   'status': 'READY', 'checks': {'video_present': True}})
        db.add(report)
        db.commit()
        report_id = report.id
    return candidates, report_id, file


def test_other_premises_create_independent_projects_without_changing_finished_work(client, project):
    candidates, _, file = finished(client, project)
    url = '/api/projects/' + project['id']
    before = client.get(url).json()
    assert before['premise_reuse']['ready']
    new_ids = []
    for candidate in candidates[1:]:
        response = client.post(url + '/select-premise', json={'premise_id': candidate['id']})
        assert response.status_code == 200, response.text
        new = response.json()
        assert new['id'] != project['id'] and new['title'] == candidate['title']
        assert new['channel_id'] == project['channel_id'] and new['source_id'] == project['source_id']
        assert (new['target_minutes'], new['wpm'], new['duration_mode']) == (5, 150, '5')
        assert not new['locked'] and not new['draft'] and new['story_version'] == 0
        assert 'render_options' not in new['settings'] and 'media_automation' not in new['settings']
        assert 'final_reviewed' not in new['publish']
        detail = client.get('/api/projects/' + new['id']).json()
        assert len(detail['premises']) == 1
        assert detail['next']['kind'] == 'story_bible'
        assert detail['selected_premise_id'] != candidate['id']
        assert next(p for p in detail['premises'] if p['id'] == detail['selected_premise_id'])['title'] == candidate['title']
        assert detail['artifacts']['content_direction']['content'] == before['artifacts']['content_direction']['content']
        assert not detail['assets'] and not detail['chunks'] and not detail['jobs']
        assert client.post(url + '/select-premise', json={'premise_id': candidate['id']}).json()['id'] == new['id']
        new_ids.append(new['id'])
    assert len(set(new_ids)) == 2
    after = client.get(url).json()
    assert set(after['premise_pool']['used_premise_ids']) == {c['id'] for c in candidates}
    for key in ('title', 'draft', 'locked', 'story_version', 'selected_premise_id', 'settings', 'publish', 'artifacts', 'premises', 'updated_at'):
        assert after[key] == before[key], key
    assert file.read_bytes() == b'original completed video'


@pytest.mark.parametrize('problem', ['unreviewed', 'stale_version', 'missing_video', 'changed_inputs', 'qa_failed', 'busy'])
def test_new_idea_waits_for_current_finished_video(client, project, problem):
    candidates, report_id, file = finished(client, project)
    with client.app.state.database.session() as db:
        p, report = db.get(Project, project['id']), db.get(Artifact, report_id)
        if problem == 'unreviewed': p.publish = {'final_reviewed': False}
        elif problem == 'stale_version': p.story_version = 2
        elif problem == 'missing_video': file.unlink()
        elif problem == 'changed_inputs': p.settings = {}
        elif problem == 'qa_failed': report.content = {**report.content, 'status': 'BLOCKED', 'checks': {'video_present': False}}
        elif problem == 'busy': db.add(Job(project_id=p.id, kind='render', status='running'))
        db.commit()
    detail = client.get('/api/projects/' + project['id']).json()
    assert not detail['premise_reuse']['ready']
    assert client.post('/api/projects/' + project['id'] + '/select-premise', json={'premise_id': candidates[1]['id']}).status_code == 422
    with client.app.state.database.session() as db:
        assert db.query(Project).count() == 1


def test_assisted_branch_continues_only_the_new_project_and_is_idempotent(client, project):
    candidates, _, _ = finished(client, project)
    client.patch('/api/settings', json={'pipeline_mode': 'assisted', 'provider_mode': 'browser'})
    url = '/api/projects/' + project['id'] + '/select-premise'
    new = client.post(url, json={'premise_id': candidates[1]['id']}).json()
    assert new['id'] != project['id']
    assert client.post(url, json={'premise_id': candidates[1]['id']}).json()['id'] == new['id']
    jobs = client.get('/api/projects/' + new['id']).json()['jobs']
    assert len(jobs) == 1 and jobs[0]['kind'] == 'story_bible' and jobs[0]['status'] == 'waiting_user'
    assert not [j for j in client.get('/api/projects/' + project['id']).json()['jobs'] if j['kind'] == 'story_bible']


def test_branch_pipeline_skips_missing_generation_artifact_and_rejects_new_ideas(client, project):
    candidates, _, _ = finished(client, project)
    new = client.post('/api/projects/' + project['id'] + '/select-premise', json={'premise_id': candidates[1]['id']}).json()
    url = '/api/projects/' + new['id']
    detail = client.get(url).json()
    assert detail['next'] == {'kind': 'story_bible'}
    assert detail['premise_pool']['project_id'] == project['id']
    assert candidates[1]['id'] in detail['premise_pool']['used_premise_ids']
    for kind in ('content_direction', 'premise_generation', 'premise_mini_test'):
        assert client.post('/api/jobs', json={'project_id': new['id'], 'kind': kind}).status_code == 422
    with client.app.state.database.session() as db:
        # Legacy branches can lack direction as well as generation artifacts.
        db.query(Artifact).filter_by(project_id=new['id'], kind='content_direction').delete()
        db.commit()
    assert client.get(url).json()['next']['kind'] == 'story_bible'
    result = client.post(url + '/pipeline')
    assert result.status_code == 200, result.text
    assert client.get(url).json()['jobs'][0]['kind'] == 'story_bible'


def test_legacy_paused_premise_generation_does_not_block_finished_pool(client, project):
    candidates, _, file = finished(client, project)
    with client.app.state.database.session() as db:
        stale = Job(project_id=project['id'], kind='premise_generation', status='waiting_user')
        db.add(stale)
        db.commit()
        stale_id = stale.id
    url = '/api/projects/' + project['id']
    assert client.get(url).json()['premise_reuse']['ready']
    result = client.post(url + '/select-premise', json={'premise_id': candidates[1]['id']})
    assert result.status_code == 200, result.text
    with client.app.state.database.session() as db:
        assert db.get(Job, stale_id).status == 'cancelled'
    assert file.read_bytes() == b'original completed video'
