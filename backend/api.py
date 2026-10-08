from __future__ import annotations

import csv
import difflib
import hashlib
import io
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import zipfile
from contextlib import asynccontextmanager, closing
from datetime import date
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Query, Body
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import desc, func, or_, text as sql_text
from .config import *
from .database import Database
from .deletion import Deletions, DeletionRequest
from .asset_management import delete_assets
from .media_automation import MediaAutomation
from .models import *
from .schemas import ChannelCreate, SourceCreate, ProjectCreate, JobCreate, AnalyticsCreate, StoryDNA
from .intelligence import duration_profile, channel_fit, novelty_check, words, digest, tokens, recommend_duration
from .workflow import Workflow, settings_for, latest, set_draft, gate_lock, lock_story, active_issues
from . import audience
from .channel_learning import learning_data, normalize_snapshot, reminders
from .production_extras import tts_scene_context, thumbnail_prompt, scene_generation_prompt, compose_thumbnail, outro_chunk
from .providers import PROVIDERS, PROVIDER_URLS
from .ai_result import parse_ai_result
from .story_import import imported_bible, validate_import
from . import premise_policy
from .media import find_binary, probe, asset_kind, map_asset, MEDIA_FOLDERS, project_folder, validate_assets, timeline_from_audio, render_options, validate_logo, validate_waveform_video
from .visual_planning import visual_budget
from .portability import project_archive, inspect_database
from .project_storage import migrate_project_folders, project_path
from .resource_cleanup import ResourceCleanup, archived, recover_final_moves
from .youtube_metadata import MetadataInputs, metadata_inputs, metadata_fingerprint, upload_text
from .thumbnail_packaging import (ThumbnailStyle, ImageReview, current_plan, plan_state, variant_prompt,
                                  save_review, assign_thumbnail, export_plan, plan_identifier)
from launcher import updater
import threading


def create_app(data_root: str | Path | None = None):
    root = (Path(data_root) if data_root else default_data_root()).resolve()
    initialize_folders(root)
    staged = root/"restore-pending.db"
    if staged.exists():
        inspect_database(staged)
        current = root/"storyforge.db"
        if current.exists():
            with closing(sqlite3.connect(current)) as source, closing(sqlite3.connect(root/"backups"/f"pre-restore-{uid()}.db")) as target:
                source.backup(target)
        os.replace(staged,current)
        for suffix in ("-wal","-shm"):
            sidecar = root/f"storyforge.db{suffix}"
            if sidecar.exists():
                sidecar.unlink()
    database = Database(root)
    recover_final_moves(database, root)
    migrate_project_folders(database, root)
    workflow = Workflow(database,root)
    media_automation = MediaAutomation(workflow)
    workflow.media_automation = media_automation
    csrf = secrets.token_urlsafe(32)
    deletions = Deletions(database, workflow, csrf)
    resource_cleanup = ResourceCleanup(database, workflow, csrf)
    log_handlers=[]
    for category in ("app","browser_bridge","render","ffmpeg","audit"):
        logger = logging.getLogger(category)
        logger.setLevel(logging.INFO)
        handler = RotatingFileHandler(root/"logs"/f"{category}.log",maxBytes=5_000_000,backupCount=3,encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        log_handlers.append((logger,handler))

    @asynccontextmanager
    async def lifespan(app):
        stop_watchdog=threading.Event()
        def monitor_media():
            while not stop_watchdog.wait(10):
                try:media_automation.check_stalled()
                except Exception:logging.getLogger('app').exception('Media heartbeat check failed')
        monitor=threading.Thread(target=monitor_media,name='storyforge-media-heartbeat',daemon=True)
        monitor.start()
        try:
            yield
        finally:
            stop_watchdog.set();monitor.join(timeout=5)
            workflow.executor.shutdown(wait=True,cancel_futures=True)
            database.engine.dispose()
            for logger,handler in log_handlers:
                logger.removeHandler(handler)
                handler.close()

    app = FastAPI(title="StoryForge US",version=VERSION,lifespan=lifespan,docs_url="/api/docs",openapi_url="/api/openapi.json")
    app.state.database,app.state.workflow,app.state.root = database,workflow,root
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=["127.0.0.1","localhost","testserver"])

    @app.middleware("http")
    async def local_security(request:Request,call_next):
        if request.url.path.startswith("/api"):
            origin = request.headers.get("origin","")
            if request.url.path.startswith("/api/bridge/"):
                with database.session() as db:
                    token = db.get(Setting,"_bridge_token")
                    supplied = request.headers.get("x-bridge-token","")
                    if not token or not secrets.compare_digest(str(token.value),supplied):
                        return JSONResponse({"detail":"Bridge is not paired"},status_code=403)
            else:
                if request.headers.get("sec-fetch-site")=="cross-site":
                    return JSONResponse({"detail":"Cross-site local access is not allowed"},status_code=403)
                if origin and origin not in ("http://127.0.0.1:8787","http://localhost:8787","http://127.0.0.1:5173","http://localhost:5173","http://testserver"):
                    return JSONResponse({"detail":"Origin not allowed"},status_code=403)
                if request.method not in ("GET","HEAD","OPTIONS") and not secrets.compare_digest(request.headers.get("x-storyforge-token",""),csrf):
                    return JSONResponse({"detail":"Refresh the app to renew the local session"},status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
        return response

    @app.exception_handler(ValueError)
    async def value_error(request,exc):
        payload = {"detail": str(exc)}
        if isinstance(exc, audience.RetentionEvidenceError):
            payload['code'] = exc.code
        return JSONResponse(payload,status_code=422)

    def get(db,model,id):
        item = db.get(model,id)
        if not item:
            raise HTTPException(404,"Record not found")
        return item

    @app.get("/api/session")
    def session_info():
        return {"token":csrf,"version":VERSION}

    @app.get("/api/health")
    def health():
        with database.session() as db:
            config = settings_for(db)
            return {"status":"ok","app":"StoryForge US","version":VERSION,"data_root":str(root),"ffmpeg":find_binary("ffmpeg",config),"ffprobe":find_binary("ffprobe",config),"provider_mode":config["provider_mode"]}

    @app.get("/api/dashboard")
    def dashboard():
        with database.session() as db:
            return {"channels":db.query(Channel).count(),"projects":db.query(Project).count(),"sources":db.query(Source).count(),"locked":db.query(Project).filter_by(locked=True).count(),
                    "active_jobs":db.query(Job).filter(Job.status.in_(["queued","running","waiting_user"])).count(),
                    "recent_projects":[serialize(p) for p in db.query(Project).order_by(desc(Project.updated_at)).limit(6).all()],
                    "jobs":[serialize(j) for j in db.query(Job).order_by(desc(Job.created_at)).limit(8).all()],"settings":settings_for(db)}

    @app.get("/api/channels")
    def channels(q:str="",offset:int=0,limit:int=Query(50,ge=1,le=100)):
        with database.session() as db:
            query = db.query(Channel)
            if q:
                query = query.filter(Channel.name.ilike(f"%{q}%"))
            items = []
            for channel in query.order_by(Channel.created_at).offset(max(0,offset)).limit(limit):
                projects = db.query(Project).filter_by(channel_id=channel.id).all()
                items.append({**serialize(channel),"project_count":len(projects),"published_count":sum(bool(p.publish.get("url")) for p in projects),"locked_count":sum(p.locked for p in projects)})
            return {"items":items,"total":query.count()}

    @app.post("/api/channels")
    def create_channel(body:ChannelCreate):
        with database.session() as db:
            data=body.model_dump()
            data["name"]=data["name"].strip()
            if not data["name"]:
                raise ValueError("Channel name is required")
            channel=Channel(**data,dna={"primary_genres":[data["niche"]] if data["niche"] else [],"core_tropes":[],"tone":"Atmospheric, grounded, engaging","narration_style":"Natural American English, warm and measured","avoid_genres":[],"avoid_tropes":[],"allowed_durations":[5,10,20,30,45,60],"content_mix":{"Core":40,"Adjacent":30,"Experimental":20,"Wildcard":10},"audience":{"country":data["country"],"age_range":data["age_range"],"language":data["language"]}})
            db.add(channel);db.flush()
            db.add(DNAVersion(channel_id=channel.id,version=1,dna=channel.dna,note="Channel created"))
            db.commit()
            return serialize(channel)

    @app.get("/api/channels/{id}")
    def channel_detail(id:str):
        with database.session() as db:
            channel=get(db,Channel,id)
            return {**serialize(channel),"projects":[serialize(p) for p in db.query(Project).filter_by(channel_id=id).order_by(desc(Project.updated_at)).limit(100)],
                    "dna_versions":[serialize(v) for v in db.query(DNAVersion).filter_by(channel_id=id).order_by(desc(DNAVersion.created_at)).all()],
                    "discovery":[serialize(a) for a in db.query(Artifact).filter_by(channel_id=id,kind="discovery").order_by(desc(Artifact.created_at)).limit(1)],
                    "sources":[serialize(s) for s in db.query(Source).filter_by(channel_id=id).limit(100)],"learning":learning_data(db,id)}

    @app.patch("/api/channels/{id}")
    def update_channel(id:str,body:dict=Body(...)):
        with database.session() as db:
            channel=get(db,Channel,id)
            merged=ChannelCreate.model_validate({**serialize(channel),**body})
            for key,value in merged.model_dump().items():
                setattr(channel,key,value)
            if "settings" in body:
                if not isinstance(body["settings"],dict):
                    raise ValueError("Channel settings must be an object")
                channel.settings=body["settings"]
            db.commit();return serialize(channel)

    @app.delete("/api/channels/{id}")
    def delete_channel(id:str):
        with database.session() as db:
            channel=get(db,Channel,id)
            if db.query(Project).filter_by(channel_id=id).count():
                raise ValueError("Move or delete this channel's projects first")
            db.delete(channel);db.commit();return {"deleted":True}

    @app.post("/api/channels/{id}/dna")
    def save_dna(id:str,body:dict=Body(...)):
        with database.session() as db:
            channel=get(db,Channel,id)
            dna=body.get("dna")
            if not isinstance(dna,dict):
                raise ValueError("DNA must be a JSON object")
            version=(db.query(func.max(DNAVersion.version)).filter_by(channel_id=id).scalar() or 0)+1
            status=body.get("status","accepted")
            if status not in ("accepted","proposed","testing","rejected"):
                raise ValueError("Invalid DNA decision")
            magnitude=body.get("magnitude","LOW")
            record=DNAVersion(channel_id=id,version=version,dna=dna,note=body.get("note","Manual edit"),magnitude=magnitude,status=status)
            db.add(record)
            if status=="accepted":
                channel.dna=dna
            if body.get("establish") and status=="accepted":
                channel.status="ESTABLISHED"
                channel.niche=", ".join(dna.get("primary_genres",[]))
            db.commit();return serialize(record)

    @app.post("/api/channels/{id}/test-plan")
    def test_plan(id:str,body:dict=Body(...)):
        with database.session() as db:
            get(db,Channel,id)
            count=max(1,min(30,int(body.get("count",5))))
            name=str(body.get("hypothesis","Discovery test"))
            for i in range(count):
                db.add(CalendarEntry(channel_id=id,title=f"{name} · Test {i+1}",target_date=body.get("date",date.today().isoformat()),category="Experimental",duration=float(body.get("duration",10))))
            db.commit();return {"created":count}

    @app.get("/api/sources")
    def sources(q:str="",channel_id:str|None=None,offset:int=0,limit:int=Query(50,ge=1,le=100)):
        with database.session() as db:
            query=db.query(Source)
            if q:query=query.filter(or_(Source.title.ilike(f"%{q}%"),Source.summary.ilike(f"%{q}%")))
            if channel_id:query=query.filter_by(channel_id=channel_id)
            return {"items":[serialize(s) for s in query.order_by(desc(Source.created_at)).offset(max(0,offset)).limit(limit)],"total":query.count()}

    @app.post("/api/sources")
    def create_source(body:SourceCreate):
        with database.session() as db:
            if body.channel_id:get(db,Channel,body.channel_id)
            if body.url and not re.match(r"^https?://",body.url):raise ValueError("Source URL must begin with http:// or https://")
            item=Source(**body.model_dump());db.add(item);db.commit();return serialize(item)

    @app.post("/api/sources/import")
    async def import_sources(file:UploadFile=File(...)):
        data=await file.read(10_000_001)
        if len(data)>10_000_000:raise ValueError("Text import limit is 10 MB")
        text=data.decode("utf-8-sig")
        ext=Path(file.filename or "").suffix.lower()
        rows=list(csv.DictReader(io.StringIO(text))) if ext==".csv" else [{"title":Path(file.filename or "Imported source").stem,"transcript":text}]
        if ext not in (".csv",".txt",".md") or len(rows)>1000:raise ValueError("Use TXT, MD, or CSV with at most 1000 rows")
        output=[]
        with database.session() as db:
            for row in rows:
                row={k:v for k,v in row.items() if k in SourceCreate.model_fields and v is not None}
                if isinstance(row.get("tags"),str):row["tags"]=[s.strip() for s in row["tags"].split(",") if s.strip()]
                row["title"]=row.get("title") or row.get("url") or "Imported source"
                if not row.get("channel_id"):row["channel_id"]=None
                model=SourceCreate.model_validate(row)
                if model.channel_id:get(db,Channel,model.channel_id)
                item=Source(**model.model_dump());db.add(item);db.flush();output.append(serialize(item))
            db.commit()
        return {"items":output,"count":len(output)}

    @app.get("/api/sources/{id}")
    def source_detail(id:str):
        with database.session() as db:
            source=get(db,Source,id)
            return {**serialize(source),"fits":sorted([channel_fit(source.dna,serialize(c),[serialize(n) for n in db.query(Novelty).filter_by(channel_id=c.id).all()],[serialize(e) for e in db.query(CalendarEntry).filter_by(channel_id=c.id).all()]) for c in db.query(Channel).all()],key=lambda f:-f["score"]) if source.dna else []}

    @app.patch("/api/sources/{id}")
    def update_source(id:str,body:dict=Body(...)):
        with database.session() as db:
            source=get(db,Source,id)
            merged=SourceCreate.model_validate({**serialize(source),**body})
            if merged.channel_id:get(db,Channel,merged.channel_id)
            for key,value in merged.model_dump().items():setattr(source,key,value)
            if "dna" in body:
                source.dna=StoryDNA.model_validate(body["dna"]).model_dump();source.status="ANALYZED"
            if "status" in body and body["status"] in ("INBOX","ASSIGNED","ANALYZED"):source.status=body["status"]
            db.commit();return serialize(source)

    @app.delete("/api/sources/{id}")
    def delete_source(id:str, confirmation:str=""):
        return deletions.confirm(DeletionRequest(kind="sources", ids=[id], confirmation=confirmation))

    @app.post("/api/deletions/preview")
    def preview_deletion(body:DeletionRequest):
        return deletions.preview(body)

    @app.post("/api/deletions/confirm")
    def confirm_deletion(body:DeletionRequest):
        return deletions.confirm(body)

    @app.get("/api/duration")
    def duration(minutes:float=10,wpm:int=150):return duration_profile(minutes,wpm)

    @app.get("/api/projects")
    def projects(channel_id:str|None=None,q:str="",offset:int=0,limit:int=Query(50,ge=1,le=100)):
        with database.session() as db:
            query=db.query(Project)
            if channel_id:query=query.filter_by(channel_id=channel_id)
            if q:query=query.filter(Project.title.ilike(f"%{q}%"))
            return {"items":[serialize(p) for p in query.order_by(desc(Project.updated_at)).offset(max(0,offset)).limit(limit)],"total":query.count()}

    @app.post("/api/projects")
    def create_project(body:ProjectCreate):
        with database.session() as db:
            channel=get(db,Channel,body.channel_id)
            if body.source_id:get(db,Source,body.source_id)
            data=body.model_dump()
            entry_mode=data.pop('entry_mode')
            if entry_mode=='existing_bible' and body.source_id:
                raise ValueError('Choose an existing Bible or a source inspiration, not both')
            if body.duration_mode=="Auto":data["target_minutes"]=channel.default_duration
            item=Project(**data, stage='BIBLE' if entry_mode=='existing_bible' else 'DIRECTION',
                         settings={'audience_policy': 1, 'entry_mode':entry_mode});db.add(item);db.commit()
            migrate_project_folders(database, root, [item.id])
            project_folder(root,item.id)
            return serialize(item)

    @app.get("/api/projects/{id}")
    def project_detail(id:str):
        with database.session() as db:
            p=get(db,Project,id)
            config=settings_for(db,db.get(Channel,p.channel_id))
            artifacts={}
            for a in db.query(Artifact).filter_by(project_id=id).order_by(Artifact.created_at).all():artifacts[a.kind]=serialize(a)
            chunks=[serialize(v) for v in db.query(Chunk).filter_by(project_id=id).order_by(Chunk.number)]
            scenes=[serialize(v) for v in db.query(Scene).filter_by(project_id=id).order_by(Scene.number)]
            for scene in scenes:
                scene['scene_key']=f"scene_{scene['number']:03}"
                scene['generation_prompt']=scene_generation_prompt(scene)
            assets=[serialize(v) for v in db.query(Asset).filter_by(project_id=id).order_by(desc(Asset.created_at))]
            try:render_timeline=timeline_from_audio(chunks,scenes,assets,render_options(serialize(p))['ending_asset_id'])
            except ValueError as exc:render_timeline={'error':str(exc)}
            channel=serialize(db.get(Channel,p.channel_id))
            start=0
            for chunk in chunks:
                chunk['scene_context']=tts_scene_context(chunk,serialize(p),channel,scenes,start)
                start+=chunk['word_count']
            return {**serialize(p),"storage_folder":str(project_path(root,id)),"channel":serialize(db.get(Channel,p.channel_id)),"source":serialize(db.get(Source,p.source_id)) if p.source_id else None,
                    "thumbnail_prompt":media_automation.thumbnail(db,p,scenes),
                    "thumbnail_packaging":plan_state(db,p),
                    "visual_budget":visual_budget(serialize(p),config),
                    "youtube_metadata_current":bool(artifacts.get('youtube_metadata') and artifacts['youtube_metadata']['content'].get('content_fingerprint')==metadata_fingerprint(db,p)),
                    "workflow_settings":{key:config[key] for key in ("pipeline_mode","default_premise_count")},
                    "premise_reuse":workflow.premise_reuse(db,p),
                    "premise_pool":workflow.premise_pool(db,p),
                    "audience_readiness":audience.readiness(db,p,gate_lock(db,p,include_audience=False)['can_lock']),
                    "missing_resources":media_automation.missing(db,p),
                    "artifacts":artifacts,"premises":[premise_policy.record(v) for v in premise_policy.ordered(db,id)],
                    "issues":[serialize(v) for v in db.query(Issue).filter_by(project_id=id).order_by(desc(Issue.cycle))],
                    "versions":[serialize(v) for v in db.query(StoryVersion).filter_by(project_id=id).order_by(desc(StoryVersion.version))],
                    "chunks":chunks,
                    "scenes":scenes,
                    "assets":assets,"render_timeline":render_timeline,
                    "jobs":[serialize(v) for v in db.query(Job).filter_by(project_id=id).order_by(desc(Job.created_at)).limit(50)],
                    "lock_gate":gate_lock(db,p),"next":workflow.next_step(db,p),"profile":duration_profile(p.target_minutes,p.wpm),"word_count":len(words(p.draft)),"auto_duration":recommend_duration({})}

    @app.post("/api/projects/{id}/outro")
    def add_outro(id:str):
        with database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            p=get(db,Project,id)
            if not p.locked:raise ValueError('Story Lock is required')
            if db.query(Job).filter(Job.project_id==id,Job.status.in_(['queued','running','waiting_user'])).count():raise ValueError('Finish the active job first')
            chunks=db.query(Chunk).filter_by(project_id=id).order_by(Chunk.number).all()
            if not chunks:raise ValueError('Generate TTS chunks')
            if any((c.voice_profile or {}).get('segment_role')=='outro' for c in chunks):return {'added':False}
            c=chunks[-1]; channel=get(db,Channel,p.channel_id)
            db.add(Chunk(project_id=id,story_version=p.story_version,**outro_chunk(c.number+1,c.voice_profile,channel.language,p.wpm,c.text)))
            # New audio changes the timeline; old media stays attached.
            for scene in db.query(Scene).filter_by(project_id=id):scene.duration=0
            db.query(Artifact).filter_by(project_id=id,kind='render_report').update({'story_version':0})
            db.commit();return {'added':True}

    @app.post("/api/projects/{id}/thumbnail")
    def create_thumbnail(id:str,body:dict=Body(...)):
        with database.session() as db:
            p=get(db,Project,id);asset=get(db,Asset,str(body.get('asset_id','')))
            if archived(p):raise ValueError('Reopen resource production before creating new media.')
            if asset.project_id!=id or asset.kind!='image':raise ValueError('Choose an image from this project')
            title=p.publish.get('title') or p.title
            folder=project_folder(root,id)/'images'
            output=folder/f'thumbnail-{uid()}.jpg'
            compose_thumbnail(safe_path(root,asset.path),output,title)
            a=Asset(project_id=id,name='thumbnail.jpg',path=str(output.relative_to(root)),kind='image',
                    sha256=hashlib.sha256(output.read_bytes()).hexdigest(),size=output.stat().st_size,
                    metadata_json={'width':1280,'height':720,'role':'thumbnail','source_asset_id':asset.id,'title':title},story_version=p.story_version)
            db.add(a);db.flush();p.publish={**p.publish,'thumbnail_asset_id':a.id};db.commit()
            return serialize(a)

    @app.patch("/api/projects/{id}")
    def update_project(id:str,body:dict=Body(...)):
        with workflow.deletion_lock, database.session() as db:
            p=get(db,Project,id)
            if 'title' in body and p.title != body['title'] and (db.query(Job).filter(Job.project_id==id,Job.status.in_(['queued','running'])).count() or any(db.get(Job,j) and db.get(Job,j).project_id==id for j in workflow.active_jobs)):
                raise ValueError('Finish the active project job before changing the storage title.')
            if "draft" in body:result=set_draft(db,p,body["draft"])
            else:result={}
            for key in ("title","publish"):
                if key in body:setattr(p,key,body[key])
            if any(k in body for k in ("target_minutes","wpm","duration_mode")):
                if p.locked:raise ValueError("Create a new draft version before changing locked production settings")
                data=ProjectCreate.model_validate({**serialize(p),**body})
                p.target_minutes,p.wpm,p.duration_mode=data.target_minutes,data.wpm,data.duration_mode
            db.commit()
            result={**serialize(p),"change":result}
            if 'title' in body:
                migrate_project_folders(database,root,[id])
        return result

    @app.get('/api/projects/{id}/resources/cleanup-preview')
    def preview_resource_cleanup(id:str):
        return resource_cleanup.preview(id)

    @app.post('/api/projects/{id}/resources/cleanup')
    def clean_project_resources(id:str,body:dict=Body(...)):
        return resource_cleanup.confirm(id,body.get('confirmation'))

    @app.post('/api/projects/{id}/resources/resume')
    def resume_project_resources(id:str):
        return resource_cleanup.resume(id)

    @app.post("/api/projects/{id}/select-premise")
    def select_premise(id:str,body:dict=Body(...)):
        return workflow.select_premise(id,body.get("premise_id"))

    @app.post('/api/projects/{id}/story-bible/import')
    def import_bible(id:str, body:dict=Body(...)):
        content=validate_import(body.get('content'))
        with workflow.deletion_lock, database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            p=get(db,Project,id)
            if not imported_bible(p):raise ValueError('Use a project created with Already have a Story Bible')
            if p.locked or p.draft or latest(db,id,'outline') or latest(db,id,'outline_rewrite'):
                raise ValueError('Import the Bible before creating the outline. Start a new project for a different Bible.')
            if db.query(Job).filter(Job.project_id==id,Job.status.in_(['queued','running','waiting_user'])).count():
                raise ValueError('Finish or cancel active jobs before importing a Bible')
            previous=latest(db,id,'story_bible')
            checksum=digest(content)
            if previous and previous.output_hash==checksum:return serialize(previous)
            item=Artifact(project_id=id,kind='story_bible',provider='manual_import',content=content,
                          raw_result=json.dumps(content,ensure_ascii=False),template_version='import-1.0',
                          inputs_hash=previous.output_hash if previous else None,output_hash=checksum,story_version=p.story_version)
            db.add(item);p.stage='OUTLINE';db.commit();return serialize(item)

    @app.post('/api/projects/{id}/story-bible/validate')
    def validate_bible(id:str, body:dict=Body(...)):
        with database.session() as db:
            if not imported_bible(get(db,Project,id)):raise ValueError('Use a project created with Already have a Story Bible')
        return {'valid':True,'content':validate_import(body.get('content'))}

    @app.post("/api/projects/{id}/lock")
    def lock(id:str,body:dict|None=Body(default=None)):
        start_tts=False;chunk_needed=False;browser_mode=False
        with workflow.deletion_lock, database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            p=get(db,Project,id)
            already_locked=p.locked
            result=lock_story(db,p,body)
            config=settings_for(db,db.get(Channel,p.channel_id))
            start_tts=not already_locked and config['pipeline_mode']=='auto'
            chunk_needed=workflow.next_step(db,p).get('kind')=='chunk_tts'
            browser_mode=config['provider_mode']=='browser'
            db.commit()
        if start_tts and chunk_needed:
            workflow.submit('chunk_tts',project_id=id,payload={'auto_continue':True})
        elif start_tts and browser_mode:
            media_automation.start(id,{'kind':'tts'})
        return result

    @app.post('/api/projects/{id}/opening-choice')
    def choose_opening(id:str, body:dict=Body(...)):
        with database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            p=get(db,Project,id)
            if p.locked or db.query(Job).filter(Job.project_id==id,Job.status.in_(['queued','running','waiting_user'])).count():
                raise ValueError('Choose an opening before locking or starting another project job')
            report=latest(db,id,'opening_variants')
            if not report:raise ValueError('Compare opening variants first')
            choice=next((v for v in report.content['variants'] if v['id']==body.get('id')),None)
            if not choice:raise ValueError('Choose opening A, B or C')
            db.add(Artifact(project_id=id,kind='opening_choice',provider='human',content={**choice,'selection_source':'Human choice'},output_hash=digest(choice),story_version=p.story_version))
            db.commit();return choice

    @app.patch("/api/artifacts/{id}")
    def edit_artifact(id:str,body:dict=Body(...)):
        with database.session() as db:
            original=get(db,Artifact,id)
            if original.kind not in ("content_direction","story_bible","outline","outline_rewrite"):
                raise ValueError("This artifact is not manually editable")
            if not isinstance(body.get("content"),dict):raise ValueError("Content must be a JSON object")
            p=get(db,Project,original.project_id)
            dummy=Job(kind=original.kind,project_id=p.id,payload={})
            workflow.apply_output(db,dummy,p,body["content"])
            p.locked=False
            item=Artifact(project_id=p.id,kind=original.kind,provider="manual",content=body["content"],raw_result=json.dumps(body["content"]),template_version="manual",inputs_hash=original.output_hash,output_hash=digest(body["content"]),story_version=p.story_version)
            db.add(item);db.commit();return serialize(item)

    @app.post("/api/projects/{id}/pipeline")
    def pipeline(id:str):
        with database.session() as db:
            selected = get(db,Project,id).selected_premise_id
            obsolete = db.query(Job).filter(Job.project_id==id,Job.kind=="premise_mini_test",Job.status.in_(["queued","running","waiting_user"])).count()
        if selected and obsolete:
            workflow.select_premise(id,selected)
            with database.session() as db:
                active = db.query(Job).filter(Job.project_id==id,Job.status.in_(["queued","running","waiting_user"])).first()
                if active:return serialize(active)
            # Selection already continued up to the configured human checkpoint.
            with database.session() as db:return workflow.next_step(db,get(db,Project,id))
        with database.session() as db:
            p=get(db,Project,id)
            config=settings_for(db,db.get(Channel,p.channel_id))
            workflow.auto_choose_premise(db,p,config)
            db.commit()
            next_action=workflow.next_step(db,p)
            if not p.locked and next_action.get('gate',{}).get('can_lock') and config['pipeline_mode']!='auto':
                lock_story(db,p);db.commit();next_action=workflow.next_step(db,p)
            auto_continue=config["pipeline_mode"]!="manual"
        if "kind" not in next_action:return next_action
        return workflow.submit(next_action["kind"],project_id=id,payload={"auto_continue":auto_continue})

    @app.post("/api/issues/{id}/resolve")
    def human_resolve(id:str,body:dict=Body(...)):
        with database.session() as db:
            issue=get(db,Issue,id)
            status=body.get("status")
            if status not in ("CONFIRMED","REJECTED","WITHDRAWN"):raise ValueError("Choose confirmed, rejected or withdrawn")
            if len(body.get("reason","").strip())<5:raise ValueError("Provide a concrete review reason")
            issue.final_status=status;issue.resolution="Human review: "+body["reason"]
            db.commit();return serialize(issue)

    @app.get("/api/jobs")
    def jobs(offset:int=0,limit:int=Query(50,ge=1,le=100)):
        with database.session() as db:return {"items":[serialize(j) for j in db.query(Job).order_by(desc(Job.created_at)).offset(max(0,offset)).limit(limit)],"total":db.query(Job).count()}

    @app.post("/api/jobs")
    def create_job(body:JobCreate):return workflow.submit(**body.model_dump())

    @app.post("/api/jobs/{id}/result")
    def paste_result(id:str,body:dict=Body(...)):
        result=body.get("result",body)
        if isinstance(result,str):
            result=parse_ai_result(result)
        workflow.complete_ai(id,result)
        logging.getLogger("browser_bridge").info("Job %s: result accepted via manual paste",id)
        return {"accepted":True}

    @app.post("/api/jobs/{id}/complete-resources")
    def complete_resources(id:str):
        return workflow.complete_manual_tts(id)

    @app.post("/api/jobs/{id}/{action}")
    def job_action(id:str,action:str):
        if action not in ("retry","resume","cancel"):raise HTTPException(404)
        with database.session() as db:
            job=get(db,Job,id)
            if job.status=="completed":raise ValueError("Completed jobs cannot be restarted; create a new job")
            automatic_media=bool(job.payload.get('_media'))
            media_project=job.project_id
            if automatic_media and action!='cancel':
                raise ValueError('Use Browser Bridge to resume an existing media download. Skipped resources must be created manually; see Assets')
            if automatic_media and (job.status not in ('queued','running','waiting_user') or db.get(Project,media_project).settings.get('media_automation',{}).get('current_job_id')!=job.id):
                raise ValueError('This media item is no longer active; see Assets for missing resources')
            if action=="cancel":job.status="cancelled";job.step="Cancelled by user"
            else:
                if job.status=="running":raise ValueError("This job is already running")
                job.status="queued";job.error=""
                if action=="retry":job.payload={k:v for k,v in job.payload.items() if k!="_bridge_retry"}
            db.commit()
        if automatic_media and action=='cancel':media_automation.stop(media_project)
        if action!="cancel":workflow.executor.submit(workflow.run,id)
        return {"status":"cancelled" if action=="cancel" else "queued"}

    @app.patch('/api/projects/{id}/visual-options')
    def update_visual_options(id:str, body:dict=Body(...)):
        with workflow.deletion_lock, database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            p=get(db,Project,id)
            active=db.query(Job).filter(Job.project_id==id,Job.status.in_(['queued','running','waiting_user'])).all()
            if active and not workflow.tts_active(active):
                raise HTTPException(409,'Finish the active job first')
            if set(body)-{'mode','image_count','video_count'}:raise ValueError('Unknown visual option')
            options={**((p.settings or {}).get('visual_options') or {}),**body}
            budget=visual_budget({**serialize(p),'settings':{**(p.settings or {}),'visual_options':options}},settings_for(db,db.get(Channel,p.channel_id)))
            p.settings={**(p.settings or {}),'visual_options':{key:budget[key] for key in ('mode','image_count','video_count')}}
            db.commit()
            return budget

    @app.patch("/api/projects/{id}/render-options")
    def update_render_options(id:str, body:dict=Body(...)):
        with workflow.deletion_lock, database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            p=get(db,Project,id)
            if db.query(Job).filter(Job.project_id==id, or_(Job.status.in_(['queued','running']),Job.id.in_(workflow.active_jobs))).count():
                raise HTTPException(409, 'Wait for running jobs before changing render options')
            options={"subtitles":True,"waveform":False,"overlay":False,"logo_asset_id":None,"ending_asset_id":None,"waveform_asset_id":None,**((p.settings or {}).get('render_options') or {})}
            if set(body)-set(options):raise ValueError('Unknown render option')
            for key in ('subtitles','waveform','overlay'):
                if key in body and not isinstance(body[key],bool):raise ValueError('Render options must be boolean')
            options.update(body)
            if options['subtitles'] and options['waveform']:raise ValueError('Choose subtitles or waveform, not both')
            if options['waveform_asset_id']:
                wave=get(db,Asset,options['waveform_asset_id'])
                if wave.project_id!=id or wave.kind!='video':raise ValueError('Choose a green-screen video from this project')
                if options['waveform']:
                    if not safe_path(root,wave.path).is_file():raise ValueError('Choose an available green-screen video or turn off waveform')
                    validate_waveform_video(safe_path(root,wave.path),settings_for(db,db.get(Channel,p.channel_id)))
            if options['waveform'] and not options['waveform_asset_id']:raise ValueError('Choose a green-screen video first')
            if options['logo_asset_id']:
                asset=get(db,Asset,options['logo_asset_id'])
                if asset.project_id!=id or asset.kind!='image':raise ValueError('Choose a logo image from this project')
                if not safe_path(root,asset.path).is_file():raise ValueError('Logo file is missing')
                if options['overlay']:validate_logo(safe_path(root,asset.path),settings_for(db,db.get(Channel,p.channel_id)))
            if options['ending_asset_id']:
                ending=get(db,Asset,options['ending_asset_id'])
                if ending.project_id!=id or ending.kind!='image':raise ValueError('Choose an ending thumbnail from this project')
            if options['overlay'] and not options['logo_asset_id']:raise ValueError('Choose a logo image first')
            p.settings={**(p.settings or {}),'render_options':options}
            p.publish={**(p.publish or {}),'final_reviewed':False}
            db.commit()
            return options

    @app.post("/api/projects/{id}/assets/delete")
    def remove_assets(id:str, body:dict=Body(...)):
        return delete_assets(database,workflow,id,body.get('ids'))

    @app.post("/api/projects/{id}/assets")
    async def upload_assets(id:str,files:list[UploadFile]=File(...)):
        items=[]
        with database.session() as db:
            p=get(db,Project,id);config=settings_for(db)
            if archived(p):
                raise ValueError('Resources were cleaned. Choose Recreate resources in Overview before importing or generating media.')
            folder=project_folder(root,id)

            for upload in files:
                name=re.sub(r"[^\w.\- ]","_",Path((upload.filename or "asset").replace("\\","/")).name)[:180]
                kind=asset_kind(name)
                temporary=folder/MEDIA_FOLDERS[kind]/f"upload-{uid()}{Path(name).suffix.lower()}"
                size=0;sha=hashlib.sha256()
                try:
                    with temporary.open("wb") as out:
                        while data:=await upload.read(1024*1024):
                            size+=len(data)
                            if size>2_000_000_000:raise ValueError("Maximum asset size is 2 GB")
                            sha.update(data);out.write(data)
                    checksum=sha.hexdigest()
                    existing=db.query(Asset).filter_by(project_id=id,sha256=checksum).first()
                    if existing:
                        items.append({**serialize(existing),"duplicate":True});temporary.unlink();continue
                    info={}
                    if kind=="image":
                        from PIL import Image
                        with Image.open(temporary) as im:
                            im.verify()
                        with Image.open(temporary) as im:info={"width":im.width,"height":im.height}
                    else:
                        info=probe(temporary,config)
                        if info["duration"]<=0:raise ValueError("Asset has zero duration")
                        if kind in ("audio","music","ambient","sfx") and not info["has_audio"]:raise ValueError("File has no audio stream")
                        if kind=="video" and not info["has_video"]:raise ValueError("File has no video stream")
                    destination=temporary.parent/f"{checksum[:10]}_{name}"
                    temporary.replace(destination)
                    asset=Asset(project_id=id,name=name,path=str(destination.relative_to(root)),kind=kind,sha256=checksum,size=size,duration=info.get("duration"),metadata_json=info,story_version=p.story_version)
                    db.add(asset);db.flush()
                    target,number=map_asset(name)
                    if target=="tts" and kind=="audio":
                        chunk=db.query(Chunk).filter_by(project_id=id,number=number).first()
                        if chunk:chunk.asset_id=asset.id;chunk.status="ATTACHED";chunk.real_duration=asset.duration;chunk.story_version=p.story_version
                    if target=="scene" and kind in ("image","video"):
                        scene=db.query(Scene).filter_by(project_id=id,number=number).first()
                        if scene:
                            if kind=="image" and scene.visual_type=="VIDEO":scene.fallback_asset_id=asset.id
                            else:scene.asset_id=asset.id
                            scene.status="ATTACHED";scene.story_version=p.story_version
                    items.append(serialize(asset))
                    p.publish={**(p.publish or {}),'final_reviewed':False}
                except Exception:
                    if temporary.exists():temporary.unlink()
                    raise
            db.commit()
        return {"items":items}

    @app.patch("/api/assets/{id}")
    def remap_asset(id:str,body:dict=Body(...)):
        with database.session() as db:
            asset=get(db,Asset,id)
            if "offset" in body or "volume_db" in body:
                asset.metadata_json={**asset.metadata_json,**{k:float(body[k]) for k in ("offset","volume_db") if k in body}}
            if body.get("target_id"):
                model=Chunk if body.get("target_type")=="tts" else Scene
                target=get(db,model,body["target_id"])
                if target.project_id!=asset.project_id:raise ValueError("Asset belongs to another project")
                if model is Chunk and asset.kind!="audio":raise ValueError("TTS requires narration audio")
                if model is Scene and asset.kind not in ("image","video"):raise ValueError("Scene requires image or video")
                if body.get("fallback"):
                    if model is not Scene or asset.kind!="image":raise ValueError("Fallback must be an image for a visual scene")
                    target.fallback_asset_id=asset.id
                else:target.asset_id=asset.id
                target.status="ATTACHED"
                project=get(db,Project,asset.project_id)
                target.story_version=project.story_version
                project.publish={**(project.publish or {}),'final_reviewed':False}
                if model is Chunk:target.real_duration=asset.duration
            db.commit();return serialize(asset)

    @app.get("/api/assets/{id}/file")
    def asset_file(id:str):
        with database.session() as db:
            asset=get(db,Asset,id);path=safe_path(root,asset.path)
            if not path.is_file():raise HTTPException(404)
            return FileResponse(path)

    @app.get("/api/projects/{id}/validate")
    def validation(id:str):
        with database.session() as db:
            p=get(db,Project,id)
            chunks=[serialize(c) for c in db.query(Chunk).filter_by(project_id=id)]
            scenes=[serialize(s) for s in db.query(Scene).filter_by(project_id=id)]
            assets=[serialize(a) for a in db.query(Asset).filter_by(project_id=id)]
            config=settings_for(db,db.get(Channel,p.channel_id))
            result=validate_assets(chunks,scenes,assets,root,p.story_version,config['allow_visual_fallback'])
            if result['valid']:
                try:
                    options=render_options(serialize(p))
                    timeline=timeline_from_audio(chunks,scenes,assets,options['ending_asset_id'])
                    for row in timeline['scenes']:
                        if row.get('ending_thumbnail'):
                            ending=next(a for a in assets if a['id']==row['asset_id'])
                            if not safe_path(root,ending['path']).is_file():raise ValueError('Ending thumbnail file is missing')
                    if options['overlay']:
                        logo=next((a for a in assets if a['id']==options['logo_asset_id']),None)
                        if not logo or not safe_path(root,logo['path']).is_file():raise ValueError('Choose an available logo image or turn off overlay')
                        validate_logo(safe_path(root,logo['path']),config)
                    if options['waveform']:
                        wave=next((a for a in assets if a['id']==options['waveform_asset_id']),None)
                        if not wave or wave['kind']!='video' or not safe_path(root,wave['path']).is_file():raise ValueError('Choose an available green-screen video or turn off waveform')
                        validate_waveform_video(safe_path(root,wave['path']),config)
                except ValueError as exc:
                    result['valid']=False;result['missing'].append(str(exc))
            return result

    @app.post("/api/projects/{id}/download-final")
    def download_final(id:str):
        from .final_download import save_final
        return save_final(workflow, id)

    @app.get('/api/projects/{id}/thumbnail-packaging')
    def thumbnail_packaging_state(id: str):
        with database.session() as db:
            return plan_state(db, get(db, Project, id))

    @app.patch('/api/projects/{id}/thumbnail-style')
    def thumbnail_style(id: str, body: ThumbnailStyle):
        with workflow.deletion_lock, database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            project = get(db, Project, id)
            active = db.query(Job).join(Project, Job.project_id==Project.id).filter(Project.channel_id==project.channel_id, Job.status.in_(['queued','running','waiting_user'])).all()
            if any(j.kind=='thumbnail_plan' or j.payload.get('_media', {}).get('target_type')=='thumbnail' for j in active):
                raise ValueError('Finish or stop thumbnail creation in this channel before changing its settings')
            channel = get(db, Channel, project.channel_id)
            channel.settings = {**(channel.settings or {}), 'thumbnail_style':body.model_dump()}
            db.commit()
            return body.model_dump()

    @app.post('/api/projects/{id}/thumbnail-select')
    def select_thumbnail(id: str, body: dict=Body(...)):
        with workflow.deletion_lock, database.session() as db:
            db.execute(sql_text('BEGIN IMMEDIATE'))
            project = get(db, Project, id)
            plan = current_plan(db, project)
            variant = body.get('variant')
            if not plan or body.get('plan_hash') != plan_identifier(plan) or variant not in ('A','B','C'):
                raise ValueError('Choose a variant from the current thumbnail plan')
            if db.query(Job).filter(Job.project_id==id, Job.status.in_(['queued','running','waiting_user'])).count():
                raise ValueError('Finish or stop the active resource queue before changing its thumbnail')
            project.settings = {**(project.settings or {}), 'thumbnail_selection': {'variant':variant, 'plan_hash':body['plan_hash']}}
            if body.get('asset_id'):
                asset = get(db, Asset, body['asset_id'])
                if asset.project_id != id or asset.kind != 'image' or asset.story_version != project.story_version or asset.metadata_json.get('thumbnail_variant') != variant or asset.metadata_json.get('thumbnail_plan_hash') != body['plan_hash']:
                    raise ValueError('The image does not belong to this thumbnail variant')
                if not safe_path(root, asset.path).is_file():
                    raise ValueError('The thumbnail file is missing')
                assign_thumbnail(project, asset)
            db.commit()
            return plan_state(db, project)

    @app.post('/api/projects/{id}/thumbnail-review/{asset_id}')
    def review_thumbnail(id: str, asset_id: str, body: ImageReview):
        with database.session() as db:
            result = save_review(db, root, get(db, Project, id), get(db, Asset, asset_id), body)
            db.commit()
            return result

    @app.get('/api/assets/{id}/thumbnail-preview')
    def thumbnail_preview(id: str):
        import io
        from PIL import Image, ImageOps
        with database.session() as db:
            asset = get(db, Asset, id)
            if asset.kind != 'image':raise ValueError('Choose an image thumbnail')
            path = safe_path(root, asset.path)
            if not path.is_file():raise HTTPException(404, 'Thumbnail file is missing')
            with Image.open(path) as original:
                picture = ImageOps.exif_transpose(original).convert('RGB')
                picture.thumbnail((320,180))
                output = io.BytesIO();picture.save(output, 'JPEG', quality=92)
            return Response(output.getvalue(), media_type='image/jpeg', headers={'Cache-Control':'no-store'})

    @app.get("/api/projects/{id}/metadata-settings")
    def get_metadata_settings(id: str):
        with database.session() as db:
            project = get(db, Project, id)
            return metadata_inputs(project, get(db, Channel, project.channel_id))

    @app.patch("/api/projects/{id}/metadata-settings")
    def save_metadata_settings(id: str, body: MetadataInputs):
        with database.session() as db:
            project = get(db, Project, id)
            channel = get(db, Channel, project.channel_id)
            # A scoped transaction preserves all production, Bridge and publishing settings.
            channel.settings = {**(channel.settings or {}), 'youtube_metadata': body.channel_preferences.model_dump()}
            project.settings = {**(project.settings or {}), 'youtube_metadata': {
                **(project.settings or {}).get('youtube_metadata', {}), 'thumbnail_text': body.thumbnail_text,
                'thumbnail_story_version': project.story_version, 'thumbnail_asset_id':project.publish.get('thumbnail_asset_id')}}
            db.commit()
            return metadata_inputs(project, channel)

    @app.get("/api/projects/{id}/download/{name}")
    def download_output(id:str,name:str):
        with database.session() as db:
            p=get(db,Project,id)
            folder=project_path(root,id)
            if name == 'thumbnail_plan.json':
                plan = latest(db,id,'thumbnail_plan')
                if not plan:raise HTTPException(404,'Create thumbnail concepts first')
                state = plan_state(db,p)
                content = export_plan({**plan.content, 'current':state['current'], 'selected_variant':state['selected_variant'],
                                       'images':state['assets'], 'generation_prompts':state['generation_prompts']})
                return Response(content.encode('utf-8'), media_type='application/json', headers={'Content-Disposition':'attachment; filename="thumbnail_plan.json"','Cache-Control':'no-store'})
            if name == 'youtube_metadata.txt':
                metadata=latest(db,id,'youtube_metadata')
                if not metadata:raise HTTPException(404,'Generate YouTube metadata first')
                content=upload_text(metadata.content,p.title,metadata.story_version)
                if metadata.content.get('content_fingerprint')!=metadata_fingerprint(db,p):
                    content='WARNING: This metadata refers to earlier content. Regenerate before uploading.\n\n'+content
                return Response(content.encode('utf-8-sig'),media_type='text/plain; charset=utf-8',headers={'Content-Disposition':'attachment; filename="youtube_metadata.txt"','Cache-Control':'no-store'})
            allowed={"final_video.mp4","final_audio.wav","master_narration.wav","captions.srt","captions.vtt","timeline.csv","render_report.json","thumbnail_prompt.txt"}
            if name not in allowed:raise HTTPException(404)
            report=latest(db,id,"render_report")
            render_folder=folder/"render"/f"v{p.story_version}"
            if report and report.content.get("story_version")==p.story_version and report.content.get("file"):
                render_folder=safe_path(root,report.content["file"]).parent
            path=render_folder/name
            if not path.exists() and name.startswith("captions."):path=folder/"subtitles"/name
            if not path.is_file():raise HTTPException(404,"Output not generated yet")
            return FileResponse(path,filename=name,headers={"Cache-Control":"no-store"})

    @app.get("/api/projects/{id}/export")
    def export_project(id:str,media:bool=False,capcut:bool=False):
        if capcut:
            raise HTTPException(410, 'Use Export CapCut project on the Publish page')
        with database.session() as db:
            output=project_archive(db,root,get(db,Project,id),media)
            return FileResponse(output,filename=output.name)

    @app.get("/api/capcut")
    def capcut_location():
        from .capcut import default_drafts_folder
        return {'drafts_folder': default_drafts_folder(), 'schema': 'CapCut International 9.5 Windows'}

    @app.post("/api/projects/{id}/export-capcut")
    def export_capcut(id:str,body:dict=Body(...)):
        from .capcut import drafts_folder
        destination = drafts_folder(str(body.get('drafts_folder', '')))
        return workflow.submit('capcut_export', project_id=id,
                               payload={'drafts_folder': str(destination), 'auto_continue': False})

    @app.get("/api/jobs/{id}")
    def job_detail(id:str):
        with database.session() as db:
            return serialize(get(db,Job,id))

    @app.get("/api/channels/{id}/export")
    def export_channel(id:str):
        with database.session() as db:
            c=get(db,Channel,id)
            output=root/"exports"/f"channel-{id}.zip"
            with zipfile.ZipFile(output,"w",zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("channel.json",json.dumps(serialize(c),ensure_ascii=False,indent=2))
                for p in db.query(Project).filter_by(channel_id=id):
                    project_file=project_archive(db,root,p)
                    archive.write(project_file,project_file.name)
            return FileResponse(output,filename=output.name)

    @app.get('/api/analytics/reminders')
    def analytics_reminders(channel_id:str|None=None):
        with database.session() as db:return {'items':reminders(db,channel_id),'optional':True}

    @app.get("/api/analytics")
    def analytics(channel_id:str|None=None):
        with database.session() as db:
            query=db.query(Analytics).join(Project,Project.id==Analytics.project_id)
            if channel_id:query=query.filter(Project.channel_id==channel_id)
            items=query.order_by(desc(Analytics.date)).limit(1000).all()
            return {"items":[{**serialize(a),"project_title":db.get(Project,a.project_id).title,"channel_id":db.get(Project,a.project_id).channel_id} for a in items],"learning":learning_data(db,channel_id),"reminders":reminders(db,channel_id)}

    @app.post("/api/analytics")
    def add_analytics(body:AnalyticsCreate):
        date.fromisoformat(body.date)
        with database.session() as db:
            p=get(db,Project,body.project_id)
            premise=db.get(Premise,p.selected_premise_id) if p.selected_premise_id else None
            data={**body.model_dump(),'metrics':normalize_snapshot(body,p,premise)}
            record=db.query(Analytics).filter_by(project_id=body.project_id,date=body.date).first()
            if record:
                for k,v in data.items():setattr(record,k,v)
            else:record=Analytics(**data);db.add(record)
            db.commit();return serialize(record)

    @app.post('/api/projects/{id}/analytics-reminder-dismiss')
    def dismiss_analytics_reminder(id:str,body:dict=Body(...)):
        if body.get('horizon_days') not in (7,28):raise ValueError('Choose the 7-day or 28-day reminder')
        with database.session() as db:
            p=get(db,Project,id)
            dismissed=set(p.publish.get('analytics_reminders_dismissed',[]));dismissed.add(body['horizon_days'])
            p.publish={**p.publish,'analytics_reminders_dismissed':sorted(dismissed)}
            db.commit();return {'dismissed':True,'optional':True}

    @app.get("/api/calendar")
    def calendar(channel_id:str|None=None):
        with database.session() as db:
            query=db.query(CalendarEntry)
            if channel_id:query=query.filter_by(channel_id=channel_id)
            items=[serialize(c) for c in query.order_by(CalendarEntry.target_date).limit(500)]
            counts={category:sum(c["category"]==category for c in items) for category in ("Core","Adjacent","Experimental","Wildcard")}
            return {"items":items,"mix":counts,"warning":"Planned content is concentrated in one category." if len(items)>=5 and max(counts.values(),default=0)/len(items)>.75 else None}

    @app.post("/api/calendar")
    def add_calendar(body:dict=Body(...)):
        with database.session() as db:
            get(db,Channel,body.get("channel_id"))
            if body.get("project_id"):get(db,Project,body["project_id"])
            date.fromisoformat(body.get("target_date",""))
            if not body.get("title"):raise ValueError("Title is required")
            item=CalendarEntry(**{k:v for k,v in body.items() if k in ("channel_id","project_id","title","target_date","category","duration","status")})
            db.add(item);db.commit();return serialize(item)

    @app.delete("/api/calendar/{id}")
    def delete_calendar(id:str):
        with database.session() as db:db.delete(get(db,CalendarEntry,id));db.commit();return {"deleted":True}

    @app.get("/api/novelty")
    def novelty():
        with database.session() as db:return {"items":[serialize(n) for n in db.query(Novelty).order_by(desc(Novelty.updated_at)).limit(500)],"method":"Transparent token Jaccard + structured motif overlap; no embedding API required"}

    @app.get("/api/updates")
    def update_status():
        path = root / 'updates' / 'status.json'
        try:
            status = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'state':'idle'}
        except (OSError, ValueError):
            status = {'state':'idle'}
        return {**status, 'current_version': VERSION, 'automatic_install': updater.enabled(APP_ROOT),
                'release_url': f'https://github.com/{updater.REPOSITORY}/releases/latest'}

    @app.post("/api/updates/check")
    def check_updates():
        # Separate thread; never occupy the story/render executor or wait on network in the request.
        if not updater.CHECK_LOCK.locked():
            threading.Thread(target=updater.check, args=(root, VERSION, True), daemon=True).start()
        return {'state':'checking'}

    @app.get("/api/updates/installer")
    def update_installer():
        try:
            folder = root / 'updates'
            info = json.loads((folder / 'pending.json').read_text(encoding='utf-8'))
            normalized = '.'.join(map(str, updater.version(info['version'])))
            name = f'StoryForge-US-{normalized}-Setup.exe'
            if info['name'] != name:
                raise ValueError('Invalid installer name')
            path = safe_path(root, 'updates/' + name)
            with path.open('rb') as stream:
                checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
            if checksum != info['sha256'] or path.stat().st_size != info['size']:
                raise ValueError('Installer checksum mismatch')
            return FileResponse(path, filename=name, media_type='application/octet-stream')
        except (OSError, ValueError, KeyError):
            raise HTTPException(409, 'No verified installer is ready. Check for updates again.')

    @app.get("/api/settings")
    def get_settings():
        with database.session() as db:return {**settings_for(db),"data_root":str(root),"providers":PROVIDER_URLS,"bridge_paired":bool(db.get(Setting,"_bridge_token")),"pending_data_root":json.loads(CONFIG_FILE.read_text(encoding="utf-8")).get("data_root") if CONFIG_FILE.exists() else None}

    @app.patch("/api/settings")
    def save_settings(body:dict=Body(...)):
        ranges={"default_wpm":(80,240),"default_duration":(1,240),"default_premise_count":(1,50),"visual_video_ratio":(0,1),"render_width":(320,3840),"render_height":(180,2160),"render_fps":(12,60),"max_audit_cycles":(1,3),"browser_timeout":(30,1800),"silence_threshold":(.5,60),"transition_seconds":(0,1.5),"music_db":(-60,0),"ambient_db":(-60,0),"narration_db":(-20,12)}
        with database.session() as db:
            for key,value in body.items():
                if key not in DEFAULT_SETTINGS:continue
                if key in ranges and (isinstance(value,bool) or not isinstance(value,(int,float)) or not ranges[key][0]<=value<=ranges[key][1]):raise ValueError(f"Invalid {key}; range {ranges[key]}")
                if key in ("render_width","render_height") and (value%2 or int(value)!=value):raise ValueError("H.264 dimensions must be even whole numbers")
                if key in ("default_wpm","default_premise_count","render_fps","max_audit_cycles") and int(value)!=value:raise ValueError(f"{key} must be a whole number")
                if isinstance(DEFAULT_SETTINGS[key],bool) and not isinstance(value,bool):raise ValueError(f"{key} must be true or false")
                if key=="provider_mode" and value not in ("mock","browser"):raise ValueError("Use mock or browser mode")
                if key=="pipeline_mode" and value not in ("manual","assisted","auto"):raise ValueError("Use manual, assisted or auto pipeline mode")
                if key=='render_encoder' and value not in ('auto','cpu'):raise ValueError('Choose automatic GPU or CPU encoding')
                if key in ("ffmpeg_path","ffprobe_path") and value and (not Path(value).is_file() or Path(value).name.lower() not in ("ffmpeg.exe","ffprobe.exe","ffmpeg","ffprobe")):raise ValueError("Choose a valid FFmpeg/ffprobe executable")
                setting=db.get(Setting,key)
                if setting:setting.value=value
                else:db.add(Setting(key=key,value=value))
            db.commit();return settings_for(db)

    @app.post("/api/settings/data-root")
    def change_root(body:dict=Body(...)):
        destination=Path(body.get("path","")).expanduser()
        if not destination.is_absolute() or len(destination.parts)<2:raise ValueError("Choose an absolute data folder, not a drive root")
        destination=destination.resolve()
        if destination==root.resolve():return {"path":str(root),"restart_required":False}
        if destination.is_relative_to(root.resolve()):raise ValueError("Choose a folder outside the current data root")
        destination.mkdir(parents=True,exist_ok=True)
        if (destination/"storyforge.db").exists():raise ValueError("Destination already contains a database")
        with database.session() as db:
            if db.query(Job).filter(Job.status.in_(["running","queued"])).count():raise ValueError("Wait for running jobs before moving data")
        for name in ("projects","prompts","logs"):
            shutil.copytree(root/name,destination/name,dirs_exist_ok=True)
        database.backup(destination/"storyforge.db")
        CONFIG_FILE.write_text(json.dumps({"data_root":str(destination)},indent=2),encoding="utf-8")
        return {"path":str(destination),"restart_required":True,"original_preserved":True}

    @app.get("/api/prompts")
    def prompt_list():return {"items":[{"name":p.stem,"customized":(root/"prompts"/p.name).exists()} for p in sorted((RESOURCE_ROOT/"prompts").glob("*.md"))]}

    @app.get("/api/prompts/{name}")
    def read_prompt(name:str):
        if name not in PROVIDERS:raise HTTPException(404)
        path=root/"prompts"/f"{name}.md"
        if not path.exists():path=RESOURCE_ROOT/"prompts"/f"{name}.md"
        return {"name":name,"text":path.read_text(encoding="utf-8")}

    @app.put("/api/prompts/{name}")
    def edit_prompt(name:str,body:dict=Body(...)):
        if name not in PROVIDERS:raise HTTPException(404)
        text=str(body.get("text",""))
        if not text.strip():raise ValueError("Prompt cannot be empty")
        path=root/"prompts"/f"{name}.md"
        if body.get("restore"):text=(RESOURCE_ROOT/"prompts"/f"{name}.md").read_text(encoding="utf-8")
        path.write_text(text,encoding="utf-8");return {"saved":True,"text":text}

    @app.post("/api/settings/pair-bridge")
    def pair_bridge():
        with database.session() as db:
            token=secrets.token_urlsafe(32);setting=db.get(Setting,"_bridge_token")
            if setting:setting.value=token
            else:db.add(Setting(key="_bridge_token",value=token))
            db.commit();return {"token":token,"url":"http://127.0.0.1:8787","instructions":"Paste this pairing token into the Browser Bridge extension popup. Treat it as a local access key."}

    @app.get("/api/bridge/jobs")
    def bridge_jobs():
        with database.session() as db:
            items = []
            for j in db.query(Job).filter_by(status='waiting_user').filter(~Job.provider.like('mock:%')).order_by(Job.created_at).limit(20):
                p = db.get(Project, j.project_id) if j.project_id else None
                media = j.payload.get('_media')
                items.append({'id': j.id, 'project_id': j.project_id, 'kind': j.kind, 'provider': j.provider, 'prompt': j.prompt,
                    'url': PROVIDER_URLS.get(j.provider), 'step': j.step, 'attempt': j.attempts,
                    'auto_claim': j.payload.get('_bridge_auto', {}), 'media': {**media, 'project_id': j.project_id} if media else None,
                    'media_session': p.settings.get('media_sessions', {}).get(j.provider, {}) if p and media else {},
                    'media_claim': j.payload.get('_media_claim', {}), 'timeout': settings_for(db)['browser_timeout']})
            return {'items': items}

    @app.get('/api/projects/{id}/media-automation/preview')
    def preview_media(id:str):
        with database.session() as db:
            return media_automation.preview(db,media_automation.project(db,id))

    @app.post('/api/projects/{id}/media-automation/start')
    def start_media(id:str,body:dict=Body(...)):
        return media_automation.start(id,body)

    @app.post('/api/projects/{id}/media-automation/stop')
    def stop_media(id:str):
        return media_automation.stop(id)

    @app.post('/api/bridge/media/{id}/claim')
    def claim_media(id:str,body:dict=Body(...)):
        return media_automation.claim(id,body)

    @app.post('/api/bridge/media/{id}/result')
    def complete_media(id:str,body:dict=Body(...)):
        return media_automation.complete(id,body)

    @app.post('/api/bridge/media/{id}/failure')
    def failed_media(id:str,body:dict=Body(...)):
        return media_automation.failure(id,body)

    @app.post('/api/bridge/media/{id}/session')
    def save_media_session(id:str,body:dict=Body(...)):
        return media_automation.save_session(id,body)

    @app.post('/api/bridge/media/{id}/references')
    def media_references(id:str,body:dict=Body(...)):
        return media_automation.references(id,body)

    @app.post('/api/projects/{id}/media-automation/references')
    def set_media_references(id:str,body:dict=Body(...)):
        return media_automation.configure_references(id,body)

    @app.post("/api/bridge/jobs/{id}/claim")
    def bridge_claim(id:str,body:dict=Body(...)):
        owner=str(body.get("owner",""))
        if not owner or len(owner)>128:raise ValueError("Invalid bridge client")
        with database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            job=get(db,Job,id)
            if job.status!="waiting_user" or job.attempts!=body.get("attempt"):
                raise HTTPException(409,"Job changed; refresh the queue")
            if job.provider not in ("chatgpt","gemini") or job.kind in ("image_generation","video_generation","tts_context"):
                raise ValueError("This media job requires manual download and attachment")
            claim=job.payload.get("_bridge_auto",{})
            if claim.get("attempt")==job.attempts and claim.get("owner")!=owner:
                raise HTTPException(409,"Another browser already claimed this job; do not send it again")
            if claim.get("attempt")!=job.attempts:
                claim={"owner":owner,"attempt":job.attempts,"phase":"claimed"}
            if body.get("authorize_send"):
                if claim.get("phase")=="sent":return {"send":False,"claim":claim}
                claim={**claim,"phase":"sent","sent_at":now()}
            job.payload={**job.payload,"_bridge_auto":claim}
            db.commit()
            return {"send":bool(body.get("authorize_send")),"claim":claim}

    @app.post("/api/bridge/jobs/{id}/retry")
    def bridge_retry(id:str,body:dict=Body(...)):
        owner=str(body.get("owner",""));retry_id=str(body.get("retry_id",""))
        reason=body.get("reason")
        if not owner or len(owner)>128 or not retry_id or len(retry_id)>128:
            raise ValueError("Invalid automatic retry request")
        if reason not in ("INVALID_JSON","SEND_NOT_READY","RETENTION_EVIDENCE"):
            raise ValueError("This error requires manual review")
        with database.session() as db:
            db.execute(sql_text("BEGIN IMMEDIATE"))
            job=get(db,Job,id)
            retry=job.payload.get("_bridge_retry",{})
            if retry.get("id")==retry_id and retry.get("owner")==owner:
                return {"accepted":True,"retry_count":retry["count"]}
            if job.status!="waiting_user" or job.attempts!=body.get("attempt"):
                raise HTTPException(409,"Job changed; refresh the queue")
            if job.provider not in ("chatgpt","gemini") or job.kind in ("image_generation","video_generation","tts_context"):
                raise ValueError("This media job requires manual download and attachment")
            claim=job.payload.get("_bridge_auto",{})
            if claim.get("owner")!=owner or claim.get("attempt")!=job.attempts:
                raise HTTPException(409,"Another browser owns this attempt")
            if reason in ("INVALID_JSON","RETENTION_EVIDENCE") and claim.get("phase")!="sent":
                raise ValueError("Cannot retry a response before sending")
            if reason == 'RETENTION_EVIDENCE':
                feedback = job.payload.get('_retention_feedback', {})
                project = db.get(Project, job.project_id) if job.project_id else None
                if (job.kind != 'retention_audit' or not project or feedback.get('attempt') != job.attempts
                        or feedback.get('audience_hash') != audience.fingerprint(db, project)):
                    raise ValueError('Only a rejected current retention assessment can be retried')
            if reason=="SEND_NOT_READY" and claim.get("phase")=="sent":
                raise ValueError("The request was already sent; collect its response")
            count=retry.get("count",0)+1
            if count>3:
                raise HTTPException(409,"Đã tự gửi lại 3 lần. Kiểm tra tab AI rồi tiếp tục thủ công hoặc bấm Thử lại.")
            job.payload={**job.payload,"_bridge_retry":{"id":retry_id,"owner":owner,"from_attempt":job.attempts,"count":count,"reason":reason}}
            job.status="queued";job.error="";job.step=f"Đang tự thử lại bằng yêu cầu mới ({count}/3)."
            job.logs=[*(job.logs or []),{"time":now(),"message":f"Automatic new request retry {count}/3 after {reason}; previous attempt {job.attempts}."}]
            db.commit()
        workflow.executor.submit(workflow.run,id)
        return {"accepted":True,"retry_count":count}

    @app.post("/api/bridge/jobs/{id}/status")
    def bridge_status(id:str,body:dict=Body(...)):
        with database.session() as db:
            job=get(db,Job,id)
            if job.status!="waiting_user":raise ValueError("Job is not waiting for the bridge")
            job.step=str(body.get("step","Waiting for browser"))[:240];db.commit()
            logging.getLogger("browser_bridge").info("Job %s: %s",id,job.step)
            return {"updated":True}

    @app.post("/api/bridge/jobs/{id}/parse-result")
    def bridge_parse_result(id:str,body:dict=Body(...)):
        # Read-only recovery: the normal completion route still validates schema,
        # input hashes and attempt ownership before storing anything.
        with database.session() as db:
            job=get(db,Job,id)
            if job.status!="waiting_user":raise ValueError("Job is not waiting for the bridge")
            if body.get("attempt") is not None and job.attempts!=body["attempt"]:
                raise ValueError("The attempt changed; discard the old browser response")
        if not isinstance(body.get("result"),str):raise ValueError("AI result must be text")
        return {"result":parse_ai_result(body["result"])}

    @app.post("/api/bridge/jobs/{id}/result")
    def bridge_result(id:str,body:dict=Body(...)):
        result=body.get("result")
        if isinstance(result,str):result=parse_ai_result(result)
        try:
            workflow.complete_ai(id,result,expected_attempt=body.get("attempt"))
        except audience.RetentionEvidenceError as exc:
            # Persist only a rejection from the current sent attempt. The
            # retry endpoint verifies this marker, ownership and retry limit.
            with database.session() as db:
                db.execute(sql_text("BEGIN IMMEDIATE"))
                job = get(db, Job, id)
                if (body.get('attempt') == job.attempts and job.status == 'waiting_user'
                        and job.payload.get('_bridge_auto', {}).get('phase') == 'sent'):
                    job.payload = {**job.payload, '_retention_feedback': {
                        'attempt': job.attempts, 'message': str(exc)[:1500],
                        'audience_hash': job.payload.get('_audience_hash')}}
                    db.commit()
            raise
        logging.getLogger("browser_bridge").info("Job %s: result accepted via %s",id,
            "automatic collection" if body.get("attempt") is not None else "manual bridge capture")
        return {"accepted":True}

    @app.get("/api/diagnostics")
    def diagnostics():
        logs={}
        for p in (root/"logs").glob("*.log"):
            with p.open("rb") as f:
                f.seek(max(0,p.stat().st_size-16000));logs[p.name]=f.read().decode("utf-8",errors="replace")
        return {"version":VERSION,"data_root":str(root),"logs":logs}

    @app.get("/api/diagnostics/export")
    def export_diagnostics():
        output=root/"exports"/"diagnostics.zip"
        with zipfile.ZipFile(output,"w",zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("diagnostics.json",json.dumps(diagnostics(),indent=2))
        return FileResponse(output,filename=output.name)

    @app.get("/api/backup")
    def backup():
        output=root/"backups"/f"storyforge-{uid()}.db";database.backup(output)
        return FileResponse(output,filename=output.name)

    @app.post("/api/restore")
    async def restore(file:UploadFile=File(...)):
        with database.session() as db:
            if db.query(Job).filter(Job.status.in_(["running","queued"])).count():raise ValueError("Stop running jobs before restoring")
        data=await file.read(100_000_001)
        if len(data)>100_000_000:raise ValueError("Database restore limit is 100 MB")
        path=root/"restore-upload.db";path.write_bytes(data)
        try:inspect_database(path)
        except Exception:
            path.unlink();raise
        path.replace(root/"restore-pending.db")
        return {"restart_required":True,"message":"Restore is staged. Restart StoryForge to apply; current database will be backed up automatically. Media must be restored separately."}

    @app.post("/api/demo")
    def demo():
        with database.session() as db:
            if db.query(Channel).filter_by(is_demo=True).first():return {"loaded":False,"message":"Demo workspace already exists"}
            channels=[]
            for name,niche,color,status in [("Midnight Archive","Mystery & atmospheric horror","blue","ESTABLISHED"),("Afterfall Stories","Post-apocalyptic survival","amber","ESTABLISHED"),("The Next Chapter","Finding a new storytelling niche","violet","DISCOVERY")]:
                c=Channel(name=name,niche=niche,color=color,status=status,is_demo=True,dna={"primary_genres":["Mystery","Survival"] if color=="blue" else ["Survival","Apocalypse"],"core_tropes":["isolation","moral choice","rules"],"tone":"Cinematic, intimate, quietly suspenseful","narration_style":"Warm American English","avoid_genres":[],"avoid_tropes":[],"content_mix":{"Core":40,"Adjacent":30,"Experimental":20,"Wildcard":10},"allowed_durations":[5,10,20,30,45,60]})
                db.add(c);db.flush();db.add(DNAVersion(channel_id=c.id,version=1,dna=c.dna,note="Demo fixture"));channels.append(c)
            fixture=workflow.mock.fixture
            for i,(title,summary) in enumerate([("A signal from an empty station","Isolation, a warning with missing context, and a difficult rescue."),("The rules of the last shelter","A community survives by questioning rules that have lost their purpose."),("A town at the edge of tomorrow","Second chances and the cost of changing a single decision.")]):
                s=Source(channel_id=channels[i].id,title=title,summary=summary,transcript="\n\n".join(fixture["draft_paragraphs"][:2]),tags=["demo","original fixture"],dna=fixture["story_dna"],status="ANALYZED")
                db.add(s);db.flush()
                p=Project(channel_id=channels[i].id,source_id=s.id,title=["The Last Signal from Station Nine","When the City Went Quiet","A Story Waiting to Be Found"][i],target_minutes=[10,20,5][i],duration_mode=str([10,20,5][i]),is_demo=True)
                db.add(p);db.flush();project_folder(root,p.id)
            db.commit()
        migrate_project_folders(database,root)
        return {"loaded":True,"message":"Three demo channels and projects created. All sample content is labeled demo; no real YouTube metrics are generated."}

    dist=RESOURCE_ROOT/"frontend"/"dist"
    if dist.exists():
        app.mount("/",StaticFiles(directory=dist,html=True),name="frontend")
    else:
        @app.get("/")
        def unbuilt():return {"app":"StoryForge US","message":"Run npm run build in frontend, or use the Vite development server."}
    return app
