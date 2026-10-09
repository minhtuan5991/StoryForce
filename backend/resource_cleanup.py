"""Previewed project resource cleanup, retaining the current final and story."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import or_, text

from .config import safe_path
from .intelligence import digest
from .models import Project, Asset, Chunk, Scene, Job, Artifact, Channel, now, serialize
from .project_files import private_file_plan
from .project_storage import project_path, check_ancestors, linked, write_json, basename

RENDER_SETTINGS = ('render_width', 'render_height', 'render_fps', 'render_encoder', 'transition_seconds',
                   'music_db', 'ambient_db', 'narration_db', 'allow_visual_fallback', 'silence_threshold')
PRODUCTION = ('chunk_tts', 'tts_context', 'visual_director', 'image_generation', 'video_generation', 'sync', 'render', 'capcut_export', 'thumbnail_plan')


def archived(project) -> bool:
    return (project.settings or {}).get('resource_cleanup', {}).get('status') in ('completed', 'partial')


def settings_signature(project, config):
    from .media import render_options
    return digest([render_options(serialize(project)), {key: config.get(key) for key in RENDER_SETTINGS}])


def archived_final_matches(root, project, report, config) -> bool:
    state = (project.settings or {}).get('resource_cleanup', {})
    if not archived(project) or not report or not state.get('was_current'):
        return False
    if (state.get('story_version') != project.story_version or state.get('story_hash') != digest(project.draft)
            or state.get('report_id') != report.id or state.get('settings_signature') != settings_signature(project, config)):
        return False
    try:
        path = safe_path(root, report.content['file'])
        check_ancestors(path)
        info = path.stat()
        return path.is_relative_to(project_path(root, project.id).resolve()) and info.st_size > 0 and [info.st_size, info.st_mtime_ns, info.st_ino] == state.get('final_signature')
    except (ValueError, KeyError, OSError):
        return False


def latest_report(db, project_id):
    return db.query(Artifact).filter_by(project_id=project_id, kind='render_report').order_by(Artifact.created_at.desc(), Artifact.id.desc()).first()


def recover_final_moves(database, root):
    """Restore a final moved before its database reference was committed."""
    for journal in (root / 'projects').glob('.storyforge-final-move-*.json'):
        check_ancestors(journal)
        state = json.loads(journal.read_text(encoding='utf-8'))
        folder = project_path(root, basename(state['project_id']))
        source, target = safe_path(root, state['source']), safe_path(root, state['target'])
        for path in (source, target):
            check_ancestors(path)
            if not path.is_relative_to(folder.resolve()) or path.name != 'final_video.mp4':
                raise ValueError('Invalid final video recovery path')
        with database.session() as db:
            report = db.get(Artifact, state['report_id'])
            if not report or report.project_id != state['project_id']:
                raise ValueError('Final video recovery report is missing')
            committed = report.content.get('file') == state['target']
        if not committed and target.exists() and not source.exists():
            info = target.stat()
            if [info.st_size, info.st_mtime_ns, info.st_ino] != state['signature']:
                raise ValueError('Final video changed during recovery')
            source.parent.mkdir(parents=True, exist_ok=True)
            target.rename(source)
        journal.unlink()


class ResourceCleanup:
    def __init__(self, database, workflow, secret):
        self.database, self.workflow, self.root = database, workflow, workflow.root
        self.secret = secret.encode()

    def report(self, db, project_id):
        from .media import render_inputs_hash
        from .media_automation import downloads_root, project_download_folder
        from .workflow import settings_for

        p = db.get(Project, project_id)
        if not p:
            raise HTTPException(404, 'Project not found')
        folder = project_path(self.root, p.id)
        blockers = []
        for job in db.query(Job).filter(Job.project_id == p.id, or_(Job.status.in_(('queued', 'running', 'waiting_user')), Job.id.in_(self.workflow.active_jobs))):
            if job.kind == 'premise_generation' and p.selected_premise_id and job.status == 'waiting_user' and job.id not in self.workflow.active_jobs:
                continue
            blockers.append({'id': job.id, 'kind': job.kind, 'status': job.status})
        render = latest_report(db, p.id)
        reason = ''
        final = None
        if not render or render.story_version != p.story_version or render.content.get('story_version') != p.story_version:
            reason = 'Render a final video for the current story before cleaning resources.'
        else:
            try:
                final = safe_path(self.root, render.content.get('file', 'missing'))
                check_ancestors(final)
                if not final.is_relative_to(folder.resolve()) or final.name != 'final_video.mp4' or not final.is_file() or not final.stat().st_size:
                    final = None
                    reason = 'The current final video is missing or empty. Resources were not deleted.'
            except (ValueError, OSError):
                final = None
                reason = 'The current final video is missing or empty. Resources were not deleted.'
        config = settings_for(db, db.get(Channel, p.channel_id))
        rows = [[serialize(row) for row in db.query(model).filter_by(project_id=p.id)] for model in (Chunk, Scene, Asset)]
        was_current = bool(render and (archived_final_matches(self.root, p, render, config)
                           or render.content.get('inputs_hash') == render_inputs_hash(serialize(p), *rows, config)))
        private = private_file_plan(db, self.root, [p.id])
        files, kept, roots, seen = [], [], [str(folder)], set()

        def item(path, owner_root, scope, proof):
            path = Path(path).absolute()
            owner_root = Path(owner_root).absolute()
            key = str(path).casefold()
            if key in seen or not path.exists():
                return
            seen.add(key)
            try:
                check_ancestors(owner_root); check_ancestors(path)
                if not path.is_relative_to(owner_root) or not path.resolve().is_relative_to(owner_root.resolve()) or not path.is_file():
                    raise ValueError('Unverified resource path')
                if path == final or (scope == 'Downloads' and re.fullmatch(r'final_video(?: \(\d+\))?\.mp4', path.name, re.I)):
                    kept.append({'path': str(path), 'reason': 'Final video'}); return
                if key in protected:
                    kept.append({'path': str(path), 'reason': 'Shared with another project'}); return
                info = path.stat()
                files.append({'path': str(path), 'root': str(owner_root), 'scope': scope, 'proof': proof,
                              'bytes': info.st_size, 'mtime_ns': info.st_mtime_ns, 'inode': info.st_ino})
            except (OSError, ValueError):
                kept.append({'path': str(path), 'reason': 'Unverified or linked file'})

        protected = set()
        for other in db.query(Asset).filter((Asset.project_id != p.id) | Asset.project_id.is_(None)):
            for value in (other.path, (other.metadata_json or {}).get('download_path')):
                if isinstance(value, str) and value:
                    protected.add(str((self.root / value).absolute()).casefold())
        for value in private['kept']:
            protected.add(str((self.root / value).absolute()).casefold())
            kept.append({'path': str(self.root / value), 'reason': 'Shared or linked file'})
        for entry in private['files']:
            item(self.root / entry['path'], folder, 'Projects', 'project-folder')
        if final and not any(k['path'] == str(final) for k in kept):
            kept.append({'path': str(final), 'reason': 'Final video'})

        download_name = project_download_folder(db, p)
        state = (p.settings or {}).get('media_automation', {})
        directories = {downloads_root() / download_name}
        saved_download = state.get('download_path')
        if saved_download:
            candidate = Path(saved_download)
            if candidate.is_absolute() and candidate.name == download_name and candidate.parent != candidate:
                directories.add(candidate)
        # Only recorded provider downloads belong to this project. An arbitrary
        # file added by the user to Downloads is not proof of project ownership.
        external = []
        for asset in db.query(Asset).filter_by(project_id=p.id):
            value = (asset.metadata_json or {}).get('download_path')
            if isinstance(value, str) and value and (asset.metadata_json or {}).get('browser_download_id') is not None:
                source = Path(value)
                if source.is_absolute() and source.parent.name == download_name:
                    directories.add(source.parent)
                    external.append({'path': str(source), 'root': str(source.parent), 'scope': 'Downloads', 'proof': 'provider-download'})
        for key in ('resource_cleanup', 'last_resource_cleanup'):
            for previous in (p.settings or {}).get(key, {}).get('external_files', []):
                if previous.get('proof') == 'provider-download' and Path(previous.get('root', '')).name == download_name:
                    external.append(previous)
        for entry in external:
            item(entry['path'], entry['root'], entry['scope'], entry['proof'])
        for directory in directories:
            try:
                check_ancestors(directory)
                if directory.is_dir():
                    roots.append(str(directory))
                    for file in directory.glob('final_video*.mp4'):
                        item(file, directory, 'Downloads', 'final-download')
                    known = {str(Path(e['path']).absolute()).casefold() for e in external}
                    for file in directory.iterdir():
                        if str(file.absolute()).casefold() not in seen and str(file.absolute()).casefold() not in known:
                            kept.append({'path': str(file), 'reason': 'Not recorded as a project resource'})
            except (OSError, ValueError):
                kept.append({'path': str(directory), 'reason': 'Unverified or linked folder'})
        exports = self.root / 'exports'
        for file in exports.glob(p.id + '-project-v*.zip'):
            item(file, exports, 'Exports', 'project-export')
        # CapCut drafts can live on the system disk. Delete only drafts carrying
        # this app's manifest with the exact project ID and draft ID.
        draft_folders = set()
        for model, field in ((Artifact, 'content'), (Job, 'result')):
            for row in db.query(model).filter_by(project_id=p.id, kind='capcut_export'):
                value = getattr(row, field) or {}
                if value.get('format') == 'storyforge-capcut' and value.get('project_id') == p.id and value.get('folder'):
                    draft_folders.add(value['folder'])
        for value in draft_folders:
            directory = Path(value)
            try:
                check_ancestors(directory)
                if not directory.is_absolute() or directory.parent == directory or not directory.is_dir():
                    continue
                manifest_path = directory / 'storyforge_export.json'
                check_ancestors(manifest_path)
                manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
                if manifest.get('format') != 'storyforge-capcut' or manifest.get('project_id') != p.id or not manifest.get('draft_id'):
                    raise ValueError('Unverified CapCut draft')
                if any((a.content or {}).get('folder') == value for a in db.query(Artifact).filter(Artifact.project_id != p.id, Artifact.kind == 'capcut_export')):
                    raise ValueError('Shared CapCut draft')
                roots.append(str(directory))
                for parent, dirs, names in os.walk(directory, followlinks=False):
                    for name in dirs[:]:
                        if linked(Path(parent) / name):
                            dirs.remove(name); kept.append({'path': str(Path(parent) / name), 'reason': 'Linked folder'})
                    for name in names:
                        item(Path(parent) / name, directory, 'CapCut', 'capcut-manifest:' + manifest['draft_id'])
            except (OSError, ValueError, json.JSONDecodeError):
                kept.append({'path': value, 'reason': 'Unverified or shared CapCut draft'})
        files.sort(key=lambda f: (f['scope'] == 'CapCut' and Path(f['path']).name == 'storyforge_export.json', f['path']))
        report = {'project_id': p.id, 'title': p.title, 'story_version': p.story_version, 'project_folder': str(folder),
                  'files': files, 'count': len(files), 'bytes': sum(f['bytes'] for f in files), 'kept': kept,
                  'roots': sorted(set(roots)), 'blocked': bool(blockers or reason), 'reason': reason, 'blockers': blockers,
                  'final': str(final) if final else '', 'final_signature': [final.stat().st_size, final.stat().st_mtime_ns, final.stat().st_ino] if final else [],
                  'was_current': was_current, 'report_id': render.id if render else None}
        snapshot = {'project': serialize(p), 'assets': rows[2], 'chunks': rows[0], 'scenes': rows[1],
                    'jobs': [(j.id, j.updated_at) for j in db.query(Job).filter_by(project_id=p.id)], 'render': serialize(render) if render else None}
        report['confirmation'] = hmac.new(self.secret, json.dumps([report, snapshot], sort_keys=True, ensure_ascii=False).encode(), hashlib.sha256).hexdigest()
        return report

    def preview(self, project_id):
        with self.workflow.deletion_lock, self.database.session() as db:
            return self.report(db, project_id)

    def confirm(self, project_id, confirmation):
        from .workflow import settings_for
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(text('BEGIN IMMEDIATE'))
            report = self.report(db, project_id)
            if report['blocked']:
                raise HTTPException(409, report['reason'] or 'Finish or cancel active project jobs before cleaning resources.')
            if not isinstance(confirmation, str) or not hmac.compare_digest(report['confirmation'], confirmation):
                raise HTTPException(409, 'Project resources changed. Review the cleanup preview again.')
            p = db.get(Project, project_id)
            render = db.get(Artifact, report['report_id'])
            final = Path(report['final'])
            # Compact the final to the top of its project folder when this can be
            # done without overwriting any existing file. A move does not recode.
            target = project_path(self.root, p.id) / 'final_video.mp4'
            shared_final = any(f['path'].casefold() == str(final).casefold() and f['reason'] != 'Final video' for f in report['kept'])
            if target != final and not target.exists() and not shared_final:
                check_ancestors(final); check_ancestors(target)
                journal = self.root / 'projects' / ('.storyforge-final-move-' + basename(p.id) + '.json')
                write_json(journal, {'project_id': p.id, 'report_id': render.id,
                    'source': str(final.relative_to(self.root)), 'target': str(target.relative_to(self.root)),
                    'signature': report['final_signature']})
                try:
                    final.rename(target)
                    render.content = {**render.content, 'file': str(target.relative_to(self.root))}
                    # Commit the retained final's new reference before removing
                    # any source files. A crash leaves the final downloadable.
                    db.commit()
                except Exception:
                    db.rollback()
                    recover_final_moves(self.database, self.root)
                    raise
                final = target
                journal.unlink()
                db.execute(text('BEGIN IMMEDIATE'))
            failed, removed, freed, deleted_paths = [], 0, 0, set()
            for entry in report['files']:
                path, owner = Path(entry['path']), Path(entry['root'])
                try:
                    if entry['scope'] == 'CapCut' and path.name == 'storyforge_export.json' and any(Path(f['path']).is_relative_to(owner) for f in failed):
                        raise ValueError('Keep the ownership manifest until the remaining CapCut files are removed')
                    check_ancestors(owner); check_ancestors(path)
                    if not path.is_relative_to(owner) or not path.resolve().is_relative_to(owner.resolve()) or path == final:
                        raise ValueError('Resource path escaped its confirmed owner')
                    info = path.stat()
                    if [info.st_size, info.st_mtime_ns, info.st_ino] != [entry['bytes'], entry['mtime_ns'], entry['inode']]:
                        raise ValueError('Resource changed after confirmation')
                    path.unlink(); removed += 1; freed += entry['bytes']; deleted_paths.add(str(path).casefold())
                except (OSError, ValueError) as error:
                    failed.append({'path': str(path), 'error': str(error)})
            removed_ids = set()
            for asset in db.query(Asset).filter_by(project_id=p.id).all():
                internal = str((self.root / asset.path).absolute()).casefold()
                if internal in deleted_paths or not (self.root / asset.path).exists():
                    shared = db.query(Chunk).filter(Chunk.project_id != p.id, Chunk.asset_id == asset.id).count() or db.query(Scene).filter(Scene.project_id != p.id, or_(Scene.asset_id == asset.id, Scene.fallback_asset_id == asset.id)).count()
                    if shared:
                        continue
                    removed_ids.add(asset.id); db.delete(asset)
            for chunk in db.query(Chunk).filter_by(project_id=p.id):
                if chunk.asset_id in removed_ids:
                    chunk.asset_id, chunk.real_duration = None, None
                    if chunk.status != 'STALE': chunk.status = 'PENDING'
            for scene in db.query(Scene).filter_by(project_id=p.id):
                if scene.asset_id in removed_ids: scene.asset_id = None
                if scene.fallback_asset_id in removed_ids: scene.fallback_asset_id = None
                if not scene.asset_id and not scene.fallback_asset_id and scene.status != 'STALE': scene.status = 'PENDING'
            publish = dict(p.publish or {})
            if publish.get('thumbnail_asset_id') in removed_ids:
                publish.pop('thumbnail_asset_id', None)
            if not report['was_current']: publish['final_reviewed'] = False
            p.publish = publish
            settings = dict(p.settings or {})
            options = dict(settings.get('render_options', {}))
            for key, enabled in (('logo_asset_id', 'overlay'), ('waveform_asset_id', 'waveform'), ('ending_asset_id', None)):
                if options.get(key) in removed_ids:
                    options[key] = None
                    if enabled: options[enabled] = False
            settings['render_options'] = options
            references = dict(settings.get('character_references', {}))
            references['asset_ids'] = [id for id in references.get('asset_ids', []) if id not in removed_ids]
            if references: settings['character_references'] = references
            for key in ('production_queue', 'thumbnail_pending_visuals', 'production_queue_notice'):
                settings.pop(key, None)
            info = final.stat()
            settings['resource_cleanup'] = {'status': 'partial' if failed else 'completed', 'cleaned_at': now(),
                'story_version': p.story_version, 'story_hash': digest(p.draft), 'was_current': report['was_current'],
                'report_id': render.id, 'final_path': str(final.relative_to(self.root)),
                'final_signature': [info.st_size, info.st_mtime_ns, info.st_ino], 'failed_files': failed,
                'external_files': [{k: f[k] for k in ('path', 'root', 'scope', 'proof')} for f in report['files'] if f['scope'] == 'Downloads']}
            p.settings = settings
            p.settings = {**settings, 'resource_cleanup': {**settings['resource_cleanup'], 'settings_signature': settings_signature(p, settings_for(db, db.get(Channel, p.channel_id)))}}
            render.content = {**render.content, 'resources_cleaned': True}
            db.commit()
            # Remove empty directories only. Never follow junctions or recursively
            # delete a root based on a title or on a caller-supplied path.
            for value in report['roots']:
                directory = Path(value)
                try:
                    check_ancestors(directory)
                    if not directory.is_dir(): continue
                    for parent, _, _ in os.walk(directory, topdown=False, followlinks=False):
                        path = Path(parent)
                        check_ancestors(path)
                        if path.resolve().is_relative_to(directory.resolve()) and path != project_path(self.root, p.id):
                            try: path.rmdir()
                            except OSError: pass
                except (OSError, ValueError):
                    pass
            return {'cleaned': not failed, 'removed_files': removed, 'freed_bytes': freed, 'failed_files': failed,
                    'kept_files': report['kept'], 'final': str(final), 'status': 'partial' if failed else 'completed'}

    def resume(self, project_id):
        with self.workflow.deletion_lock, self.database.session() as db:
            p = db.get(Project, project_id)
            if not p: raise HTTPException(404, 'Project not found')
            settings = dict(p.settings or {})
            state = settings.pop('resource_cleanup', None)
            if state: settings['last_resource_cleanup'] = state
            p.settings = settings
            db.commit()
            return {'resumed': True}
