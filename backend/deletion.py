"""Preview and confirm narrowly scoped deletions without disturbing ongoing work."""
import hashlib
import hmac
import json
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, text

from .models import Artifact, Job, Novelty, Project, Source, Premise, StoryVersion, Issue, Chunk, Scene, Asset, Analytics, CalendarEntry
from .providers import PROVIDERS
from .project_files import private_file_plan, remove_planned_files


class DeletionRequest(BaseModel):
    kind: Literal["sources", "novelty", "jobs", "projects"]
    ids: list[str] = Field(min_length=1, max_length=100)
    confirmation: str = ""
    delete_files: bool = False


class Deletions:
    models = {"sources": Source, "novelty": Novelty, "jobs": Job, "projects": Project}
    active_statuses = ("queued", "running", "waiting_user")

    def __init__(self, database, workflow, secret):
        self.database, self.workflow, self.secret = database, workflow, secret.encode()

    def report(self, db, request):
        if request.delete_files and request.kind!='projects':
            raise ValueError('File cleanup is only available for project deletion')
        ids = sorted(set(request.ids))
        records = [db.get(self.models[request.kind], id) for id in ids]
        if any(record is None for record in records):
            raise HTTPException(404, "Some selected items no longer exist. Refresh the list.")
        source_ids, project_ids, channel_ids = set(), set(), set()
        warnings = set()
        if request.kind == "sources":
            source_ids.update(ids)
            project_ids.update(p.id for p in db.query(Project).filter(Project.source_id.in_(ids)))
            channel_ids.update(s.channel_id for s in records if s.channel_id)
            if any(not s.dna for s in records):
                warnings.add("Some sources have not finished analysis.")
        elif request.kind == "projects":
            project_ids.update(ids)
            warnings.add("Deleting projects removes their stories, versions, analyses, job history, asset records and novelty memory. Channels and sources will remain.")
            warnings.add("Private project files will be permanently deleted. Shared files, exports outside the project folder and original imports elsewhere will remain." if request.delete_files else "Media files and exported files on disk will be kept. Calendar entries will remain without their project link.")
        else:
            project_ids.update(r.project_id for r in records if r.project_id)
            if request.kind == "jobs":
                source_ids.update(j.source_id for j in records if j.source_id)
                channel_ids.update(j.channel_id for j in records if j.channel_id)
                if any(j.status != "completed" for j in records):
                    warnings.add("Some jobs are unfinished. Deleting their history removes the ability to retry them.")
        projects = db.query(Project).filter(Project.id.in_(project_ids)).order_by(Project.id).all()
        if any(not p.publish.get("url") for p in projects):
            warnings.add("Linked projects are still in progress.")
        if request.kind == "sources" and projects:
            warnings.add("Linked projects will keep their stories and media, but lose their link to these sources.")
        if request.kind == "novelty":
            warnings.add("These stories will no longer be used by the duplicate guard. The projects and their content will remain.")
        if request.kind == "jobs":
            warnings.add("Only job history will be deleted. Generated results, projects and media will remain.")

        # A cancelled worker can still be unwinding; keep its inputs until it exits.
        removes_memory = request.kind == "projects" and db.query(Novelty).filter(Novelty.project_id.in_(ids)).count() > 0
        candidates = db.query(Job).filter(or_(Job.status.in_(self.active_statuses), Job.id.in_(self.workflow.active_jobs))).order_by(Job.id).all()
        blockers = []
        for job in candidates:
            project = db.get(Project, job.project_id) if job.project_id else None
            related = job.project_id in project_ids or job.source_id in source_ids
            related |= bool(project and project.source_id in source_ids)
            related |= bool(job.channel_id and job.channel_id in channel_ids)
            if request.kind == "sources":
                related |= bool(project and project.channel_id in channel_ids)
            if request.kind == "jobs":
                related |= job.id in ids
            # Every AI prompt includes the shared novelty memory, across channels.
            if request.kind == "novelty" or removes_memory:
                related |= job.kind in PROVIDERS
            if related:
                blockers.append({"id": job.id, "kind": job.kind, "status": job.status,
                                 "project_title": project.title if project else "",
                                 "source_title": (db.get(Source, job.source_id).title if job.source_id and db.get(Source, job.source_id) else ""),
                                 "worker_active": job.id in self.workflow.active_jobs})
        affected = {}
        children = {}
        if request.kind == "projects":
            # Include dependent changes in the confirmation fingerprint, even if
            # editing a child record did not update the project's timestamp.
            for model in (Artifact, Job, Premise, StoryVersion, Issue, Chunk, Scene, Asset, Analytics, Novelty, CalendarEntry):
                rows = db.query(model).filter(model.project_id.in_(ids)).order_by(model.id).all()
                children[model.__tablename__] = [(row.id, row.updated_at) for row in rows]
                affected[model.__tablename__] = len(rows)
        if request.kind == "sources":
            for model, key in ((Job, "source_jobs"), (Artifact, "source_artifacts")):
                affected[key] = db.query(model).filter(model.source_id.in_(ids), model.project_id.is_(None), model.channel_id.is_(None)).count()
        report = {"kind": request.kind, "ids": ids,
                  "items": [{"id": r.id, "title": r.kind if request.kind == "jobs" else r.title,
                             "updated_at": r.updated_at} for r in records],
                  "warnings": sorted(warnings), "blockers": blockers, "blocked": bool(blockers),
                  "projects": [{"id": p.id, "title": p.title, "stage": p.stage} for p in projects],
                  "affected": affected}
        report['delete_files']=request.delete_files
        if request.kind=='projects' and request.delete_files:
            report['file_cleanup']=private_file_plan(db,self.workflow.root,ids)
        report["confirmation"] = hmac.new(self.secret, json.dumps(report, sort_keys=True).encode(), hashlib.sha256).hexdigest()
        if children:
            report["confirmation"] = hmac.new(self.secret, json.dumps([report, children], sort_keys=True).encode(), hashlib.sha256).hexdigest()
        return report

    def preview(self, request):
        with self.workflow.deletion_lock, self.database.session() as db:
            return self.report(db, request)

    def confirm(self, request):
        with self.workflow.deletion_lock, self.database.session() as db:
            # Lock SQLite before checking state so another writer cannot start work
            # between the final dependency check and this deletion's commit.
            db.execute(text("BEGIN IMMEDIATE"))
            report = self.report(db, request)
            if report["blocked"]:
                raise HTTPException(409, "Related work is active. Wait for completion or cancel it before deleting.")
            if not hmac.compare_digest(report["confirmation"], request.confirmation):
                raise HTTPException(409, "The selected content changed. Review the deletion warning again.")
            if request.kind == "sources":
                # Preserve project/channel outputs and history; only source-only
                # analysis is removed by the existing source foreign-key cascade.
                for model in (Job, Artifact):
                    db.query(model).filter(model.source_id.in_(report["ids"]), or_(model.project_id.is_not(None), model.channel_id.is_not(None))).update({model.source_id: None}, synchronize_session=False)
            for id in report["ids"]:
                db.delete(db.get(self.models[request.kind], id))
            db.commit()
            result={"deleted": True, "count": len(report["ids"])}
            if request.delete_files:
                # Database removal is confirmed before cleanup. File errors are
                # returned explicitly; never claim that locked files were removed.
                result['file_cleanup']=remove_planned_files(self.workflow.root,report['ids'],report['file_cleanup'])
            return result
