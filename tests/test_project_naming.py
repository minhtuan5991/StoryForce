import json
import sqlite3

from backend.database import Database
from backend.models import Asset, Project, serialize
from backend.project_naming import name_project, story_context
from backend.project_storage import migrate_project_folders, project_path
from backend.thumbnail_packaging import plan_fingerprint
from backend.youtube_metadata import metadata_fingerprint


def test_new_project_names_use_the_workflow_type_and_rename_keeps_it(client, project):
    assert project['title'] == 'Full Step - Signal test'
    custom = client.post('/api/projects', json={'channel_id': project['channel_id'],
        'title': 'Customize - THE THING BENEATH STATION NINE', 'entry_mode': 'existing_bible'}).json()
    assert custom['title'] == 'Customize - THE THING BENEATH STATION NINE'
    base = '/api/projects/' + custom['id']
    renamed = client.patch(base, json={'title': 'Full Step - The Empty Room'}).json()
    assert renamed['title'] == 'Customize - The Empty Room'
    assert renamed['settings']['project_type'] == 'customize'
    assert renamed['settings']['entry_mode'] == 'existing_bible'
    assert client.patch(base, json={'title': renamed['title']}).json()['title'] == renamed['title']
    assert client.get(base).json()['next']['action_kind'] == 'project_setup'


def test_title_budget_excludes_label_and_is_valid_on_later_duration_updates(client, project):
    created = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'x'*300}).json()
    assert created['title'] == 'Full Step - ' + 'x'*300
    response = client.patch('/api/projects/' + created['id'], json={'target_minutes': 20})
    assert response.status_code == 200, response.text
    assert client.patch('/api/projects/' + created['id'], json={'title': 'x'*301}).status_code == 422


def test_labels_do_not_leak_to_story_prompts_or_invalidate_packaging(client, project):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id'])
        p.title='The Door That Knew My Name'
        metadata,thumbnail=metadata_fingerprint(db,p),plan_fingerprint(db,p)
        name_project(p)
        assert metadata_fingerprint(db,p)==metadata and plan_fingerprint(db,p)==thumbnail
        context=story_context(serialize(p))
        assert context['title']=='The Door That Knew My Name'
        assert not {'project_type','story_title'}.intersection(context['settings'])
        assert not name_project(p)


def test_migration_labels_existing_projects_and_keeps_identity_media_and_preferences(client,project):
    custom=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Station Nine','entry_mode':'existing_bible'}).json()
    root=client.app.state.root
    with client.app.state.database.session() as db:
        child=Project(channel_id=project['channel_id'],source_id=project['source_id'],title='The Second Door',
            settings={'premise_origin':{'project_id':project['id'],'premise_id':'unused-idea'},'production_options':{'music_enabled':True}})
        db.add(child);db.commit();child_id=child.id
        records={p.id:serialize(p) for p in db.query(Project)}
    folder=project_path(root,project['id'])
    marker=folder/'images'/'keep.png';marker.write_bytes(b'original resource')
    inode=marker.stat().st_ino
    with client.app.state.database.session() as db:
        db.add(Asset(project_id=project['id'],path=str(marker.relative_to(root)),kind='image'));db.commit()
    # Restore old titles/settings to simulate a v3 database without labels.
    with sqlite3.connect(client.app.state.database.path) as db:
        for id,p in records.items():
            clean={k:v for k,v in p['settings'].items() if k not in ('project_type','story_title')}
            title=p['title'].removeprefix('Full Step - ').removeprefix('Customize - ')
            db.execute('UPDATE projects SET title=?,settings=? WHERE id=?',(title,json.dumps(clean),id))
        db.execute('DELETE FROM schema_migrations WHERE version>=4')
    migrated=Database(root)
    migrate_project_folders(migrated,root)
    with migrated.session() as db:
        titles={p.id:p.title for p in db.query(Project)}
        assert titles=={project['id']:'Full Step - Signal test',custom['id']:'Customize - Station Nine',child_id:'Extend - The Second Door'}
        for p in db.query(Project):
            for key in ('source_id','channel_id','draft','publish','story_version','selected_premise_id','created_at','updated_at'):
                assert serialize(p)[key]==records[p.id][key]
        assert db.get(Project,child_id).settings['production_options']=={'music_enabled':True}
        file=root/db.query(Asset).one().path
        assert file.read_bytes()==b'original resource' and file.stat().st_ino==inode
    assert list((root/'backups').glob('before-project-labels-*.db'))
    migrated.engine.dispose()
    repeated=Database(root)
    with repeated.session() as db:
        assert {p.id:p.title for p in db.query(Project)}==titles
    repeated.engine.dispose()
