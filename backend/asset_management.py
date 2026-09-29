"""Remove selected project imports and their mappings without touching source files."""
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import or_, text

from .models import Asset, Chunk, Scene, Project, Job
from .project_files import private_file_plan, remove_planned_files


def delete_assets(database, workflow, project_id, ids):
    if not isinstance(ids, list) or not ids or len(ids) > 5000 or any(not isinstance(i, str) for i in ids):
        raise ValueError("Select between 1 and 5000 assets")
    ids = set(ids)
    with workflow.deletion_lock, database.session() as db:
        db.execute(text("BEGIN IMMEDIATE"))
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(404, "Project not found")
        if db.query(Job).filter(Job.project_id == project_id, or_(Job.status.in_(("queued", "running")), Job.id.in_(workflow.active_jobs))).count():
            raise HTTPException(409, "Wait for running jobs before deleting assets")
        assets = db.query(Asset).filter(Asset.id.in_(ids), Asset.project_id == project_id).all()
        if len(assets) != len(ids):
            raise HTTPException(409, "Selected assets changed. Refresh the list.")
        # The project cleanup planner already excludes shared files and links.
        # Narrow its plan to selected imports, preserving every remaining import.
        root = Path(workflow.root)
        selected_paths = {(root/a.path).resolve() for a in assets}
        remaining_paths = {(root/a.path).resolve() for a in db.query(Asset).filter(~Asset.id.in_(ids))}
        plan = private_file_plan(db, root, [project_id])
        plan['files'] = [f for f in plan['files'] if (root/f['path']).resolve() in selected_paths - remaining_paths]
        for chunk in db.query(Chunk).filter(Chunk.project_id == project_id, Chunk.asset_id.in_(ids)):
            chunk.asset_id = None
            chunk.real_duration = None
            if chunk.status != 'STALE':
                chunk.status = 'PENDING'
        for scene in db.query(Scene).filter_by(project_id=project_id):
            if scene.asset_id in ids:
                scene.asset_id = None
            if scene.fallback_asset_id in ids:
                scene.fallback_asset_id = None
            if not scene.asset_id and not scene.fallback_asset_id and scene.status != 'STALE':
                scene.status = 'PENDING'
        publish = {**(project.publish or {}), 'final_reviewed': False}
        if publish.get('thumbnail_asset_id') in ids:
            publish.pop('thumbnail_asset_id')
        project.publish = publish
        options = (project.settings or {}).get('render_options') or {}
        if options.get('waveform_asset_id') in ids:
            project.settings = {**project.settings, 'render_options': {**options, 'waveform_asset_id': None, 'waveform': False}}
            options = project.settings['render_options']
        if options.get('logo_asset_id') in ids:
            project.settings = {**project.settings, 'render_options': {**options, 'logo_asset_id': None, 'overlay': False}}
        if options.get('ending_asset_id') in ids:
            project.settings = {**project.settings, 'render_options': {**project.settings.get('render_options',{}), 'ending_asset_id':None}}
        for asset in assets:
            db.delete(asset)
        db.commit()
        cleanup = remove_planned_files(root, [project_id], plan)
        return {'deleted': True, 'count': len(ids), 'cleanup': cleanup}
