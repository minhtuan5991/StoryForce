import json
import sqlite3
import pytest
from backend.database import Database
from backend.models import PremiseUsage, Project, serialize
from backend.portability import inspect_database
from test_premise_reuse import finished
from test_deletion import preview, confirm


def branch(client, project):
    ideas, _, _ = finished(client, project)
    response = client.post('/api/projects/'+project['id']+'/select-premise', json={'premise_id': ideas[1]['id']})
    assert response.status_code == 200, response.text
    return ideas, response.json()


def test_deleted_branch_keeps_history_and_cannot_be_created_again(client, project):
    ideas, child = branch(client, project)
    assert confirm(client, preview(client, 'projects', child['id'])).status_code == 200
    detail = client.get('/api/projects/'+project['id']).json()
    record = detail['premise_pool']['used_projects'][ideas[1]['id']]
    assert record == {'project_id': None, 'title': ideas[1]['title'], 'deleted': True}
    response = client.post('/api/projects/'+project['id']+'/select-premise', json={'premise_id': ideas[1]['id']})
    assert response.status_code == 422 and 'deleted' in response.json()['detail']
    assert client.get('/api/projects/'+project['id']).json()['premise_reuse']['ready']
    updated = Database(client.app.state.root)
    with updated.session() as db:
        history = db.query(PremiseUsage).filter_by(pool_project_id=project['id'], premise_id=ideas[1]['id']).one()
        assert history.project_id is None
    updated.engine.dispose()


@pytest.mark.parametrize('delete_child', [False, True])
def test_root_pool_is_protected_even_after_its_child_is_deleted(client, project, delete_child):
    _, child = branch(client, project)
    if delete_child:
        assert confirm(client, preview(client, 'projects', child['id'])).status_code == 200
    report = preview(client, 'projects', project['id'])
    assert report['blocked'] and report['blockers'][0]['status'] == 'Protected'
    response = confirm(client, report)
    assert response.status_code == 409 and 'idea list' in response.json()['detail']
    assert client.get('/api/projects/'+project['id']).status_code == 200


def test_bulk_delete_and_stale_confirm_cannot_remove_a_shared_pool(client, project):
    before = preview(client, 'projects', project['id'])
    _, child = branch(client, project)
    assert confirm(client, before).status_code == 409
    spare = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Keep this project'}).json()
    report = preview(client, 'projects', project['id'], child['id'], spare['id'])
    assert report['blocked'] and confirm(client, report).status_code == 409
    for item in (project, child, spare):
        assert client.get('/api/projects/'+item['id']).status_code == 200


def test_channel_deletion_still_removes_all_owned_history(client, project):
    branch(client, project)
    report = preview(client, 'channels', project['channel_id'])
    assert not report['blocked'] and confirm(client, report).status_code == 200
    with client.app.state.database.session() as db:
        assert db.query(PremiseUsage).count() == 0
        assert db.query(Project).count() == 0


def test_schema_three_backfills_existing_choices_without_editing_projects(client, project):
    ideas, child = branch(client, project)
    with client.app.state.database.session() as db:
        before = {p.id: serialize(p) for p in db.query(Project)}
    # Simulate v2's complete stored projects without the new history table.
    with sqlite3.connect(client.app.state.database.path) as db:
        db.execute('DROP TABLE premise_usage')
        db.execute('DELETE FROM schema_migrations WHERE version=3')
    updated = Database(client.app.state.root)
    with updated.session() as db:
        assert {p.id: serialize(p) for p in db.query(Project)} == before
        records = db.query(PremiseUsage).filter_by(pool_project_id=project['id']).all()
        assert {(r.premise_id,r.project_id) for r in records} == {(ideas[0]['id'], project['id']), (ideas[1]['id'], child['id'])}
    inspect_database(updated.path)
    updated.engine.dispose()


def test_project_export_contains_durable_usage_history(client, project):
    import io, zipfile
    ideas, child = branch(client, project)
    assert confirm(client, preview(client, 'projects', child['id'])).status_code == 200
    response = client.get('/api/projects/'+project['id']+'/export')
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        data = json.loads(archive.read('project.json'))
        assert any(r['premise_id']==ideas[1]['id'] and r['project_id'] is None for r in data['premise_usage'])
