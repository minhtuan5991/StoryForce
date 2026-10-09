"""One reusable instrumental bed, with a durable generation lease across projects."""
from pathlib import Path
import hashlib

from .models import Asset, Job, Project, Setting, now, serialize, uid
from .media import safe_path, probe, run_process, find_binary

PROFILE = 'mystery'
LEASE_KEY = 'background_music_generation_v1'
MUSIC_PROMPT = (
    'Create a 30-second instrumental background music clip using Lyria. No lyrics, '
    'singing, speech, humming, choir or vocal samples. A mysterious, realistic suspense '
    'underscore for narrated mystery stories: a compelling quiet pulse from the very '
    'first second, restrained low drones, sparse soft piano and subtle atmospheric '
    'texture, around 70 BPM. Maintain a steady restrained tension after the opening; '
    'no abrupt hits, loud percussion, dramatic crescendos or final resolving chord. '
    'Leave the human speech frequency range uncluttered. Keep a consistent texture and '
    'tempo so this clip can loop beneath narration. This is a reusable instrumental '
    'score, not a song, cover image, explanation or JSON. Generate the audio clip.'
)


def production_suggestion(minutes):
    """Modest image budgets; opening videos stay at two or three 10-second clips."""
    import math
    minutes = min(240, max(1, float(minutes)))
    videos = 2 if minutes <= 10 else 3
    images = min(197, max(3, math.ceil(max(0, minutes * 60 - videos * 10) / 60)))
    return {'image_count': images, 'video_count': videos, 'video_seconds': 10}


def choices(project):
    return (project.settings or {}).get('production_options', {})


def approved_visual_payload(project):
    options = choices(project)
    if not options.get('preset_counts'):
        return None
    return {'mode': 'custom', 'image_count': options['image_count'], 'video_count': options['video_count'],
            'automatic_resources': True, 'confirmed_image_count': options['image_count'],
            'confirmed_video_count': options['video_count'], 'auto_continue': True}


class BackgroundMusic:
    def __init__(self, root):
        self.root = Path(root)
        self.folder = safe_path(self.root, 'background_music')
        self.folder.mkdir(parents=True, exist_ok=True)

    def ready(self, db):
        for asset in db.query(Asset).filter_by(project_id=None, kind='music').order_by(Asset.created_at):
            if asset.metadata_json.get('library_profile') != PROFILE:
                continue
            path = safe_path(self.root, asset.path)
            if path.is_file() and not path.is_symlink() and path.stat().st_size == asset.size and (asset.duration or 0) >= 15:
                return asset

    def link(self, db, project, library):
        existing = next((a for a in db.query(Asset).filter_by(project_id=project.id, kind='music')
                         if a.metadata_json.get('shared_library_id') == library.id and a.story_version == project.story_version), None)
        if not existing:
            existing = Asset(project_id=project.id, name=library.name, path=library.path, kind='music',
                             sha256=library.sha256, size=library.size, duration=library.duration,
                             metadata_json={**library.metadata_json, 'shared_library_id': library.id},
                             story_version=project.story_version)
            db.add(existing); db.flush()
        project.settings = {**project.settings, 'background_music': {'status': 'ready', 'asset_id': existing.id,
                            'library_id': library.id, 'story_version': project.story_version}}
        return existing

    def prepare(self, db, project, retry=False):
        if not choices(project).get('music_enabled'):
            return 'disabled'
        library = self.ready(db)
        if library:
            self.link(db, project, library)
            return 'ready'
        lease = db.get(Setting, LEASE_KEY)
        job = db.get(Job, lease.value.get('job_id')) if lease and lease.value.get('job_id') else None
        if job and job.status in ('queued', 'running', 'waiting_user'):
            project.settings = {**project.settings, 'background_music': {'status': 'waiting_library', 'job_id': job.id}}
            return 'waiting_library'
        if lease and not retry:
            # One unavailable service must not trigger a new generation for every video.
            project.settings = {**project.settings, 'background_music': {'status': 'missing',
                                'reason': 'Lyria chưa tạo được nhạc dùng chung. Nhập một file nhạc hoặc bấm thử lại trong Tài nguyên.'}}
            return 'missing'
        return 'generate'

    def lease(self, db, job):
        entry = db.get(Setting, LEASE_KEY)
        value = {'job_id': job.id, 'profile': PROFILE, 'created_at': now()}
        if entry: entry.value = value
        else: db.add(Setting(key=LEASE_KEY, value=value))

    def resolve_waiters(self, db):
        resolved=[]
        for project in db.query(Project):
            if project.settings.get('background_music', {}).get('status') != 'waiting_library':
                continue
            status=self.prepare(db,project)
            if status != 'waiting_library':
                resolved.append(project.id)
        return resolved

    def import_track(self, db, project, source, config, download_id=None):
        info = probe(source, config)
        if not info.get('has_audio') or not 15 <= info.get('duration', 0) <= 180:
            raise ValueError('Nhạc nền cần một file âm thanh đầy đủ dài 15–180 giây; không nhận ảnh bìa hoặc đoạn tải chưa hoàn tất.')
        binary = find_binary('ffmpeg', config)
        if not binary:
            raise ValueError('FFmpeg is required to prepare the shared music loop')
        source_seconds = info['duration']
        original_seconds, fade = min(30, source_seconds), .4
        temporary = self.folder / ('import-' + uid() + '.wav')
        # End blends into the beginning. The file starts at t=fade, so repeated
        # playback continues from the last blended sample instead of clicking.
        graph = (f'[0:a]asplit=3[h][m][t];[h]atrim=0:{fade},asetpts=PTS-STARTPTS[head];'
                 f'[m]atrim={fade}:{original_seconds-fade},asetpts=PTS-STARTPTS[middle];'
                 f'[t]atrim={original_seconds-fade}:{original_seconds},asetpts=PTS-STARTPTS[tail];'
                 f'[tail][head]acrossfade=d={fade}:c1=tri:c2=tri[seam];'
                 '[middle][seam]concat=n=2:v=0:a=1[out]')
        try:
            run_process([binary, '-v', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe',
                         '-i', str(source), '-filter_complex', graph, '-map', '[out]', '-ar', '48000',
                         '-ac', '2', '-c:a', 'pcm_s16le', str(temporary)], timeout=180)
            info = probe(temporary, config)
            if not info.get('has_audio') or info['duration'] < 14:
                raise ValueError('The prepared music loop is incomplete')
            with temporary.open('rb') as handle:
                checksum = hashlib.file_digest(handle, 'sha256').hexdigest()
            destination = self.folder / ('mystery-' + checksum[:16] + '.wav')
            temporary.replace(destination)
            library = db.query(Asset).filter_by(project_id=None, kind='music', sha256=checksum).first()
            if library:
                return self.link(db, project, library) if project else library
            library = Asset(project_id=None, kind='music', name='bgm_mystery.wav',
                            path=str(destination.relative_to(self.root)), duration=info['duration'],
                            sha256=checksum, size=destination.stat().st_size, story_version=0,
                            metadata_json={**info, 'role': 'shared_background_music', 'library_profile': PROFILE,
                                           'provider': 'lyria' if download_id is not None else 'import',
                                           'source_duration': source_seconds, 'loop_crossfade': fade,
                                           'envelope_version': 1, 'intro_seconds': 30,
                                           'intro_db': -23, 'body_db': -31,
                                           **({'browser_download_id': download_id, 'download_path': str(source)} if download_id is not None else {})})
            db.add(library); db.flush()
            return self.link(db, project, library) if project else library
        finally:
            temporary.unlink(missing_ok=True)

    def public(self, db):
        return {'folder': str(self.folder), 'items': [serialize(a) for a in db.query(Asset).filter_by(project_id=None, kind='music')
                if a.metadata_json.get('library_profile') == PROFILE], 'prompt': MUSIC_PROMPT}


def music_volume_filter(asset, default_db):
    meta = asset.get('metadata_json') or {}
    if meta.get('envelope_version') != 1:
        return f'volume={default_db}dB'
    # Speech sidechain compression follows this envelope in the render graph.
    intro, body = float(meta.get('intro_db', -23)), float(meta.get('body_db', -31))
    seconds = max(5, min(60, float(meta.get('intro_seconds', 30))))
    return (f"afade=t=in:d=0.8,volume='pow(10,({intro}+({body}-{intro})*"
            f"min(1,max(0,(t-{seconds})/5)))/20)':eval=frame")
