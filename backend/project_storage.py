"""Readable project folders with durable IDs and recoverable path migration."""
from __future__ import annotations

import json
import os
import re
import sqlite3
import stat
import threading
from contextlib import closing
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm.attributes import flag_modified

from .models import Project, Asset, Artifact, Job, Chunk, Scene, Setting, uid, serialize

_lock = threading.RLock()
INDEX = '.storyforge-folders.json'
JOURNAL = '.storyforge-folder-migration.json'
_cache = {}


def linked(path: Path) -> bool:
    info = path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, 'st_file_attributes', 0) & 0x400)


def check_ancestors(path: Path) -> None:
    """Check lexical ancestors, before resolving junctions or symbolic links."""
    for ancestor in (path, *path.parents):
        if ancestor.exists() and linked(ancestor):
            raise ValueError('Project storage contains a link; files will not be changed')


def basename(value: str) -> str:
    if not isinstance(value, str) or not value or value in ('.', '..') or re.search(r'[<>:"/\\|?*\x00-\x1f]', value) or value != value.rstrip(' .'):
        raise ValueError('Invalid project storage folder')
    return value


def folder_name(title: str, project_id: str) -> str:
    # Generated story titles are English. Never transliterate a Vietnamese
    # working title and pretend that the resulting words are English.
    title = str(title or '').strip()
    if not title or any(ord(c) > 127 and c.isalpha() for c in title):
        title = 'Story Project - ' + project_id[:8]
    title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title).strip(' .')[:90].rstrip(' .')
    if re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', title, re.I):
        title = 'StoryForge - ' + title
    return basename(title or 'Story Project - ' + project_id[:8])


def write_json(path: Path, data) -> None:
    check_ancestors(path)
    temporary = path.with_name(path.name + '.' + uid() + '.tmp')
    try:
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def folder_index(root: Path) -> dict:
    path = Path(root) / 'projects' / INDEX
    check_ancestors(path)
    if not path.exists():
        return {}
    info = path.stat()
    key = (str(path.absolute()), info.st_mtime_ns, info.st_size)
    with _lock:
        if key not in _cache:
            data = json.loads(path.read_text(encoding='utf-8'))
            if data.get('version') != 1 or not isinstance(data.get('folders'), dict):
                raise ValueError('Invalid project folder index; restore its backup before continuing')
            folders = {basename(id): basename(name) for id, name in data['folders'].items()}
            if len({v.casefold() for v in folders.values()}) != len(folders):
                raise ValueError('Multiple projects claim the same storage folder')
            _cache.clear()
            _cache[key] = folders
        return dict(_cache[key])


def project_path(root: Path, project_id: str) -> Path:
    basename(project_id)
    base = Path(root) / 'projects'
    folder = base / folder_index(root).get(project_id, project_id)
    check_ancestors(folder)
    if folder.resolve().parent != base.resolve():
        raise ValueError('Project storage is outside the expected folder')
    return folder


def rewrite_paths(value, root: Path, moves: list[dict]):
    if isinstance(value, dict):
        return {k: rewrite_paths(v, root, moves) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite_paths(v, root, moves) for v in value]
    if not isinstance(value, str):
        return value
    for move in moves:
        for separator in ('/', '\\'):
            relative = ('projects/' + move['old']).replace('/', separator)
            absolute = str(root / 'projects' / move['old']).replace('\\', separator).replace('/', separator)
            for before, after in ((relative, ('projects/' + move['new']).replace('/', separator)),
                                  (absolute, str(root / 'projects' / move['new']).replace('\\', separator).replace('/', separator))):
                if value.casefold() == before.casefold() or value.casefold().startswith(before.casefold() + separator):
                    return after + value[len(before):]
    return value


def recover_migration(database, root: Path) -> None:
    journal = root / 'projects' / JOURNAL
    check_ancestors(journal)
    if not journal.exists():
        return
    state = json.loads(journal.read_text(encoding='utf-8'))
    with database.session() as db:
        token = db.get(Setting, '_folder_migration')
        committed = token and token.value == state['token']
    if not committed:
        for saved in state.get('text_files', []):
            path = root / saved['path']
            check_ancestors(path)
            if not path.absolute().is_relative_to((root / 'projects').absolute()):
                raise ValueError('Unsafe migration recovery file')
            if path.exists():
                path.write_text(saved['text'], encoding='utf-8')
        for move in reversed(state['moves']):
            old, new = root / 'projects' / basename(move['old']), root / 'projects' / basename(move['new'])
            check_ancestors(old); check_ancestors(new)
            if new.exists() and not old.exists():
                if move.get('existed', True):
                    new.rename(old)
                else:
                    new.rmdir()
        write_json(root / 'projects' / INDEX, {'version': 1, 'folders': state['before']})
    journal.unlink()


def archived_titles(root: Path, ids: set[str]) -> dict:
    """Recover names of retained folders whose project records were deleted."""
    found = {}
    backups = root / 'backups'
    if not backups.is_dir():
        return found
    for file in sorted(backups.glob('*.db'), key=lambda p: p.stat().st_mtime_ns, reverse=True):
        if not ids - found.keys():
            break
        try:
            check_ancestors(file)
            with closing(sqlite3.connect(file.as_uri() + '?mode=ro', uri=True)) as connection:
                for id, title in connection.execute('SELECT id,title FROM projects'):
                    if id in ids and id not in found:
                        found[id] = title
        except (sqlite3.Error, OSError, ValueError):
            continue
    return found


def migrate_project_folders(database, root: Path, ids=None) -> dict:
    """Rename inside projects only, then atomically update all stored references.

    The journal rolls filesystem changes back after a crash before DB commit.
    A committed token makes recovery complete rather than repeat the rename.
    """
    root = Path(root).absolute()
    base = root / 'projects'
    check_ancestors(base)
    base.mkdir(parents=True, exist_ok=True)
    with _lock:
        recover_migration(database, root)
        before = folder_index(root)
        with database.session() as db:
            projects = db.query(Project).order_by(Project.created_at, Project.id).all()
            titles = {p.id: p.title for p in projects if ids is None or p.id in ids}
            if ids is None:
                orphan_ids = {f.name for f in base.iterdir() if f.is_dir() and re.fullmatch(r'[0-9a-f]{16}', f.name)} - {p.id for p in projects}
                recovered = archived_titles(root, orphan_ids)
                titles.update({id: recovered.get(id, 'Archived Story - ' + id[:8]) for id in orphan_ids})
            after, moves = dict(before), []
            claimed = {name.casefold(): id for id, name in before.items()}
            for id, title in titles.items():
                old = before.get(id, id)
                name = folder_name(title, id)
                target = name
                number = 0
                while ((target.casefold() in claimed and claimed[target.casefold()] != id)
                       or ((base / target).exists() and target.casefold() != old.casefold())):
                    number += 1
                    target = name[:76].rstrip(' .') + ' - ' + id[:8] + (f'-{number}' if number > 1 else '')
                if old == target:
                    after[id] = target; claimed[target.casefold()] = id
                    continue
                # Windows case-only changes need two moves; keep existing case.
                if old.casefold() == target.casefold():
                    after[id] = old
                    continue
                check_ancestors(base / old); check_ancestors(base / target)
                moves.append({'id': id, 'old': old, 'new': target, 'existed': (base / old).exists()})
                after[id] = target; claimed[target.casefold()] = id
            aliases = [{'id': id, 'old': id, 'new': after[id]} for id in titles if id != after[id] and before.get(id, id) != id]
            references = moves + aliases
            if not moves:
                # A restored database can still contain legacy ID paths while
                # its media and folder registry already use the English title.
                pending = any(rewrite_paths(getattr(row, field), root, aliases) != getattr(row, field)
                    for model, fields in ((Asset, ('path', 'metadata_json')), (Artifact, ('content',)),
                        (Job, ('result', 'payload', 'logs')), (Project, ('settings', 'publish')))
                    for row in db.query(model) for field in fields)
                if not pending:
                    return {'renamed': [], 'folders': after}
            if db.query(Job).filter(Job.project_id.in_([m['id'] for m in references]), Job.status == 'running').count():
                raise ValueError('Wait for running project jobs before renaming storage folders')
        # Back up the DB before opening a write transaction. No media copies.
        backup = None
        if aliases or any(move['existed'] for move in moves):
            backup = root / 'backups' / ('before-folder-migration-' + uid() + '.db')
            backup.parent.mkdir(parents=True, exist_ok=True)
            database.backup(backup)
        state = {'token': uid(), 'before': before, 'moves': moves, 'text_files': []}
        journal = base / JOURNAL
        write_json(journal, state)
        try:
            with database.session() as db:
                db.execute(text('BEGIN IMMEDIATE'))
                if folder_index(root) != before:
                    raise ValueError('Project folders changed. Retry the storage update.')
                if db.query(Job).filter(Job.project_id.in_([m['id'] for m in references]), Job.status == 'running').count():
                    raise ValueError('Wait for running project jobs before renaming storage folders')
                # Only reports matching their actual old inputs can retain their
                # approval after a path-only migration. Never bless stale renders.
                from .media import render_inputs_hash
                from .workflow import settings_for
                from .models import Channel
                reports = []
                for p in db.query(Project):
                    rows = [[serialize(r) for r in db.query(model).filter_by(project_id=p.id)] for model in (Chunk, Scene, Asset)]
                    fingerprint = render_inputs_hash(serialize(p), *rows, settings_for(db, db.get(Channel, p.channel_id)))
                    for report in db.query(Artifact).filter_by(project_id=p.id, kind='render_report', story_version=p.story_version):
                        if report.content.get('inputs_hash') == fingerprint:
                            reports.append((p.id, report.id))
                for move in moves:
                    source, target = base / move['old'], base / move['new']
                    if target.exists():
                        raise ValueError('A folder appeared at the new project path; no files were overwritten')
                    if source.exists():
                        source.rename(target)
                    else:
                        target.mkdir(exist_ok=False)
                write_json(base / INDEX, {'version': 1, 'folders': after})
                for model, fields in ((Asset, ('path', 'metadata_json')), (Artifact, ('content',)),
                                      (Job, ('result', 'payload', 'logs')), (Project, ('settings', 'publish'))):
                    for row in db.query(model):
                        changed = False
                        for field in fields:
                            previous = getattr(row, field)
                            updated = rewrite_paths(previous, root, references)
                            if updated != previous:
                                setattr(row, field, updated); changed = True
                        if changed:
                            flag_modified(row, 'updated_at')
                db.flush()
                for project_id, report_id in reports:
                    p = db.get(Project, project_id)
                    rows = [[serialize(r) for r in db.query(model).filter_by(project_id=project_id)] for model in (Chunk, Scene, Asset)]
                    report = db.get(Artifact, report_id)
                    report.content = {**report.content, 'inputs_hash': render_inputs_hash(serialize(p), *rows, settings_for(db, db.get(Channel, p.channel_id)))}
                    flag_modified(report, 'updated_at')
                report_files = {str(root / a.content['file']).replace('\\', '/'): a.content for a in db.query(Artifact).filter_by(kind='render_report') if a.content.get('file')}
                for move in references:
                    for path in (base / move['new']).rglob('*.json'):
                        try:
                            check_ancestors(path)
                            original = path.read_text(encoding='utf-8')
                            content = json.loads(original)
                            updated = rewrite_paths(content, root, references)
                            if path.name == 'render_report.json':
                                report = report_files.get(str(path.with_name('final_video.mp4')).replace('\\', '/'))
                                if report and report.get('inputs_hash') and content.get('inputs_hash'):
                                    updated['inputs_hash'] = report['inputs_hash']
                            if content != updated:
                                state['text_files'].append({'path': str(path.relative_to(root)), 'text': original})
                                write_json(journal, state)
                                write_json(path, updated)
                        except (UnicodeError, json.JSONDecodeError):
                            continue
                token = db.get(Setting, '_folder_migration')
                if token:
                    token.value = state['token']
                else:
                    db.add(Setting(key='_folder_migration', value=state['token']))
                db.commit()
            journal.unlink()
            return {'renamed': moves, 'folders': after, 'backup': str(backup) if backup else None}
        except Exception:
            recover_migration(database, root)
            raise
