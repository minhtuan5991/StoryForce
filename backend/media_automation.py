"""Sequential browser media jobs and verified imports of completed downloads.

Visual jobs only exist after an explicit count confirmation. The browser receives
one job at a time and a durable send permit; a restart never grants a second run.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
import shutil
import base64
import io
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text as sql_text

from .intelligence import digest, words
from .media import project_folder, probe, safe_path, find_binary, run_process
from .models import Asset, Chunk, Scene, Job, Project, Channel, Artifact, now, uid, serialize
from .production_extras import thumbnail_prompt, scene_generation_prompt
from .thumbnail_packaging import current_plan, variant_prompt, selection, image_checks, assign_thumbnail, plan_identifier
from .providers import PROVIDER_URLS
from .media_sessions import provider_page, TTS_OPTIONS, visual_identity


MEDIA_KINDS = {"tts_context": "audio", "image_generation": "image", "video_generation": "video"}
FLOW_OPTIONS = {"mode": "Video", "input_mode": "Ingredients", "aspect": "16:9",
                "model": "Omni 1.1 Flash", "resolution": "720p", "seconds": 10, "outputs": 1}


def downloads_root():
    if os.name == "nt":
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders") as key:
                value, _ = winreg.QueryValueEx(key, "{374DE290-123F-4565-9164-39C4925E467B}")
                return Path(os.path.expandvars(value)).resolve()
        except OSError:
            pass
    return (Path.home() / "Downloads").resolve()


def download_folder(title):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", title).strip(" .")[:90].rstrip(" .") or "StoryForge"
    if re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", name, re.I):
        name = "StoryForge_" + name
    return name


def project_download_folder(db, p):
    """Reuse a project's established folder, including after it is renamed."""
    saved = p.settings.get('media_download_folder') or p.settings.get('media_automation', {}).get('folder')
    if isinstance(saved, str) and saved and download_folder(saved) == saved:
        return saved
    folder = download_folder(p.title)
    for other in db.query(Project).filter(Project.id != p.id):
        prior = other.settings.get('media_download_folder') or other.settings.get('media_automation', {}).get('folder') or download_folder(other.title)
        if str(prior).casefold() == folder.casefold():
            return folder[:78].rstrip(' .') + ' - ' + p.id[:8]
    return folder


def target_hash(target):
    if isinstance(target, Chunk):
        return digest([target.id, target.story_version, target.number, target.text])
    return digest([target.id, target.story_version, target.number, target.visual_type, target.prompt, target.negative_prompt])


def narration_download_error(text, duration, expected_duration=None):
    # A conservative 600 WPM ceiling catches streaming fragments without
    # forcing Enzo to match the project's estimated narration speed.
    if not duration or not math.isfinite(duration) or duration < len(words(text)) / 10:
        return "[TTS_INCOMPLETE] File WAV quá ngắn so với lời kể. Tải lại WAV đầy đủ qua nút Download của AI Studio; chưa gán file hoặc chuyển scene."
    if expected_duration is not None:
        if isinstance(expected_duration, bool) or not isinstance(expected_duration, (int, float)) or not math.isfinite(expected_duration) or expected_duration <= 0:
            return "[TTS_INCOMPLETE] Chưa xác minh được thời lượng trên AI Studio. Kiểm tra kết quả rồi tiếp tục tải."
        if abs(duration - expected_duration) > max(2, expected_duration * .02):
            return f"[TTS_INCOMPLETE] WAV dài {duration:.2f}s khác thời lượng AI Studio {expected_duration:.2f}s. Tải lại kết quả đầy đủ; chưa gán file hoặc chuyển scene."


class MediaAutomation:
    def __init__(self, workflow):
        self.workflow = workflow
        self.database, self.root = workflow.database, workflow.root
        self.started_at = datetime.now(timezone.utc)

    def project(self, db, id):
        p = db.get(Project, id)
        if not p:
            raise ValueError("Project not found")
        if not p.locked:
            raise ValueError("Lock the story before production")
        return p

    def available(self, db, id, kind, version):
        asset = db.get(Asset, id) if id else None
        kinds = (kind,) if isinstance(kind, str) else kind
        return bool(asset and asset.kind in kinds and asset.story_version == version and safe_path(self.root, asset.path).is_file())

    def preview(self, db, p):
        scenes = db.query(Scene).filter_by(project_id=p.id).order_by(Scene.number).all()
        images = sum(s.visual_type != "VIDEO" for s in scenes)
        videos = len(scenes) - images
        fingerprint = digest([p.id, p.story_version, p.draft, self.thumbnail(db, p, [serialize(s) for s in scenes]),
                              [(target_hash(s), s.asset_id) for s in scenes], p.publish.get("thumbnail_asset_id"),
                              p.settings.get('character_references', {})])
        folder = project_download_folder(db, p)
        return {"image_count": images, "video_count": videos, "thumbnail_count": 1,
                "confirmation": fingerprint, "folder": folder,
                "download_path": str(downloads_root() / folder), "flow": FLOW_OPTIONS}

    @staticmethod
    def thumbnail(db, p, scenes, variant=None):
        plan = current_plan(db, p)
        if plan:
            return variant_prompt(plan, variant or selection(p, plan))
        direction = db.query(Artifact).filter_by(project_id=p.id, kind='content_direction').order_by(Artifact.created_at.desc()).first()
        channel = db.get(Channel, p.channel_id)
        return thumbnail_prompt(serialize(p), scenes, serialize(channel) if channel else {}, direction.content if direction else {})

    @staticmethod
    def visuals_approval_hash(db, p):
        scenes = db.query(Scene).filter_by(project_id=p.id).order_by(Scene.number).all()
        return digest([p.story_version, p.draft, [(target_hash(s), s.asset_id) for s in scenes],
                       p.publish.get('thumbnail_asset_id'), p.settings.get('character_references', {})])

    def resume_thumbnail_visuals(self, project_id, job_id):
        with self.database.session() as db:
            p = self.project(db, project_id)
            pending = (p.settings or {}).get('thumbnail_pending_visuals', {})
            if pending.get('job_id') != job_id:
                return
            body = pending['body']
            valid = pending['resource_hash'] == self.visuals_approval_hash(db, p) and current_plan(db, p)
            p.settings = {k: v for k, v in p.settings.items() if k != 'thumbnail_pending_visuals'}
            if not valid:
                p.settings = {**p.settings, 'production_queue_notice': 'The visual plan changed. Confirm image/video counts again.'}
                db.commit()
                return
            report = self.preview(db, p)
            db.commit()
        self.start(project_id, {**body, 'confirmation': report['confirmation']})

    def start(self, id, body):
        from .workflow import settings_for
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            p = self.project(db, id)
            if settings_for(db, db.get(Channel, p.channel_id))["provider_mode"] != "browser":
                raise ValueError("Choose Browser Bridge mode before generating media")
            kind = body.get("kind")
            if kind not in ("tts", "visuals", "thumbnails"):
                raise ValueError("Choose narration or visuals")
            active = db.query(Job).filter(Job.project_id == id, Job.status.in_(["queued", "running", "waiting_user"])).all()
            if active:
                if kind == 'tts' and self.workflow.tts_active(active):
                    return self.public(p.settings['media_automation'])
                if kind == 'visuals' and self.workflow.tts_active(active):
                    report = self.preview(db, p)
                    if body.get('confirmation') != report['confirmation'] or body.get('image_count') != report['image_count'] or body.get('video_count') != report['video_count']:
                        raise ValueError('Confirm the current image and video counts before queueing')
                    if any(a['kind'] == 'visual_director' for a in p.settings.get('production_queue', [])):
                        raise ValueError('A replacement visual plan is queued. Confirm creation with the counts for that plan instead')
                    queued = {'kind': 'visuals', 'body': body, 'story_version': p.story_version, 'draft_hash': digest(p.draft), 'queued_at': now()}
                    p.settings = {**p.settings, 'production_queue': [queued], 'production_queue_notice': ''}
                    db.commit()
                    return {**queued, 'status': 'queued_after_tts'}
                raise ValueError("Finish or cancel the active project job first")
            regenerate = body.get("regenerate") is True
            items, skipped = [], 0
            if kind == "tts":
                targets = db.query(Chunk).filter_by(project_id=id).order_by(Chunk.number).all()
                if not targets:
                    raise ValueError("Split narration into audio segments first")
                for chunk in targets:
                    if chunk.story_version != p.story_version or chunk.status == "STALE":
                        raise ValueError("Recreate audio segments for the current story first")
                    asset = db.get(Asset, chunk.asset_id) if chunk.asset_id else None
                    if not regenerate and self.available(db, chunk.asset_id, "audio", p.story_version) and not narration_download_error(chunk.text, asset.duration):
                        skipped += 1
                        continue
                    items.append({"kind": "tts_context", "provider": "aistudio", "target_type": "chunk", "target_id": chunk.id,
                                  "source_hash": target_hash(chunk), "filename": f"tts_{chunk.number:03}.wav",
                                  "prompt": chunk.text, "voice": "Enzo", "style": "Friendly"})
            elif kind == 'thumbnails':
                plan = current_plan(db, p)
                if not plan or body.get('plan_hash') != plan_identifier(plan):
                    raise ValueError('Create current thumbnail concepts before generating their images')
                variants = body.get('variants', [selection(p, plan)])
                if not isinstance(variants, list) or not 1 <= len(variants) <= 3 or any(not isinstance(v,str) or v not in {'A','B','C'} for v in variants) or len(set(variants)) != len(variants):
                    raise ValueError('Choose one or up to three different thumbnail variants')
                for variant in variants:
                    prompt = variant_prompt(plan, variant)
                    items.append({'kind':'image_generation', 'provider':'gemini', 'target_type':'thumbnail', 'target_id':id,
                                  'variant_id':variant, 'plan_hash':plan_identifier(plan),
                                  'source_hash':digest(prompt), 'filename':f'thumbnail_{variant}.png', 'prompt':prompt})
            else:
                report = self.preview(db, p)
                if body.get("confirmation") != report["confirmation"] or body.get("image_count") != report["image_count"] or body.get("video_count") != report["video_count"]:
                    raise ValueError("Confirm the current image and video counts before automatic generation")
                if not current_plan(db, p):
                    if not db.query(Scene).filter_by(project_id=id).count():
                        raise ValueError('Create a visual plan before automatic generation')
                    preparation = Job(project_id=id, kind='thumbnail_plan', payload={'auto_continue':False})
                    db.add(preparation);db.flush()
                    p.settings = {**p.settings, 'thumbnail_pending_visuals': {'job_id':preparation.id, 'body':body,
                                  'resource_hash':self.visuals_approval_hash(db, p)}}
                    db.commit()
                    self.workflow.executor.submit(self.workflow.run, preparation.id)
                    return {**serialize(preparation), 'step':'Creating three thumbnail concepts before the approved visual batch'}
                scenes = db.query(Scene).filter_by(project_id=id).order_by(Scene.number).all()
                bible = db.query(Artifact).filter_by(project_id=id, kind='story_bible').order_by(Artifact.created_at.desc()).first()
                identity = visual_identity(bible.content if bible else {})
                if not scenes:
                    raise ValueError("Choose image/video counts and create a visual plan first")
                if regenerate or not self.available(db, p.publish.get("thumbnail_asset_id"), "image", p.story_version):
                    prompt = self.thumbnail(db, p, [serialize(s) for s in scenes])
                    plan = current_plan(db, p)
                    items.append({"kind": "image_generation", "provider": "gemini", "target_type": "thumbnail", "target_id": id,
                                  'variant_id':selection(p, plan), 'plan_hash':plan_identifier(plan),
                                  "source_hash": digest(prompt), "filename": "thumbnail.png", "prompt": prompt})
                else:
                    skipped += 1
                for scene in scenes:
                    media_kind = "video" if scene.visual_type == "VIDEO" else "image"
                    if scene.story_version != p.story_version or scene.status == "STALE":
                        raise ValueError("Create a visual plan for the current story first")
                    if not regenerate and self.available(db, scene.asset_id, ("image", "video"), p.story_version):
                        skipped += 1
                        continue
                    items.append({"kind": media_kind + "_generation", "provider": "flow" if media_kind == "video" else "gemini",
                                  "target_type": "scene", "target_id": scene.id, "source_hash": target_hash(scene),
                                  "filename": f"scene_{scene.number:03}.{'mp4' if media_kind == 'video' else 'png'}",
                                  "prompt": scene_generation_prompt(serialize(scene)) + identity,
                                  **({"flow": FLOW_OPTIONS} if media_kind == "video" else {})})
            folder = project_download_folder(db, p)
            p.settings = {**p.settings, 'media_download_folder': folder}
            state = {"id": uid(), "kind": kind, "phase": "running" if items else "completed", "story_version": p.story_version,
                     "draft_hash": digest(p.draft), "folder": folder, "download_path": str(downloads_root() / folder),
                     "total": len(items), "completed": 0, "failed": 0, "skipped": skipped, "pending": items, "current_job_id": None,
                     "confirmed_counts": {"images": body.get("image_count"), "videos": body.get("video_count")} if kind == "visuals" else {},
                     "created_at": now()}
            (downloads_root() / folder).mkdir(parents=True, exist_ok=True)
            self.advance(db, p, state)
            db.commit()
            return self.public(state)

    @staticmethod
    def public(state):
        return {k: v for k, v in state.items() if k != "pending"}

    def advance(self, db, p, state):
        pending = list(state["pending"])
        if pending:
            item = pending.pop(0)
            descriptor = {**item, "project_id": p.id, "batch_id": state["id"], "folder": state["folder"], "download_path": state["download_path"],
                          "story_version": state["story_version"]}
            if item['provider'] == 'aistudio':
                descriptor['tts'] = TTS_OPTIONS
            payload = {"_media": descriptor, "_draft_hash": state["draft_hash"], "_story_version": state["story_version"], "auto_continue": False}
            job = Job(project_id=p.id, kind=item["kind"], provider=item["provider"], attempts=1, status="waiting_user",
                      step="Đang chờ Bridge tạo và tải tài nguyên", progress=20, payload=payload, prompt=item["prompt"],
                      result={"waiting_user": True, "url": PROVIDER_URLS[item["provider"]]})
            db.add(job)
            db.flush()
            state.update(current_job_id=job.id, pending=pending)
        else:
            state.update(phase="completed_with_missing" if state.get('failed') else "completed", current_job_id=None, pending=[])
        p.settings = {**(p.settings or {}), "media_automation": state}

    def validate_job(self, db, job, body):
        media = (job.payload or {}).get("_media")
        if not media or job.kind not in MEDIA_KINDS:
            raise ValueError("This media job has no automatic generation approval")
        if job.status != "waiting_user" or job.attempts != body.get("attempt"):
            raise ValueError("Media job changed; discard the old result")
        p = self.project(db, job.project_id)
        state = (p.settings or {}).get("media_automation", {})
        if state.get("id") != media["batch_id"] or state.get("phase") != "running" or state.get("current_job_id") != job.id:
            raise ValueError("This media batch was stopped or replaced")
        if media["story_version"] != p.story_version or job.payload.get("_draft_hash") != digest(p.draft):
            raise ValueError("The story changed; start media generation for the new version")
        if media["target_type"] == "thumbnail":
            scenes = [serialize(s) for s in db.query(Scene).filter_by(project_id=p.id).order_by(Scene.number)]
            current_hash = digest(self.thumbnail(db, p, scenes, media.get('variant_id')))
            if media.get('plan_hash'):
                plan = current_plan(db, p)
                if not plan or media['plan_hash'] != plan_identifier(plan):
                    current_hash = None
        else:
            target = db.get(Chunk if media["target_type"] == "chunk" else Scene, media["target_id"])
            current_hash = target_hash(target) if target and target.project_id == p.id else None
        if current_hash != media["source_hash"]:
            raise ValueError("The scene or narration changed; do not attach an outdated download")
        return p, state, media

    def claim(self, id, body):
        owner = str(body.get("owner", ""))
        if not owner or len(owner) > 128:
            raise ValueError("Invalid bridge client")
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            job = db.get(Job, id)
            if not job:
                raise ValueError("Media job not found")
            self.validate_job(db, job, body)
            claim = (job.payload or {}).get("_media_claim", {})
            if claim and claim.get("owner") != owner:
                raise ValueError("Another browser owns this media job; do not generate it twice")
            claim = claim or {"owner": owner, "attempt": job.attempts, "phase": "claimed"}
            claim = {**claim, 'last_seen_at': now()}
            send = bool(body.get("authorize_send")) and claim["phase"] != "sent"
            if send:
                claim = {**claim, "phase": "sent", "sent_at": now()}
            job.payload = {**job.payload, "_media_claim": claim}
            db.commit()
            return {"send": send, "claim": claim}

    def owned(self, db, id, body):
        job = db.get(Job, id)
        if not job:
            raise ValueError('Media job not found')
        claim = job.payload.get('_media_claim', {})
        if claim.get('owner') != body.get('owner') or claim.get('attempt') != body.get('attempt'):
            raise ValueError('This browser does not own the media job')
        p, state, media = self.validate_job(db, job, body)
        return job, p, state, media

    def save_session(self, id, body):
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            job, p, _, media = self.owned(db, id, body)
            page = provider_page(job.provider, body.get('url'))
            if not page:
                return {'saved': False}
            previous = p.settings.get('media_sessions', {}).get(job.provider, {})
            # An established chat/project must not silently be rebound to another.
            if previous.get('url') and previous['url'] != page and job.provider != 'aistudio':
                raise ValueError('The provider session belongs to a different chat or project')
            if job.provider != 'aistudio':
                for other in db.query(Project).filter(Project.id != p.id):
                    if other.settings.get('media_sessions', {}).get(job.provider, {}).get('url') == page:
                        raise ValueError('This provider session already belongs to another project')
            last_prompt = job.prompt if job.payload.get('_media_claim', {}).get('phase') == 'sent' else previous.get('last_prompt')
            session = {'url': page, 'updated_at': now(), **({'last_prompt': last_prompt} if last_prompt else {}),
                       **({'tts': media.get('tts') or TTS_OPTIONS} if job.provider == 'aistudio' else {})}
            p.settings = {**p.settings, 'media_sessions': {**p.settings.get('media_sessions', {}), job.provider: session}}
            db.commit()
            return {'saved': True, 'session': session}

    def reference_assets(self, db, p):
        saved = p.settings.get('character_references', {})
        ids = saved.get('asset_ids', []) if saved.get('story_version') == p.story_version else []
        selected = [db.get(Asset, id) for id in ids]
        if not ids and not (saved.get('manual') and saved.get('story_version') == p.story_version):
            # A scene image is a better face reference than a typographic thumbnail.
            for scene in db.query(Scene).filter_by(project_id=p.id, story_version=p.story_version).order_by(Scene.number):
                asset = db.get(Asset, scene.asset_id) if scene.asset_id else None
                if asset and asset.kind == 'image' and scene.visual_type != 'VIDEO':
                    selected = [asset]
                    break
        return [a for a in selected if a and a.project_id == p.id and a.kind == 'image' and safe_path(self.root, a.path).is_file()][:3]

    def configure_references(self, id, body):
        ids = body.get('asset_ids')
        if not isinstance(ids, list) or len(ids) > 3 or any(not isinstance(v, str) for v in ids) or len(ids) != len(set(ids)):
            raise ValueError('Choose up to three character reference images')
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            p = self.project(db, id)
            active = db.query(Job).filter(Job.project_id == id, Job.status.in_(['queued', 'running', 'waiting_user']))
            if any(j.payload.get('_media') and j.provider in ('gemini', 'flow') for j in active):
                raise ValueError('Finish or stop visual generation before changing character references')
            for identifier in ids:
                asset = db.get(Asset, identifier)
                if not asset or asset.project_id != id or asset.kind != 'image' or not safe_path(self.root, asset.path).is_file():
                    raise ValueError('Character references must be image assets from this project')
            p.settings = {**p.settings, 'character_references': {'asset_ids': ids, 'manual': bool(ids), 'story_version': p.story_version}}
            db.commit()
            return {'saved': True}

    def references(self, id, body):
        from PIL import Image, ImageOps
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            job, p, _, media = self.owned(db, id, body)
            if job.provider not in ('gemini', 'flow') or media['target_type'] not in ('scene', 'thumbnail'):
                return {'files': []}
            snapshot = job.payload.get('_media_references')
            if snapshot is None:
                snapshot = []
                for asset in self.reference_assets(db, p):
                    with safe_path(self.root, asset.path).open('rb') as handle:
                        checksum = hashlib.file_digest(handle, 'sha256').hexdigest()
                    snapshot.append({'id': asset.id, 'sha256': asset.sha256, 'file_hash': checksum})
                job.payload = {**job.payload, '_media_references': snapshot}
                db.commit()
            files = []
            for saved in snapshot:
                asset = db.get(Asset, saved['id'])
                if not asset or asset.project_id != p.id or asset.kind != 'image' or asset.sha256 != saved['sha256']:
                    raise ValueError('The character reference changed; stop and restart this visual request')
                path = safe_path(self.root, asset.path)
                if not path.is_file():
                    raise ValueError('The character reference is missing; choose it again before starting visuals')
                with path.open('rb') as handle:
                    checksum = hashlib.file_digest(handle, 'sha256').hexdigest()
                if checksum != saved['file_hash']:
                    raise ValueError('The character reference file changed; stop and restart this visual request')
                with Image.open(path) as picture:
                    picture = ImageOps.exif_transpose(picture).convert('RGB')
                    picture.thumbnail((1536, 1536))
                    data = io.BytesIO(); picture.save(data, format='JPEG', quality=92)
                files.append({'name': 'sf_ref_' + checksum[:16] + '.jpg', 'mime': 'image/jpeg',
                              'data': base64.b64encode(data.getvalue()).decode(), 'asset_id': asset.id})
            return {'files': files}

    def check_stalled(self, current_time=None):
        """A frozen entire browser cannot report failure from its own worker.

        Skip a claimed item after three minutes without a Bridge heartbeat.
        Unclaimed/off/paired-later queues remain waiting, and restarting the app
        grants reconnection grace without granting another generation permit.
        """
        current_time = current_time or datetime.now(timezone.utc)
        if (current_time - self.started_at).total_seconds() < 180:
            return 0
        stale = []
        with self.database.session() as db:
            for job in db.query(Job).filter_by(status='waiting_user'):
                claim = job.payload.get('_media_claim', {})
                if not job.payload.get('_media') or not claim.get('owner'):
                    continue
                try:
                    seen = datetime.fromisoformat(claim.get('last_seen_at') or claim.get('sent_at') or job.updated_at)
                except (ValueError, TypeError):
                    continue
                if (current_time - seen).total_seconds() > 180:
                    stale.append((job.id, claim['owner'], claim['attempt'], claim.get('last_seen_at')))
        count = 0
        for id, owner, attempt, last_seen in stale:
            try:
                self.failure(id, {'owner':owner, 'attempt':attempt, 'last_seen_at':last_seen,
                                  'reason':'Trình duyệt hoặc Bridge mất liên lạc quá 3 phút. Tài nguyên này cần tạo thủ công.', 'stage':'browser_disconnected'})
                count += 1
            except ValueError:
                pass
        return count

    def complete(self, id, body):
        from .workflow import settings_for
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            job = db.get(Job, id)
            if not job:
                raise ValueError("Media job not found")
            claim = job.payload.get("_media_claim", {})
            if claim.get("owner") != body.get("owner") or claim.get("attempt") != body.get("attempt") or claim.get("phase") != "sent":
                raise ValueError("This browser does not own the submitted media request")
            if job.status == "completed" and job.result.get("asset_id"):
                return {"accepted": True, **job.result}
            p, state, media = self.validate_job(db, job, body)
            if body.get("download_state") != "complete" or not isinstance(body.get("download_id"), int):
                raise ValueError("Wait until the browser has completed the download")
            raw = Path(str(body.get("path", "")))
            if not raw.is_absolute() or raw.is_symlink():
                raise ValueError("Downloaded media must be a regular absolute file")
            source = raw.resolve()
            # Chrome can use a user-selected default Downloads directory that
            # differs from the Windows Known Folder. Its completed download is
            # authoritative, but the approved subfolder and filename must match.
            if source.parent.name != media["folder"] or not source.is_file():
                raise ValueError("Downloaded media must be in the project's Downloads folder")
            if state["completed"] and source.parent != Path(state["download_path"]).resolve():
                raise ValueError("This batch's download folder changed; do not attach an unrelated file")
            stem = Path(media["filename"]).stem
            if not re.fullmatch(re.escape(stem) + r"(?: \(\d+\))?\.[a-zA-Z0-9]+", source.name):
                raise ValueError("This download does not match the expected audio segment or scene")
            if not 0 < source.stat().st_size <= 2_000_000_000:
                raise ValueError("Media file is empty or exceeds 2 GB")
            kind = MEDIA_KINDS[job.kind]
            config = settings_for(db, db.get(Channel, p.channel_id))
            folder = project_folder(self.root, p.id) / {"image": "images", "video": "videos", "audio": "audio"}[kind]
            temporary = folder / ("download-" + uid() + Path(media["filename"]).suffix)
            try:
                if kind == "image":
                    from PIL import Image, ImageOps
                    with Image.open(source) as im:
                        im.load()
                        picture = ImageOps.exif_transpose(im)
                        picture.save(temporary, format="PNG")
                        info = {"width": picture.width, "height": picture.height}
                else:
                    info = probe(source, config)
                    if info["duration"] <= 0 or not info["has_audio" if kind == "audio" else "has_video"]:
                        raise ValueError("Download has no usable media stream")
                    if kind == "audio":
                        error = narration_download_error(job.prompt, info["duration"], body.get("expected_duration"))
                        if error:
                            raise ValueError(error)
                    if kind == "audio" and info.get("audio_codec") != "pcm_s16le":
                        binary = find_binary("ffmpeg", config)
                        if not binary:
                            raise ValueError("FFmpeg is required to save narration as WAV")
                        run_process([binary, "-v", "error", "-nostdin", "-y", "-protocol_whitelist", "file,pipe", "-i", str(source),
                                     "-vn", "-c:a", "pcm_s16le", str(temporary)], timeout=180)
                        info = probe(temporary, config)
                        error = narration_download_error(job.prompt, info["duration"], body.get("expected_duration"))
                        if error:
                            raise ValueError(error)
                    else:
                        shutil.copyfile(source, temporary)
                sha = hashlib.sha256()
                with temporary.open("rb") as handle:
                    while data := handle.read(1024 * 1024):
                        sha.update(data)
                checksum = sha.hexdigest()
                asset = db.query(Asset).filter_by(project_id=p.id, sha256=checksum, story_version=p.story_version, kind=kind).first()
                if media['target_type'] == 'thumbnail' and media.get('variant_id'):
                    asset = None  # Distinct variant ownership, even when returned pixels coincide.
                if not asset:
                    destination = folder / f"{checksum[:10]}_{media['filename']}"
                    temporary.replace(destination)
                    asset = Asset(project_id=p.id, name=media["filename"], kind=kind, path=str(destination.relative_to(self.root)),
                                  sha256=checksum, size=destination.stat().st_size, duration=info.get("duration"),
                                  metadata_json={**info, "browser_download_id": body["download_id"], "download_path": str(source),
                                                 **({"provider_duration": body["expected_duration"]} if kind == "audio" and body.get("expected_duration") else {})}, story_version=p.story_version)
                    db.add(asset)
                    db.flush()
                if media["target_type"] == "thumbnail":
                    asset.metadata_json = {**asset.metadata_json, 'role':'thumbnail',
                        'thumbnail_variant':media.get('variant_id'), 'thumbnail_plan_hash':media.get('plan_hash'),
                        'thumbnail_image_checks':image_checks(self.root, asset)}
                    plan = current_plan(db, p)
                    if not plan or not media.get('variant_id') or selection(p, plan) == media['variant_id']:
                        assign_thumbnail(p, asset)
                else:
                    target = db.get(Chunk if media["target_type"] == "chunk" else Scene, media["target_id"])
                    first_reference = isinstance(target, Scene) and asset.kind == 'image' and not self.reference_assets(db, p)
                    target.asset_id, target.status, target.story_version = asset.id, "ATTACHED", p.story_version
                    if isinstance(target, Chunk):
                        target.real_duration = asset.duration
                    elif first_reference:
                        # Preserve the first verified scene as the project's default anchor.
                        prior = p.settings.get('character_references', {})
                        if not prior.get('manual') or prior.get('story_version') != p.story_version:
                            p.settings = {**p.settings, 'character_references': {'asset_ids': [asset.id], 'manual': False, 'story_version': p.story_version}}
                p.publish = {**(p.publish or {}), "final_reviewed": False}
                job.result = {"asset_id": asset.id, "download_id": body["download_id"], "filename": media["filename"],
                              **({"duration": asset.duration} if kind == "audio" else {})}
                job.status, job.progress, job.step = "completed", 100, "Đã tạo, tải và gán tài nguyên"
                state = {**state, "completed": state["completed"] + 1, "download_path": str(source.parent)}
                self.advance(db, p, state)
                db.commit()
                if not state.get('current_job_id'):
                    self.workflow.drain_production_queue(p.id)
                return {"accepted": True, **job.result}
            finally:
                temporary.unlink(missing_ok=True)

    def failure(self, id, body):
        """Skip exactly one owned item; never infer success or accept its late file."""
        reason = str(body.get('reason', '')).strip()[:1500]
        if not reason:
            raise ValueError('Provide the browser error for the missing resource')
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            job = db.get(Job, id)
            if not job:
                raise ValueError('Media job not found')
            claim = job.payload.get('_media_claim', {})
            if claim.get('owner') != body.get('owner') or claim.get('attempt') != body.get('attempt'):
                raise ValueError('This browser does not own the media job')
            if body.get('stage') == 'browser_disconnected' and claim.get('last_seen_at') != body.get('last_seen_at'):
                raise ValueError('The browser reconnected; leave the active media job alone')
            if job.status == 'failed' and job.result.get('skipped'):
                return {'accepted': True, **job.result}
            p, state, media = self.validate_job(db, job, body)
            failure = {'job_id': job.id, 'target_type': media['target_type'], 'target_id': media['target_id'],
                       'filename': media['filename'], 'provider': media['provider'], 'reason': reason,
                       'stage': str(body.get('stage', ''))[:80], 'story_version': p.story_version, 'time': now()}
            if media.get('variant_id'):
                failure.update(variant_id=media['variant_id'], plan_hash=media.get('plan_hash'))
            def failure_key(item):
                return (item.get('target_type'), item.get('target_id'), item.get('variant_id'), item.get('plan_hash'))
            previous = [f for f in p.settings.get('resource_failures', []) if failure_key(f) != failure_key(failure)]
            p.settings = {**p.settings, 'resource_failures': [*previous, failure][-250:]}
            job.status, job.step, job.error = 'failed', 'Đã bỏ qua tài nguyên lỗi; xem Tài nguyên để tạo thủ công', reason
            job.result = {'skipped': True, 'missing': failure}
            self.advance(db, p, {**state, 'failed': state.get('failed', 0) + 1})
            db.commit()
        self.workflow.drain_production_queue(p.id)
        return {'accepted': True, **job.result}

    def missing(self, db, p):
        current_failures = [f for f in p.settings.get('resource_failures', []) if f.get('story_version') == p.story_version]
        failures = {f['target_id']: f for f in current_failures if f.get('target_type') != 'thumbnail'}
        result = []
        for model, kind, prefix, ext in ((Chunk, 'audio', 'tts', 'wav'), (Scene, ('image', 'video'), 'scene', 'mp4')):
            for target in db.query(model).filter_by(project_id=p.id).order_by(model.number):
                if target.story_version != p.story_version:
                    continue
                suffix = 'png' if isinstance(target, Scene) and target.visual_type != 'VIDEO' else ext
                valid = self.available(db, target.asset_id, kind, p.story_version)
                if valid and isinstance(target, Chunk):
                    valid = not narration_download_error(target.text, db.get(Asset, target.asset_id).duration)
                if not valid or target.status == 'STALE':
                    result.append({'target_id': target.id, 'target_type': 'chunk' if isinstance(target, Chunk) else 'scene',
                                   'filename': f'{prefix}_{target.number:03}.{suffix}',
                                   'reason': failures.get(target.id, {}).get('reason', 'Chưa gán tài nguyên hợp lệ'),
                                   'automatic_failure': target.id in failures})
        plan = current_plan(db, p)
        images = db.query(Asset).filter_by(project_id=p.id, story_version=p.story_version, kind='image').all()
        for thumbnail in current_failures:
            if thumbnail.get('target_type') != 'thumbnail':
                continue
            if thumbnail.get('variant_id'):
                if not plan or thumbnail.get('plan_hash') != plan_identifier(plan):
                    continue
                available = any((a.metadata_json or {}).get('thumbnail_variant') == thumbnail['variant_id']
                                and (a.metadata_json or {}).get('thumbnail_plan_hash') == thumbnail['plan_hash']
                                and self.available(db, a.id, 'image', p.story_version) for a in images)
            else:
                available = self.available(db, p.publish.get('thumbnail_asset_id'), 'image', p.story_version)
            if not available:
                result.insert(0, {**thumbnail, 'automatic_failure':True})
        return result

    def stop(self, id):
        with self.workflow.deletion_lock, self.database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            p = db.get(Project, id)
            if not p:raise ValueError('Project not found')
            state = {**(p.settings or {}).get("media_automation", {})}
            pending = (p.settings or {}).get('thumbnail_pending_visuals', {})
            preparation = db.get(Job, pending.get('job_id')) if pending else None
            if preparation and preparation.kind == 'thumbnail_plan' and preparation.status in ('queued','running','waiting_user'):
                preparation.status, preparation.step = 'cancelled', 'Thumbnail preparation stopped'
            p.settings = {k:v for k,v in p.settings.items() if k != 'thumbnail_pending_visuals'}
            job = db.get(Job, state.get("current_job_id")) if state.get("current_job_id") else None
            if job and job.status in ("queued", "running", "waiting_user"):
                job.status, job.step = "cancelled", "Đã dừng tự động tạo tài nguyên"
            state.update(phase="cancelled", pending=[], current_job_id=None)
            p.settings = {**(p.settings or {}), "media_automation": state, 'production_queue': []}
            db.commit()
            return self.public(state)
