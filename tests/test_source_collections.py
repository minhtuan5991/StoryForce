import json
import sqlite3
from contextlib import closing

from backend.database import Database, SCHEMA_VERSION
from backend.models import Channel, Project, Source, serialize
from backend.portability import _inspect_connection


def listing(client, collection, **params):
    response = client.get('/api/sources', params={'collection': collection, **params})
    response.raise_for_status()
    return response.json()


def move(client, ids, collection):
    return client.post('/api/sources/collection', json={'ids': ids, 'collection': collection})


def test_new_and_imported_sources_enter_inbox_even_with_channel(client, project):
    source = client.get('/api/sources/' + project['source_id']).json()
    assert source['collection'] == 'inbox'
    client.patch('/api/sources/' + source['id'], json={'channel_id': project['channel_id'], 'status': 'ASSIGNED'}).raise_for_status()
    assert listing(client, 'library')['total'] == 0
    for name, data in [('notes.txt', 'Original text'), ('story.md', '# Story'),
                       ('batch.csv', 'title,transcript,collection\nCSV source,Original scene,library\n')]:
        response = client.post('/api/sources/import', files={'file': (name, data.encode('utf-8'))})
        assert response.status_code == 200, response.text
        assert all(s['collection'] == 'inbox' for s in response.json()['items'])
    assert listing(client, 'inbox')['total'] == 4
    dashboard = client.get('/api/dashboard').json()
    assert (dashboard['sources'], dashboard['inbox_sources'], dashboard['library_sources']) == (4, 4, 0)


def test_approval_and_bulk_return_preserve_content_analysis_channel_and_usage(client, project):
    source_id = project['source_id']
    client.patch('/api/sources/' + source_id, json={'notes': 'Keep my notes', 'tags': ['mystery']}).raise_for_status()
    original = client.get('/api/sources/' + source_id).json()
    second = client.post('/api/sources', json={'title': 'Second inspiration', 'transcript': 'Another scene.'}).json()
    response = move(client, [source_id, second['id'], source_id], 'library')
    assert response.status_code == 200 and response.json()['count'] == 2
    assert listing(client, 'inbox')['total'] == 0
    assert listing(client, 'library')['total'] == 2
    updated = client.get('/api/sources/' + source_id).json()
    for field in ('id', 'title', 'transcript', 'summary', 'notes', 'tags', 'language', 'channel_id', 'dna', 'raw_result', 'status', 'usage_count', 'created_at'):
        assert updated[field] == original[field], field
    assert updated['usage_count'] == 1
    assert updated['dna'] == {}  # Explicit approval does not run AI analysis.
    assert client.get('/api/projects/' + project['id']).json()['source_id'] == source_id
    assert move(client, [source_id, second['id']], 'inbox').status_code == 200
    assert listing(client, 'inbox')['total'] == 2
    assert listing(client, 'library')['total'] == 0


def test_collection_filter_search_channel_pagination_and_usage(client, project):
    sid = project['source_id']
    other = client.post('/api/sources', json={'title': 'Original global', 'summary': 'Keep me'}).json()
    move(client, [sid], 'library').raise_for_status()
    result = listing(client, 'library', q='Original', channel_id=project['channel_id'], limit=1)
    assert result['total'] == 1 and result['items'][0]['usage_count'] == 1
    assert listing(client, 'library', offset=1, limit=1)['items'] == []
    assert listing(client, 'inbox', q='Keep')['items'][0]['id'] == other['id']
    # Existing project creation and exports can still read the complete source set.
    assert client.get('/api/sources').json()['total'] == 2
    assert client.get('/api/sources?collection=invalid').status_code == 422


def test_invalid_batch_is_atomic_and_validates_target(client, project):
    sid = project['source_id']
    assert move(client, [sid, 'missing'], 'library').status_code == 404
    assert client.get('/api/sources/' + sid).json()['collection'] == 'inbox'
    for ids, target in [([], 'library'), ([sid], 'invalid'), ([sid] * 101, 'library')]:
        assert move(client, ids, target).status_code == 422


def test_successful_analysis_and_manual_dna_save_move_to_library(client, project):
    sid = project['source_id']
    assert client.post('/api/jobs', json={'kind': 'story_dna', 'source_id': sid}).status_code == 200
    analyzed = client.get('/api/sources/' + sid).json()
    assert analyzed['collection'] == 'library' and analyzed['status'] == 'ANALYZED'
    move(client, [sid], 'inbox').raise_for_status()
    returned = client.get('/api/sources/' + sid).json()
    assert returned['dna'] == analyzed['dna'] and returned['channel_id'] == analyzed['channel_id']
    client.patch('/api/sources/' + sid, json={'notes': 'Still in inbox'}).raise_for_status()
    assert client.get('/api/sources/' + sid).json()['collection'] == 'inbox'
    client.patch('/api/sources/' + sid, json={'dna': analyzed['dna']}).raise_for_status()
    assert client.get('/api/sources/' + sid).json()['collection'] == 'library'


def test_failed_analysis_keeps_inbox(client, monkeypatch):
    source = client.post('/api/sources', json={'title': 'Pending', 'transcript': 'Original scene'}).json()
    monkeypatch.setattr(client.app.state.workflow.mock, 'generate', lambda *args: {'invalid': True})
    response = client.post('/api/jobs', json={'kind': 'story_dna', 'source_id': source['id']})
    assert response.status_code == 200, response.text
    assert client.get('/api/sources/' + source['id']).json()['collection'] == 'inbox'
    job = next(j for j in client.get('/api/jobs').json()['items'] if j['id'] == response.json()['id'])
    assert job['status'] != 'completed'
    assert listing(client, 'library')['total'] == 0


def test_migration_backfills_old_sources_once_and_backs_up_before_changes(tmp_path):
    initial = Database(tmp_path)
    with initial.session() as db:
        channel = Channel(name='Preserved channel'); db.add(channel); db.flush()
        sources = [Source(title='Unused'), Source(title='Assigned only', channel_id=channel.id, status='ASSIGNED'),
                   Source(title='Analyzed', status='ANALYZED'), Source(title='Has DNA', dna={'primary_genre': 'Mystery'}),
                   Source(title='Used inspiration')]
        db.add_all(sources); db.flush()
        project = Project(title='Full Step - Keep story', channel_id=channel.id, source_id=sources[-1].id,
                          draft='Narration unchanged', settings={'custom_option': True})
        db.add(project); db.commit()
        original = {s.id: serialize(s) for s in sources}
        saved_project = serialize(project)
        saved_project['settings']={**saved_project['settings'],'narration_voice':{'speaker':'Enzo','style':'Friendly'}}
    initial.engine.dispose()
    # Simulate the actual v4 schema, before a collection column existed.
    with sqlite3.connect(tmp_path / 'storyforge.db') as db:
        db.execute('DROP INDEX ix_sources_collection')
        db.execute('ALTER TABLE sources DROP COLUMN collection')
        db.execute('DELETE FROM schema_migrations WHERE version>=5')
    migrated = Database(tmp_path)
    with migrated.session() as db:
        for index, source in enumerate(sources):
            row = serialize(db.get(Source, source.id))
            assert row['collection'] == ('inbox' if index < 2 else 'library')
            assert {k: v for k, v in row.items() if k != 'collection'} == {k: v for k, v in original[source.id].items() if k != 'collection'}
        assert serialize(db.get(Project, project.id)) == saved_project
        # Returning an analyzed, used source to inbox must survive app restarts.
        db.get(Source, sources[-1].id).collection = 'inbox'; db.commit()
    backups = list((tmp_path / 'backups').glob('before-source-collections-*.db'))
    assert len(backups) == 1
    with closing(sqlite3.connect(backups[0])) as db:
        assert db.execute('SELECT MAX(version) FROM schema_migrations').fetchone()[0] == 4
        assert 'collection' not in {row[1] for row in db.execute('PRAGMA table_info(sources)')}
    migrated.engine.dispose()
    reopened = Database(tmp_path)
    with reopened.session() as db:
        assert db.get(Source, sources[-1].id).collection == 'inbox'
    with closing(sqlite3.connect(tmp_path / 'storyforge.db')) as db:
        assert db.execute('SELECT MAX(version) FROM schema_migrations').fetchone()[0] == SCHEMA_VERSION
        _inspect_connection(db)  # Portable database archives accept the new schema.
    assert len(list((tmp_path / 'backups').glob('before-source-collections-*.db'))) == 1
    reopened.engine.dispose()


def test_demo_analyzed_sources_start_in_library(client):
    client.post('/api/demo').raise_for_status()
    assert listing(client, 'library')['total'] == 3
    assert listing(client, 'inbox')['total'] == 0
