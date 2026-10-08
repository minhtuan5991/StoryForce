import json
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.config import initialize_folders
from backend.database import Database
from backend.models import Channel, Project, Asset, Artifact, Job
from backend.project_storage import migrate_project_folders, project_path, folder_index, INDEX, JOURNAL


def legacy(tmp_path, title='The Door That Remembered My Name'):
    initialize_folders(tmp_path);database=Database(tmp_path)
    with database.session() as db:
        c=Channel(name='Mystery');db.add(c);db.flush()
        p=Project(channel_id=c.id,title=title);db.add(p);db.flush()
        folder=tmp_path/'projects'/p.id
        folder.mkdir();(folder/'images').mkdir()
        image=folder/'images/scene_001.png';image.write_bytes(b'unchanged-media')
        value={'file':str(image.relative_to(tmp_path)),'absolute':str(image)}
        db.add(Asset(project_id=p.id,path=value['file'],metadata_json={'cached':value['absolute']}))
        db.add(Artifact(project_id=p.id,kind='visual_director',content=value))
        db.add(Job(project_id=p.id,kind='image_generation',status='completed',result=value))
        (folder/'report.json').write_text(json.dumps(value),encoding='utf-8')
        db.commit();id=p.id
    return database,id,image


def test_existing_storage_renames_all_references_without_copying_media(tmp_path):
    db,id,old=legacy(tmp_path);inode=old.stat().st_ino
    report=migrate_project_folders(db,tmp_path)
    folder=project_path(tmp_path,id)
    assert folder.name=='The Door That Remembered My Name' and not old.exists()
    image=folder/'images/scene_001.png'
    assert image.read_bytes()==b'unchanged-media' and image.stat().st_ino==inode
    with db.session() as session:
        asset=session.query(Asset).one()
        assert asset.path==str(image.relative_to(tmp_path))
        assert session.query(Artifact).one().content['absolute']==str(image)
        assert session.query(Job).one().result['file']==str(image.relative_to(tmp_path))
    assert json.loads((folder/'report.json').read_text())['absolute']==str(image)
    assert Path(report['backup']).is_file()
    assert migrate_project_folders(db,tmp_path)['renamed']==[]
    assert not (tmp_path/'projects'/JOURNAL).exists()


def test_duplicate_titles_reserved_names_and_unrelated_folders_do_not_merge(tmp_path):
    db,id,_=legacy(tmp_path,'CON')
    with db.session() as session:
        first=session.get(Project,id);other=Project(channel_id=first.channel_id,title='CON');session.add(other);session.commit();other_id=other.id
    unrelated=tmp_path/'projects'/'StoryForge - CON';unrelated.mkdir();(unrelated/'keep').write_bytes(b'original')
    migrate_project_folders(db,tmp_path)
    assert project_path(tmp_path,id).name.startswith('StoryForge - CON - ')
    assert project_path(tmp_path,other_id)!=project_path(tmp_path,id)
    assert (unrelated/'keep').read_bytes()==b'original'


def test_migration_failure_restores_files_index_and_database(tmp_path):
    db,id,old=legacy(tmp_path)
    import backend.project_storage as storage
    original=storage.write_json
    def fail(path,data):
        if path.name=='report.json':raise OSError('Simulated disk failure')
        return original(path,data)
    with patch.object(storage,'write_json',side_effect=fail):
        with pytest.raises(OSError):migrate_project_folders(db,tmp_path)
    assert old.read_bytes()==b'unchanged-media'
    assert folder_index(tmp_path)=={}
    with db.session() as session:assert session.query(Asset).one().path==str(old.relative_to(tmp_path))
    assert not (tmp_path/'projects'/JOURNAL).exists()


def test_links_and_active_workers_block_migration(tmp_path):
    db,id,old=legacy(tmp_path)
    with db.session() as session:session.add(Job(project_id=id,kind='render',status='running'));session.commit()
    with pytest.raises(ValueError,match='running'):migrate_project_folders(db,tmp_path)
    assert old.is_file()
    with db.session() as session:session.query(Job).delete();session.commit()
    import backend.project_storage as storage
    original=storage.linked
    with patch.object(storage,'linked',side_effect=lambda path:path==old.parent.parent or original(path)):
        with pytest.raises(ValueError,match='link'):migrate_project_folders(db,tmp_path)
    assert old.is_file()


def test_deleted_project_folder_recovers_english_title_from_backup(tmp_path):
    db,id,old=legacy(tmp_path)
    db.backup(tmp_path/'backups'/'old.db')
    with db.session() as session:session.delete(session.get(Project,id));session.commit()
    migrate_project_folders(db,tmp_path)
    assert project_path(tmp_path,id).name=='The Door That Remembered My Name'
    assert (project_path(tmp_path,id)/'images/scene_001.png').read_bytes()==b'unchanged-media'


def test_restored_database_paths_resolve_already_renamed_media(tmp_path):
    db,id,old=legacy(tmp_path)
    original=str(old.relative_to(tmp_path))
    migrate_project_folders(db,tmp_path)
    with db.session() as session:
        asset=session.query(Asset).one()
        asset.path=original
        session.commit()
    report=migrate_project_folders(db,tmp_path)
    assert report['renamed']==[]
    with db.session() as session:
        assert (tmp_path/session.query(Asset).one().path).read_bytes()==b'unchanged-media'
    assert not old.exists()
