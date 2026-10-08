"""Explicit, previewed cleanup of private project files. Never follow links."""
import os
import stat
from pathlib import Path
from .models import Asset, Artifact, Chunk, Scene, Project
from .config import safe_path
from .project_storage import project_path

def linked(path):
    info=path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info,'st_file_attributes',0)&0x400)

def checked_folder(root, project_id):
    if not project_id or Path(project_id).name!=project_id or project_id in ('.','..') or '/' in project_id or '\\' in project_id:
        raise ValueError('Invalid project storage folder')
    folder=project_path(root,project_id)
    for path in (root,root/'projects',folder):
        if path.exists() and linked(path):
            raise ValueError('Project storage contains a link; files will not be deleted')
    if folder.resolve().parent!=(root/'projects').resolve():
        raise ValueError('Project storage is outside the expected folder')
    return folder

def strings(value):
    if isinstance(value,str):yield value
    elif isinstance(value,dict):
        for item in value.values():yield from strings(item)
    elif isinstance(value,list):
        for item in value:yield from strings(item)

def private_file_plan(db, root, ids):
    root=Path(root).resolve();ids=set(ids);protected=set()
    def protect(value):
        if not isinstance(value,str) or not value:return
        try:protected.add(safe_path(root,value).resolve())
        except (ValueError,OSError):pass
    for asset in db.query(Asset).filter(~Asset.project_id.in_(ids)):
        protect(asset.path)
    # Preserve files also mapped by another project, even if their asset record
    # was originally imported by the project being removed.
    references=set()
    for item in db.query(Chunk).filter(~Chunk.project_id.in_(ids)):references.add(item.asset_id)
    for item in db.query(Scene).filter(~Scene.project_id.in_(ids)):references.update((item.asset_id,item.fallback_asset_id))
    for project in db.query(Project).filter(~Project.id.in_(ids)):references.add((project.publish or {}).get('thumbnail_asset_id'))
    for asset in db.query(Asset).filter(Asset.id.in_([i for i in references if i])):protect(asset.path)
    for artifact in db.query(Artifact).filter(~Artifact.project_id.in_(ids)):
        for value in strings(artifact.content):
            if value.replace('\\','/').startswith('projects/') or Path(value).is_absolute():protect(value)
    for project in db.query(Project).filter(~Project.id.in_(ids)):
        for value in strings(project.publish):
            if value.replace('\\','/').startswith('projects/') or Path(value).is_absolute():protect(value)
    files=[];kept=[]
    for id in sorted(ids):
        folder=checked_folder(root,id)
        if not folder.exists():continue
        for directory,dirs,names in os.walk(folder,followlinks=False):
            parent=Path(directory)
            for name in dirs[:]:
                path=parent/name
                if linked(path):dirs.remove(name);kept.append(str(path.relative_to(root)))
            for name in names:
                path=parent/name
                if linked(path) or not path.is_file() or path.resolve() in protected:
                    kept.append(str(path.relative_to(root)));continue
                if not path.resolve().is_relative_to(folder.resolve()):raise ValueError('File escaped project storage')
                info=path.stat()
                files.append({'path':str(path.relative_to(root)),'bytes':info.st_size,'mtime_ns':info.st_mtime_ns,'inode':info.st_ino})
    files.sort(key=lambda row:row['path'])
    return {'files':files,'count':len(files),'bytes':sum(f['bytes'] for f in files),'kept':sorted(kept)}

def remove_planned_files(root, ids, plan):
    root=Path(root).resolve();failed=[];removed=0;freed=0
    for item in plan['files']:
        try:
            path=root/item['path']
            folder=next((checked_folder(root,id) for id in ids if path.is_relative_to(checked_folder(root,id))),None)
            if folder is None:raise ValueError('File is not owned by the selected projects')
            # Recheck every ancestor; refuse symlinks/junctions replaced after preview.
            cursor=path
            while cursor!=folder:
                if linked(cursor):raise ValueError('File or parent changed into a link')
                cursor=cursor.parent
            info=path.stat()
            if not path.resolve().is_relative_to(folder.resolve()) or (info.st_size,info.st_mtime_ns,info.st_ino)!=(item['bytes'],item['mtime_ns'],item['inode']):
                raise ValueError('File changed after confirmation')
            path.unlink();removed+=1;freed+=item['bytes']
        except (OSError,ValueError):failed.append(item['path'])
    # Only remove empty directories, using rmdir (never recursive deletion).
    for id in ids:
        try:
            folder=checked_folder(root,id)
            for directory,_,_ in os.walk(folder,topdown=False,followlinks=False):
                path=Path(directory)
                if not linked(path) and path.resolve().is_relative_to(folder.resolve()):
                    try:path.rmdir()
                    except OSError:pass
        except (OSError,ValueError):pass
    return {'removed_files':removed,'freed_bytes':freed,'failed_files':failed,'kept_files':plan['kept']}
