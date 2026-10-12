"""Resource completeness; rendering in Assisted mode remains a manual action."""
import re

from .intelligence import digest
from .media import render_options, safe_path, validate_assets
from .models import Asset, Chunk, Job, Scene, serialize
from .thumbnail_packaging import current_plan, plan_identifier


CHECKPOINT = 'Finish resource generation and attach missing files before rendering.'


def state(db, project, root, config):
    chunks = db.query(Chunk).filter_by(project_id=project.id).order_by(Chunk.number).all()
    scenes = db.query(Scene).filter_by(project_id=project.id).order_by(Scene.number).all()
    assets = db.query(Asset).filter_by(project_id=project.id).order_by(Asset.id).all()
    validation = validate_assets([serialize(c) for c in chunks], [serialize(s) for s in scenes],
                                 [serialize(a) for a in assets], root, project.story_version,
                                 config.get('allow_visual_fallback', False))
    missing, warnings = list(validation['missing']), list(validation['warnings'])
    plan = current_plan(db, project)
    plan_hash = plan_identifier(plan) if plan else None
    all_thumbnails = bool(plan) or (config['pipeline_mode']=='assisted'
                                    and project.settings.get('assisted_production', {}).get('all_thumbnails', False))
    thumbnails = {}
    files = []
    options = render_options(serialize(project))
    render_assets = {key: value for key, value in options.items() if key.endswith('_asset_id')}
    extras = [db.get(Asset, id) for id in render_assets.values() if id and id not in {a.id for a in assets}]
    available = {}
    for asset in [*assets, *(a for a in extras if a)]:
        try:
            path = safe_path(root, asset.path)
            info = path.stat()
            stamp = [info.st_size, info.st_mtime_ns] if path.is_file() and info.st_size else None
        except (OSError, ValueError):
            stamp = None
        files.append([asset.id, asset.path, asset.sha256, asset.story_version, asset.duration, stamp])
        if stamp:
            available[asset.id] = asset
        meta = asset.metadata_json or {}
        if (stamp and asset.project_id == project.id and asset.kind == 'image'
                and asset.story_version == project.story_version):
            variant = meta.get('thumbnail_variant')
            if variant not in ('A', 'B', 'C'):
                # Manual imports have dimensions but no concept-plan metadata.
                # Recognize the original filename without claiming it matches
                # the current concept or changing the asset's saved metadata.
                match = re.fullmatch(r'thumbnail_([abc])\.(?:png|jpe?g|webp)', asset.name, re.I)
                variant = match.group(1).upper() if match else None
            if variant in ('A', 'B', 'C'):
                thumbnails[variant] = asset.id
    thumbnail_missing = [f'thumbnail_{v}.png' for v in ('A', 'B', 'C')
                         if all_thumbnails and v not in thumbnails]
    if thumbnail_missing:
        warnings.append('Some thumbnails are missing for publishing. This does not block rendering; the selected ending image must be available.')
    # Only files used in the actual video can block rendering. A stale or
    # missing publishing concept is not a missing video input.
    inputs = [('ending_asset_id', 'image', 'Ending thumbnail file is missing')]
    if options['overlay']:
        inputs.append(('logo_asset_id', 'image', 'Choose an available logo image or turn off overlay'))
    if options['waveform']:
        inputs.append(('waveform_asset_id', 'video', 'Choose an available green-screen video or turn off waveform'))
    for key, kind, message in inputs:
        if key == 'ending_asset_id' and not options[key]:
            continue
        asset = available.get(options[key])
        if not asset or asset.kind != kind or asset.project_id != project.id:
            missing.append(message)
    if project.settings.get('production_options', {}).get('music_enabled'):
        if not any(a.kind == 'music' and a.story_version == project.story_version
                   and a.id in available for a in assets):
            warnings.append('Background music is missing. Import a suitable track or render narration without music.')
    active = db.query(Job).filter(Job.project_id == project.id, Job.status.in_(('queued', 'running', 'waiting_user'))).count() > 0
    fingerprint = digest([project.id, project.story_version, digest(project.draft),
                          [[c.id, c.story_version, c.text, c.asset_id] for c in chunks],
                          [[s.id, s.story_version, s.start_word, s.end_word, s.visual_type,
                            s.prompt, s.negative_prompt, s.asset_id, s.fallback_asset_id] for s in scenes],
                          files, plan_hash, all_thumbnails, project.publish.get('thumbnail_asset_id'),
                          project.settings.get('production_options', {}), render_assets,
                          config.get('allow_visual_fallback', False)])
    ready = bool(project.locked and not missing)
    return {'required': False, 'approved': ready, 'can_approve': False,
            'ready': ready, 'can_render': bool(ready and not active), 'manual_render_required': config['pipeline_mode']=='assisted',
            'fingerprint': fingerprint, 'missing': missing, 'warnings': warnings,
            'narration': validation['narration'], 'visuals': validation['visuals'],
            'thumbnails': sorted(v for v in thumbnails if v in ('A', 'B', 'C')),
            'thumbnail_missing': thumbnail_missing,
            'active': active}


def approve(db, project, root, config, body):
    # Compatibility for an older open UI: return readiness without saving a
    # human approval or allowing missing resources to pass the render guard.
    review = state(db, project, root, config)
    if not review['can_render']:
        raise ValueError(CHECKPOINT)
    return review
