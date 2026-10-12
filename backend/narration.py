"""Channel voice defaults, immutable project voices and initial setup gates."""
from copy import deepcopy
import json
from sqlalchemy import text
from .models import Artifact, Channel, PremiseUsage

# These were the effective Browser Bridge settings, irrespective of the old
# global voice_name setting. Upgrades must not change the voice mid-project.
LEGACY_VOICE = {'speaker': 'Enzo', 'style': 'Friendly'}
SETUP_NOTICE = 'Review duration, image/video counts and narration voice in Overview, then confirm and continue.'


def channel_voice(channel):
    return deepcopy((channel.settings or {}).get('narration_voice') or LEGACY_VOICE)


def project_voice(db, project):
    return deepcopy((project.settings or {}).get('narration_voice') or
                    channel_voice(db.get(Channel, project.channel_id)))


def freeze_voice(db, project, override=None):
    voice = deepcopy(override if override is not None else channel_voice(db.get(Channel, project.channel_id)))
    project.settings = {**(project.settings or {}), 'narration_voice': voice}
    return voice


def setup_pending(project):
    setup = (project.settings or {}).get('setup_confirmation', {})
    return setup.get('required') is True and setup.get('confirmed') is not True


def setup_checkpoint():
    return {'checkpoint': SETUP_NOTICE, 'action_kind': 'project_setup'}


def require_setup(project):
    if setup_pending(project):
        raise ValueError(SETUP_NOTICE)


def successful_render(content):
    return bool(isinstance(content, dict) and content.get('file') and
                content.get('status') not in ('BLOCKED', 'FAILED', 'CANCELLED') and
                content.get('checks') and all(content['checks'].values()))


def rendered_once(db, project):
    # A deleted file, cleaned resources or a newer story version cannot make a
    # previously produced story idea unused again.
    if (project.settings or {}).get('video_completed'):
        return True
    return any(successful_render(a.content) for a in
               db.query(Artifact).filter_by(project_id=project.id, kind='render_report'))


def release_unfinished_idea(db, project):
    origin = (project.settings or {}).get('premise_origin', {})
    if not origin or rendered_once(db, project):
        return
    db.query(PremiseUsage).filter_by(project_id=project.id,
        pool_project_id=origin.get('project_id'), premise_id=origin.get('premise_id')).delete(synchronize_session=False)


def bootstrap_connection(conn):
    """Freeze legacy voices once; new projects use current channel defaults."""
    for row in conn.execute(text('SELECT id,settings FROM channels')).all():
        settings = json.loads(row.settings or '{}')
        settings.setdefault('narration_voice', deepcopy(LEGACY_VOICE))
        conn.execute(text('UPDATE channels SET settings=:settings WHERE id=:id'),
                     {'id': row.id, 'settings': json.dumps(settings, ensure_ascii=False)})
    for row in conn.execute(text('SELECT id,settings,locked,draft FROM projects')).all():
        settings = json.loads(row.settings or '{}')
        settings.setdefault('narration_voice', deepcopy(LEGACY_VOICE))
        if (settings.get('premise_origin') or settings.get('entry_mode')=='existing_bible') and not row.locked and not row.draft:
            started=conn.execute(text("SELECT id FROM artifacts WHERE project_id=:id AND kind IN ('outline','outline_rewrite') LIMIT 1"), {'id': row.id}).first()
            active=conn.execute(text("SELECT id FROM jobs WHERE project_id=:id AND status IN ('queued','running','waiting_user') LIMIT 1"), {'id': row.id}).first()
            if not started and not active:settings.setdefault('setup_confirmation', {'required': True, 'confirmed': False})
        if any(successful_render(json.loads(report.content or '{}')) for report in
               conn.execute(text("SELECT content FROM artifacts WHERE project_id=:id AND kind='render_report'"), {'id': row.id})):
            settings['video_completed'] = True
        conn.execute(text('UPDATE projects SET settings=:settings WHERE id=:id'),
                     {'id': row.id, 'settings': json.dumps(settings, ensure_ascii=False)})
