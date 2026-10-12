"""One reusable instrumental bed, with a durable generation lease across projects."""
from pathlib import Path
import hashlib
import math

from .models import Asset, Job, Project, Setting, now, serialize, uid
from .media import safe_path, probe, run_process, find_binary

PROFILE = 'mystery'
PROFILE_VERSION = 2
LEASE_KEY = 'background_music_generation_v2'
LYRIA_OPTIONS = {'duration': 'full', 'model': 'lyria-3-pro-preview', 'instrumental': True,
                 'surface': 'aistudio_music'}
MUSIC_PROMPT = (
    'Compose a full-length 2-to-3-minute instrumental mystery underscore using Lyria 3 Pro, '
    'aiming for about 150 seconds. No lyrics, '
    'singing, speech, humming, choir or vocal samples. A mysterious, realistic suspense '
    'underscore for narrated mystery stories: a compelling quiet pulse from the very '
    'first second, layered low drones, sparse felt piano, enigmatic minor intervals, '
    'subtle reversed textures and a slow curious pulse, around 70 BPM. Introduce small '
    'variations in texture every 16 bars without changing the key or tempo. Maintain '
    'a mysterious, unresolved feeling throughout; '
    'no abrupt hits, loud percussion, dramatic crescendos or final resolving chord. '
    'Leave the human speech frequency range uncluttered. Keep a consistent texture and '
    'tempo so this track can loop beneath narration. Design a seamless circular loop: '
    'the final bars return to the same harmony, bass note, pulse phase and ambience '
    'as the opening. Do not fade to silence, announce an ending or use a resolving '
    'chord. Both ends must retain compatible continuous sound for an inaudible join. '
    '[00:00 - 00:30] Establish the intriguing pulse and restrained suspense immediately. '
    '[00:30 - 02:15] Sustain the mysterious ambience with small texture variations. '
    '[02:15 - 02:30] Return to the opening harmony, bass, pulse and ambience, maintaining '
    'continuous sound through the final sample for a seamless circular loop. '
    'This is a reusable instrumental '
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
        self.signatures = {}
        self.invalid_paths = set()

    def available(self, asset):
        if not asset or asset.project_id is not None or asset.kind != 'music':
            return False
        try:
            path = safe_path(self.root, asset.path)
            return str(path) not in self.invalid_paths and path.is_file() and not path.is_symlink() and path.stat().st_size == asset.size and (asset.duration or 0) > 0
        except (OSError, ValueError):
            return False

    def scan_folder(self, db, config):
        """Register finished audio files placed in the shared folder; never edit them."""
        errors = []
        known = {str(Path(a.path)):a for a in db.query(Asset).filter_by(project_id=None, kind='music')}
        for path in sorted(self.folder.iterdir(), key=lambda p:p.name.casefold()):
            if path.is_symlink() or not path.is_file() or path.suffix.lower() not in {'.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus'} or path.name.startswith(('import-', 'upload-')):
                continue
            try:
                path = safe_path(self.root, path.relative_to(self.root))
                info = path.stat()
                signature = [info.st_size, info.st_mtime_ns]
                relative = str(path.relative_to(self.root))
                asset = known.get(relative)
                if asset and (self.signatures.get(relative) == signature or asset.metadata_json.get('library_file_signature') == signature):
                    continue
                if not 0 < info.st_size <= 2_000_000_000:
                    raise ValueError('Empty file or file larger than 2 GB')
                metadata = probe(path, config)
                if not metadata.get('has_audio') or not metadata.get('duration', 0) > 0:
                    raise ValueError('Not a complete audio file')
                with path.open('rb') as handle:
                    checksum = hashlib.file_digest(handle, 'sha256').hexdigest()
                after = path.stat()
                if signature != [after.st_size, after.st_mtime_ns]:
                    raise ValueError('File is still being copied')
                if asset:
                    # Existing prepared tracks keep their provider/profile identity.
                    if asset.sha256 != checksum or asset.size != info.st_size or abs((asset.duration or 0)-metadata['duration']) > .1:
                        asset.sha256, asset.size, asset.duration = checksum, info.st_size, metadata['duration']
                        asset.metadata_json = {**asset.metadata_json, **metadata, 'library_file_signature':signature}
                        for link in db.query(Asset).filter(Asset.project_id.isnot(None), Asset.kind=='music'):
                            if link.metadata_json.get('shared_library_id')==asset.id:
                                link.sha256,link.size,link.duration=asset.sha256,asset.size,asset.duration
                                link.metadata_json={**asset.metadata_json,'shared_library_id':asset.id}
                                p=db.get(Project,link.project_id)
                                if p and p.settings.get('background_music',{}).get('asset_id')==link.id:
                                    p.publish={**p.publish,'final_reviewed':False}
                    else:
                        self.signatures[relative]=signature
                else:
                    asset=Asset(project_id=None,kind='music',name=path.name,path=relative,
                                duration=metadata['duration'],size=info.st_size,sha256=checksum,story_version=0,
                                metadata_json={**metadata,'role':'shared_background_music','library_profile':'user',
                                    'provider':'folder','original_name':path.name,'source_level_preserved':True,
                                    'library_file_signature':signature})
                    db.add(asset);db.flush();known[relative]=asset
                self.invalid_paths.discard(str(path))
            except (OSError, ValueError) as exc:
                self.invalid_paths.add(str(path))
                errors.append({'name':path.name,'reason':str(exc)})
        return errors

    def ready(self, db, legacy=False):
        for asset in db.query(Asset).filter_by(project_id=None, kind='music').order_by(Asset.created_at.desc()):
            if asset.metadata_json.get('library_profile') != PROFILE:
                continue
            if not legacy and asset.metadata_json.get('music_profile_version', 1) < PROFILE_VERSION:
                continue
            if self.available(asset) and (asset.duration or 0) >= 15:
                return asset

    def fallback(self, db, project):
        current=project.settings.get('background_music',{}).get('library_id')
        library=db.get(Asset,current) if current else None
        return library if self.available(library) else self.ready(db,legacy=True)

    def link(self, db, project, library, manual=False):
        existing = next((a for a in db.query(Asset).filter_by(project_id=project.id, kind='music')
                         if a.metadata_json.get('shared_library_id') == library.id and a.story_version == project.story_version), None)
        if not existing:
            existing = Asset(project_id=project.id, name=library.name, path=library.path, kind='music',
                             sha256=library.sha256, size=library.size, duration=library.duration,
                             metadata_json={**library.metadata_json, 'shared_library_id': library.id},
                             story_version=project.story_version)
            db.add(existing); db.flush()
        if project.settings.get('background_music', {}).get('asset_id') != existing.id:
            project.publish = {**(project.publish or {}), 'final_reviewed': False}
        project.settings = {**project.settings, 'background_music': {'status': 'ready', 'asset_id': existing.id,
                            'library_id': library.id, 'story_version': project.story_version,
                            'selection_mode':'manual' if manual else 'auto'}}
        return existing

    def prepare(self, db, project, retry=False, regenerate=False):
        if not choices(project).get('music_enabled'):
            return 'disabled'
        selected=project.settings.get('background_music', {})
        library=db.get(Asset,selected.get('library_id')) if selected.get('library_id') else None
        if not regenerate and selected.get('selection_mode')=='manual' and self.available(library):
            self.link(db,project,library,manual=True)
            return 'ready'
        library = self.ready(db)
        if library and not regenerate:
            self.link(db, project, library)
            return 'ready'
        lease = db.get(Setting, LEASE_KEY)
        job = db.get(Job, lease.value.get('job_id')) if lease and lease.value.get('job_id') else None
        if job and job.status in ('queued', 'running', 'waiting_user'):
            project.settings = {**project.settings, 'background_music': {**project.settings.get('background_music', {}),
                                'status': 'waiting_library', 'job_id': job.id}}
            return 'waiting_library'
        if lease and not retry and not regenerate:
            # One unavailable service must not trigger a new generation for every video.
            fallback = self.fallback(db, project)
            if fallback:
                self.link(db, project, fallback,manual=selected.get('selection_mode')=='manual' and selected.get('library_id')==fallback.id)
                project.settings = {**project.settings, 'background_music': {**project.settings['background_music'],
                    'upgrade_notice': 'Lyria chưa tạo được bản nhạc dài. Dự án vẫn dùng nhạc hiện có; có thể thử lại trong Tài nguyên.'}}
                return 'ready'
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

    def import_track(self, db, project, source, config, download_id=None, original_name=None, expected_duration=None):
        info = probe(source, config)
        if not info.get('has_audio') or not 15 <= info.get('duration', 0) <= 600:
            raise ValueError('Nhạc nền cần một file âm thanh đầy đủ dài 15–600 giây; không nhận ảnh bìa hoặc đoạn tải chưa hoàn tất.')
        if expected_duration is not None:
            if (isinstance(expected_duration, bool) or not isinstance(expected_duration, (int, float)) or
                    not math.isfinite(expected_duration) or not 0 < expected_duration <= 600):
                raise ValueError('[MUSIC_INCOMPLETE] Chưa xác minh được thời lượng Music player trên AI Studio; chưa nhận file nhạc.')
            if abs(info['duration'] - expected_duration) > max(2, expected_duration * .02):
                raise ValueError(f"[MUSIC_INCOMPLETE] File nhạc dài {info['duration']:.2f}s khác Music player "
                                 f'{expected_duration:.2f}s. Tải lại file hoàn chỉnh; giữ bản nhạc cũ.')
        if download_id is not None and info['duration'] < 90:
            raise ValueError('Lyria trả đoạn nhạc ngắn. Dùng Lyria 3 Pro Preview trong AI Studio và yêu cầu 2–3 phút, rồi thử lại; file nhạc cũ vẫn được giữ.')
        binary = find_binary('ffmpeg', config)
        if not binary:
            raise ValueError('FFmpeg is required to prepare the shared music loop')
        source_seconds = info['duration']
        original_seconds = min(180, source_seconds)
        fade = min(1.5, max(.4, original_seconds * .02))
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
            destination = self.folder / ('mystery-v2-' + checksum[:16] + '.wav')
            temporary.replace(destination)
            library = db.query(Asset).filter_by(project_id=None, kind='music', sha256=checksum).first()
            if library:
                return self.link(db, project, library,manual=download_id is None) if project else library
            library = Asset(project_id=None, kind='music', name='bgm_mystery.wav',
                            path=str(destination.relative_to(self.root)), duration=info['duration'],
                            sha256=checksum, size=destination.stat().st_size, story_version=0,
                            metadata_json={**info, 'role': 'shared_background_music', 'library_profile': PROFILE,
                                           'provider': 'lyria' if download_id is not None else 'import',
                                           'source_duration': source_seconds, 'loop_crossfade': fade,
                                           'music_profile_version': PROFILE_VERSION, 'loop_version': 2,
                                           'envelope_version': 2, 'intro_seconds': 0,
                                           **({'provider_duration':expected_duration} if expected_duration is not None else {}),
                                           **({'original_name':Path(original_name.replace('\\','/')).name} if original_name else {}),
                                           **({'browser_download_id': download_id, 'download_path': str(source)} if download_id is not None else {})})
            db.add(library); db.flush()
            return self.link(db, project, library,manual=download_id is None) if project else library
        finally:
            temporary.unlink(missing_ok=True)

    def public(self, db, errors=()):
        return {'folder': str(self.folder), 'items': [{**serialize(a), 'available':self.available(a),
                 'display_name':a.metadata_json.get('original_name') or a.name}
                for a in db.query(Asset).filter_by(project_id=None, kind='music').order_by(Asset.created_at.desc())
                if a.metadata_json.get('role')=='shared_background_music' or a.metadata_json.get('library_profile') in (PROFILE,'user')],
                'errors':list(errors), 'prompt': MUSIC_PROMPT,
                'profile_version': PROFILE_VERSION, 'lyria': LYRIA_OPTIONS}


def music_volume_filter(asset, default_db, *, balance=None):
    # One fixed gain, including old shared tracks that stored intro/body levels.
    gain = balance['body_db'] if balance is not None else default_db
    return f'volume={gain}dB'
