from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest

from backend.models import Artifact, Job, Novelty, Project, Source


def preview(client, kind, *ids):
    response = client.post('/api/deletions/preview', json={'kind': kind, 'ids': list(ids)})
    assert response.status_code == 200, response.text
    return response.json()


def confirm(client, report):
    return client.post('/api/deletions/confirm', json={key: report[key] for key in ('kind', 'ids', 'confirmation')})


def add(client, record):
    with client.app.state.database.session() as db:
        db.add(record)
        db.commit()
        return record.id


def test_source_delete_requires_confirmation_and_preserves_project_outputs(client, project):
    source = project['source_id']
    original = client.get('/api/projects/' + project['id']).json()
    settings = client.get('/api/settings').json()
    pure = add(client, Artifact(source_id=source, kind='story_dna', content={'test': 1}))
    linked = add(client, Artifact(source_id=source, project_id=project['id'], kind='content_direction', content={'keep': 1}))
    history = add(client, Job(project_id=project['id'], source_id=source, kind='content_direction', status='completed', result={'keep': 1}))
    assert client.delete('/api/sources/' + source).status_code == 409
    report = preview(client, 'sources', source)
    assert not report['blocked'] and report['projects'][0]['id'] == project['id']
    assert 'Linked projects are still in progress.' in report['warnings']
    assert client.get('/api/sources/' + source).status_code == 200  # Preview is read-only.
    assert confirm(client, report).status_code == 200
    with client.app.state.database.session() as db:
        assert db.get(Source, source) is None and db.get(Artifact, pure) is None
        assert db.get(Artifact, linked).content == {'keep': 1}
        assert db.get(Artifact, linked).source_id is None
        assert db.get(Job, history).result == {'keep': 1}
        assert db.get(Project, project['id']).source_id is None
        assert db.get(Project, project['id']).draft == original['draft']
    assert client.get('/api/settings').json() == settings


@pytest.mark.parametrize('status', ['queued', 'running', 'waiting_user'])
def test_source_blocks_linked_project_jobs_and_batch_is_atomic(client, project, status):
    other = client.post('/api/sources', json={'title': 'Unrelated'}).json()['id']
    add(client, Job(project_id=project['id'], kind='content_direction', status=status))
    report = preview(client, 'sources', other, project['source_id'])
    assert report['blocked'] and report['blockers'][0]['status'] == status
    assert confirm(client, report).status_code == 409
    assert client.get('/api/sources/' + other).status_code == 200
    assert client.get('/api/sources/' + project['source_id']).status_code == 200


def test_source_blocks_discovery_and_other_project_in_same_channel(client, project):
    other = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Another story'}).json()
    work = add(client, Job(project_id=other['id'], kind='content_direction', status='running'))
    assert preview(client, 'sources', project['source_id'])['blocked']
    with client.app.state.database.session() as db:
        db.get(Job, work).status = 'completed'
        db.commit()
    add(client, Job(channel_id=project['channel_id'], kind='discovery', status='waiting_user'))
    assert preview(client, 'sources', project['source_id'])['blocked']


def test_confirmation_rechecks_new_active_work_and_stale_content(client, project):
    report = preview(client, 'sources', project['source_id'])
    with client.app.state.database.session() as db:
        db.get(Source, project['source_id']).title = 'Changed after preview'
        db.commit()
    assert confirm(client, report).status_code == 409
    report = preview(client, 'sources', project['source_id'])
    add(client, Job(source_id=project['source_id'], kind='story_dna', status='queued'))
    assert confirm(client, report).status_code == 409


def test_novelty_delete_preserves_story_and_blocks_global_ai_work(client, project):
    memory = add(client, Novelty(project_id=project['id'], channel_id=project['channel_id'], title='Remembered story', signature={'motif': 'storm'}))
    other_channel = client.post('/api/channels', json={'name': 'Other channel'}).json()['id']
    work = add(client, Job(channel_id=other_channel, kind='discovery', status='waiting_user'))
    report = preview(client, 'novelty', memory)
    assert report['blocked'] and confirm(client, report).status_code == 409
    with client.app.state.database.session() as db:
        db.get(Job, work).status = 'cancelled'
        db.commit()
    before = client.get('/api/projects/' + project['id']).json()
    assert confirm(client, preview(client, 'novelty', memory)).status_code == 200
    assert client.get('/api/novelty').json()['items'] == []
    assert client.get('/api/projects/' + project['id']).json() == before


def test_job_delete_only_history_and_warns_unfinished_project(client, project):
    history = add(client, Job(project_id=project['id'], kind='content_direction', status='completed', result={'keep': 1}))
    artifact = add(client, Artifact(project_id=project['id'], kind='content_direction', content={'keep': 1}))
    active = add(client, Job(project_id=project['id'], kind='premise_generation', status='waiting_user'))
    assert preview(client, 'jobs', history)['blocked']
    assert client.post('/api/jobs/' + active + '/cancel').status_code == 200
    report = preview(client, 'jobs', history)
    assert not report['blocked'] and 'Linked projects are still in progress.' in report['warnings']
    assert confirm(client, report).status_code == 200
    with client.app.state.database.session() as db:
        assert db.get(Job, history) is None
        assert db.get(Artifact, artifact).content == {'keep': 1}
        assert db.get(Project, project['id']) is not None


def test_cancelled_worker_must_exit_before_deletion(client, project, monkeypatch):
    workflow = client.app.state.workflow
    workflow.executor = ThreadPoolExecutor(max_workers=1)
    entered, release = Event(), Event()
    generate = workflow.mock.generate
    def delayed(*args):
        entered.set()
        assert release.wait(10)
        return generate(*args)
    monkeypatch.setattr(workflow.mock, 'generate', delayed)
    try:
        job = client.post('/api/jobs', json={'kind': 'content_direction', 'project_id': project['id']}).json()
        assert entered.wait(5)
        assert client.post('/api/jobs/' + job['id'] + '/cancel').status_code == 200
        report = preview(client, 'jobs', job['id'])
        assert report['blocked'] and report['blockers'][0]['worker_active']
        assert confirm(client, report).status_code == 409
    finally:
        release.set()
        workflow.executor.shutdown(wait=True)
    assert confirm(client, preview(client, 'jobs', job['id'])).status_code == 200


def test_invalid_batch_and_no_csrf_cannot_delete(client):
    source = client.post('/api/sources', json={'title': 'Keep me'}).json()['id']
    assert client.post('/api/deletions/preview', json={'kind': 'sources', 'ids': []}).status_code == 422
    assert client.post('/api/deletions/preview', json={'kind': 'sources', 'ids': [source, 'missing']}).status_code == 404
    report = preview(client, 'sources', source)
    token = client.headers.pop('X-StoryForge-Token')
    try:
        assert confirm(client, report).status_code == 403
    finally:
        client.headers['X-StoryForge-Token'] = token
    assert client.get('/api/sources/' + source).status_code == 200
