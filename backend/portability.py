import html
import json
import sqlite3
import zipfile
from contextlib import closing
from pathlib import Path
from .models import *
from .config import safe_path
from .youtube_metadata import upload_text, metadata_fingerprint


def project_archive(db, root: Path, project, include_media=False):
    related = {}
    for model in (Artifact, Premise, StoryVersion, Issue, Chunk, Scene, Asset, Analytics):
        related[model.__tablename__] = [serialize(item) for item in db.query(model).filter_by(project_id=project.id).all()]
    metadata = {"format": "storyforge-project", "version": 1, "project": serialize(project), "channel": serialize(db.get(Channel,project.channel_id)), **related}
    pool_id = (project.settings or {}).get('premise_origin', {}).get('project_id') or project.id
    metadata['premise_usage'] = [serialize(item) for item in db.query(PremiseUsage).filter_by(pool_project_id=pool_id)]
    output = root / "exports" / f"{project.id}-project-v{project.story_version}.zip"
    with zipfile.ZipFile(output,"w",zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("project.json", json.dumps(metadata,ensure_ascii=False,indent=2))
        archive.writestr("story/story.txt",project.draft)
        archive.writestr("story/story.md",f"# {project.title}\n\n{project.draft}")
        generated=sorted((a for a in related['artifacts'] if a['kind']=='youtube_metadata'),key=lambda a:(a['created_at'],a['id']))
        if generated:
            item=generated[-1]
            handoff=upload_text(item['content'],project.title,item['story_version'])
            if item['content'].get('content_fingerprint')!=metadata_fingerprint(db,project):
                handoff='WARNING: Metadata is out of date; regenerate before uploading.\n\n'+handoff
            archive.writestr('publish/youtube_metadata.txt',handoff.encode('utf-8-sig'))
        for kind in ("story_bible", "outline", "outline_rewrite", "gemini_story_audit", "chatgpt_cross_review", "retention_audit", "opening_variants", "opening_choice", "visual_director", "render_report"):
            items = [a for a in related["artifacts"] if a["kind"] == kind]
            if items:
                archive.writestr(f"story/{kind}.json",json.dumps(items[-1],ensure_ascii=False,indent=2))
                archive.writestr(f"story/{kind}.md",f"# {kind.replace('_',' ').title()}\n\n```json\n{json.dumps(items[-1]['content'],ensure_ascii=False,indent=2)}\n```\n")
        for chunk in related["tts_chunks"]:
            archive.writestr(f"story/tts_{chunk['number']:03}.txt",chunk["text"])
        for scene in related["visual_scenes"]:
            archive.writestr(f"story/scene_{scene['number']:03}_prompt.txt",scene["prompt"])
        folder = root / "projects" / project.id
        for extension in ("srt","vtt"):
            path = folder/"subtitles"/f"captions.{extension}"
            if path.is_file():
                archive.write(path,f"subtitles/captions.{extension}")
        render = folder/"render"/f"v{project.story_version}"
        reports = sorted((a for a in related["artifacts"] if a["kind"] == "render_report" and a["content"].get("story_version") == project.story_version), key=lambda a:(a["created_at"],a["id"]))
        if reports and reports[-1]["content"].get("file"):
            render = safe_path(root,reports[-1]["content"]["file"]).parent
        for name in ("timeline.csv", "render_report.json", "thumbnail_prompt.txt"):
            path = render/name
            if path.is_file():
                archive.write(path,name)
        if include_media:
            for asset in related["assets"]:
                path = safe_path(root,asset["path"])
                if path.is_file():
                    archive.write(path,path.relative_to(folder).as_posix())
        archive.writestr("OPEN_ME_FIRST.html",f"<!doctype html><meta charset='utf-8'><title>StoryForge handoff</title><style>body{{font:18px system-ui;max-width:760px;margin:60px auto;line-height:1.7;background:#101b29;color:#e6edf5}}code{{color:#ffc080}}</style><h1>{html.escape(project.title)}</h1><p>Story version {project.story_version}. Import the audio and visual folders into your editor. Use <code>timeline.csv</code> for placement and <code>subtitles/captions.srt</code> for captions.</p><p>This is a portable media handoff, not a native CapCut project. Review timing, image continuity and all narration before publishing.</p>")
    return output


def inspect_database(path):
    try:
        connection=sqlite3.connect(f"file:{path.as_posix()}?mode=ro",uri=True)
        with closing(connection):
            _inspect_connection(connection)
    except sqlite3.DatabaseError as exc:
        raise ValueError("This file is not a valid SQLite database") from exc


def _inspect_connection(connection):
        if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("Database integrity check failed")
        tables = {r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        required = {"channels","projects","sources","settings","schema_migrations"}
        if not required <= tables:
            raise ValueError("This is not a StoryForge database")
        version = connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
        if version not in (1, 2, 3):
            raise ValueError("Unsupported schema version")


def safe_extract(archive: zipfile.ZipFile, destination: Path):
    if sum(i.file_size for i in archive.infolist()) > 5_000_000_000:
        raise ValueError("Archive exceeds 5 GB unpacked limit")
    for item in archive.infolist():
        path = safe_path(destination,item.filename.replace("\\","/"))
        if (item.external_attr >> 16) & 0o170000 == 0o120000:
            raise ValueError("Symlinks are not allowed in archives")
        if item.is_dir():
            path.mkdir(parents=True,exist_ok=True)
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            with archive.open(item) as source,path.open("wb") as target:
                import shutil
                shutil.copyfileobj(source,target)
