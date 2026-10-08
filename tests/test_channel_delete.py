from backend.project_storage import project_path
import pytest

from backend.models import Artifact, CalendarEntry, Channel, DNAVersion, Job, Project, Source
from test_deletion import add, preview, confirm


def test_delete_channel_previews_all_projects_and_preserves_library_and_other_channel(client, project):
    channel_id = project['channel_id']
    other = client.post('/api/channels', json={'name': 'Keep channel'}).json()
    kept = client.post('/api/projects', json={'channel_id': other['id'], 'title': 'Keep project'}).json()
    second = client.post('/api/projects', json={'channel_id': channel_id, 'title': 'Second story'}).json()
    owned = add(client, Artifact(project_id=project['id'], kind='outline', content={'story': 1}))
    dna = add(client, DNAVersion(channel_id=channel_id, dna={'tone': 'Warm'}))
    calendar = add(client, CalendarEntry(channel_id=channel_id, project_id=project['id'], title='Schedule'))
    source_analysis = add(client, Artifact(source_id=project['source_id'], channel_id=channel_id, kind='story_dna', content={'keep': 1}))
    media = project_path(client.app.state.root, project['id']) / 'final_video.mp4'
    media.write_bytes(b'Keep exported work by default')
    report = preview(client, 'channels', channel_id)
    assert {p['id'] for p in report['projects']} == {project['id'], second['id']}
    assert report['items'][0]['title'] == 'Test archive'
    assert report['affected']['projects'] == 2 and report['affected']['channel_dna_versions'] >= 1
    assert not report['blocked']
    assert confirm(client, report).status_code == 200
    with client.app.state.database.session() as db:
        for model, id in ((Channel, channel_id), (Project, project['id']), (Project, second['id']),
                          (Artifact, owned), (DNAVersion, dna), (CalendarEntry, calendar)):
            assert db.get(model, id) is None
        assert db.get(Source, project['source_id']).channel_id is None
        assert db.get(Artifact, source_analysis).content == {'keep': 1}
        assert db.get(Artifact, source_analysis).channel_id is None
        assert db.get(Project, kept['id']) is not None
        assert db.get(Channel, other['id']) is not None
    assert media.is_file()


@pytest.mark.parametrize('scope', ['project', 'channel', 'stopping_worker'])
def test_channel_delete_cannot_remove_work_still_running(client, project, scope):
    record = Job(kind='content_direction', status='cancelled' if scope == 'stopping_worker' else 'waiting_user',
                 project_id=project['id'] if scope != 'channel' else None,
                 channel_id=project['channel_id'] if scope == 'channel' else None)
    id = add(client, record)
    if scope == 'stopping_worker':
        client.app.state.workflow.active_jobs[id] = 1
    report = preview(client, 'channels', project['channel_id'])
    assert report['blocked']
    assert confirm(client, report).status_code == 409
    assert client.get('/api/projects/' + project['id']).status_code == 200
    client.app.state.workflow.active_jobs.pop(id, None)


def test_new_project_after_preview_invalidates_channel_confirmation(client, project):
    report = preview(client, 'channels', project['channel_id'])
    client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Added after preview'})
    assert confirm(client, report).status_code == 409
    assert client.get('/api/channels/' + project['channel_id']).status_code == 200


def test_channel_file_cleanup_uses_project_ids_and_keeps_external_files(client, project):
    root = client.app.state.root
    private = project_path(root, project['id']) / 'audio.wav'
    private.write_bytes(b'private')
    external = root / 'external-original.wav'
    external.write_bytes(b'original')
    body = {'kind': 'channels', 'ids': [project['channel_id']], 'delete_files': True}
    report = client.post('/api/deletions/preview', json=body).json()
    assert report['file_cleanup']['count'] == 1
    response = client.post('/api/deletions/confirm', json={**body, 'confirmation': report['confirmation']})
    assert response.status_code == 200, response.text
    assert response.json()['file_cleanup']['removed_files'] == 1
    assert not private.exists() and external.read_bytes() == b'original'


def test_empty_channel_uses_the_same_confirmed_deletion(client):
    channel = client.post('/api/channels', json={'name': 'Empty'}).json()
    report = preview(client, 'channels', channel['id'])
    assert not report['projects']
    assert confirm(client, report).status_code == 200
