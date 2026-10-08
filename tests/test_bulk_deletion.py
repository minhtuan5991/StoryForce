from backend.project_storage import project_path
import pytest

from backend.models import Channel, Source, Project, Artifact, Job, Novelty, Premise, StoryVersion, Issue, Chunk, Scene, Asset, Analytics, CalendarEntry
from test_deletion import add, preview, confirm


def test_project_batch_cascades_only_owned_records_and_keeps_files(client, project):
    second = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Second'}).json()
    untouched = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Keep'}).json()
    media = project_path(client.app.state.root, project['id']) / 'keep.wav'
    media.parent.mkdir(parents=True, exist_ok=True)
    media.write_bytes(b'original media file')
    owned = [
        Artifact(project_id=project['id'], kind='outline', content={'text': 'outline'}),
        Job(project_id=project['id'], kind='outline', status='completed'),
        Novelty(project_id=project['id'], channel_id=project['channel_id'], title='Memory'),
        Premise(project_id=project['id'], title='Premise'),
        StoryVersion(project_id=project['id'], version=1, text='Draft'),
        Issue(project_id=project['id'], issue_key='Test'),
        Chunk(project_id=project['id'], text='Narration'),
        Scene(project_id=project['id'], text='Scene'),
        Asset(project_id=project['id'], path=str(media), name='keep.wav'),
        Analytics(project_id=project['id'], date='2026-09-18'),
    ]
    ids = [(type(record), add(client, record)) for record in owned]
    calendar = add(client, CalendarEntry(project_id=project['id'], channel_id=project['channel_id'], title='Keep schedule'))
    source_analysis = add(client, Artifact(source_id=project['source_id'], kind='story_dna', content={'keep': True}))
    settings = client.get('/api/settings').json()
    report = preview(client, 'projects', project['id'], second['id'])
    assert not report['blocked'] and report['affected']['assets'] == 1
    assert confirm(client, report).status_code == 200
    with client.app.state.database.session() as db:
        for model, id in ids:
            assert db.get(model, id) is None
        assert db.get(Project, project['id']) is None
        assert db.get(Project, second['id']) is None
        assert db.get(Project, untouched['id']) is not None
        assert db.get(Channel, project['channel_id']) is not None
        assert db.get(Source, project['source_id']) is not None
        assert db.get(Artifact, source_analysis).content == {'keep': True}
        assert db.get(CalendarEntry, calendar).project_id is None
    assert media.read_bytes() == b'original media file'
    assert client.get('/api/settings').json() == settings


@pytest.mark.parametrize('status', ['queued', 'running', 'waiting_user'])
def test_project_batch_is_atomic_when_any_project_is_busy(client, project, status):
    second = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Idle'}).json()
    add(client, Job(project_id=project['id'], kind='content_direction', status=status))
    report = preview(client, 'projects', project['id'], second['id'])
    assert report['blocked'] and confirm(client, report).status_code == 409
    for id in (project['id'], second['id']):
        assert client.get('/api/projects/' + id).status_code == 200


def test_project_with_shared_memory_waits_for_ai_in_another_channel(client, project):
    add(client, Novelty(project_id=project['id'], channel_id=project['channel_id'], title='Shared'))
    other = client.post('/api/channels', json={'name': 'Elsewhere'}).json()['id']
    add(client, Job(channel_id=other, kind='discovery', status='running'))
    report = preview(client, 'projects', project['id'])
    assert report['blocked'] and confirm(client, report).status_code == 409


def test_child_changes_invalidate_project_confirmation(client, project):
    id = add(client, Artifact(project_id=project['id'], kind='outline', content={'text': 'before'}))
    report = preview(client, 'projects', project['id'])
    with client.app.state.database.session() as db:
        db.get(Artifact, id).content = {'text': 'edited after preview'}
        db.commit()
    assert confirm(client, report).status_code == 409
    assert confirm(client, preview(client, 'projects', project['id'])).status_code == 200


def test_bulk_job_history_does_not_delete_results_or_unselected_jobs(client, project):
    ids = [add(client, Job(project_id=project['id'], kind='content_direction', status='completed')) for _ in range(3)]
    artifact = add(client, Artifact(project_id=project['id'], kind='content_direction', content={'keep': True}))
    report = preview(client, 'jobs', *ids[:2])
    assert confirm(client, report).status_code == 200
    with client.app.state.database.session() as db:
        assert all(db.get(Job, id) is None for id in ids[:2])
        assert db.get(Job, ids[2]) is not None
        assert db.get(Artifact, artifact).content == {'keep': True}
