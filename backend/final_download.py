"""Save the rendered final locally in the same Downloads folder as its media."""
import os
import shutil
from pathlib import Path

from . import media_automation as download_paths
from .media import project_folder, safe_path
from .models import Project, uid
from .project_storage import project_path
from .resource_cleanup import archived
from .workflow import latest


def save_final(workflow, project_id):
    # Holding the existing deletion lock protects the source and folder while
    # copying. FastAPI runs this synchronous endpoint in its worker pool.
    with workflow.deletion_lock:
        with workflow.database.session() as db:
            project = db.get(Project, project_id)
            if not project:
                raise ValueError('Project not found')
            storage_root = project_path(workflow.root, project_id)
            render_root = storage_root / 'render'
            report = latest(db, project_id, 'render_report')
            if report and report.story_version != project.story_version:
                raise ValueError('Render the current story before downloading its final video')
            source = render_root / f'v{project.story_version}' / 'final_video.mp4'
            if report and report.content.get('file'):
                source = safe_path(workflow.root, report.content['file'])
            source = source.resolve()
            allowed_root = storage_root.resolve() if archived(project) else render_root.resolve()
            if not source.is_relative_to(allowed_root) or source.name != 'final_video.mp4' or not source.is_file():
                raise ValueError('Final video not generated for this project yet')
            folder = download_paths.project_download_folder(db, project)
            download_root = download_paths.downloads_root().resolve()
            destination = download_root / folder
            destination.mkdir(parents=True, exist_ok=True)
            if destination.resolve().parent != download_root:
                raise ValueError('The project download folder must stay inside Downloads')
            # A provider download may use a custom browser Downloads root. Reuse
            # that exact verified media directory when it is still available.
            batch = project.settings.get('media_automation', {})
            if batch.get('completed') and batch.get('folder') == folder:
                verified = Path(batch.get('download_path', ''))
                if verified.is_absolute() and verified.name == folder and verified.is_dir() and not verified.is_symlink():
                    destination = verified
            initial = source.stat()
            if not initial.st_size:
                raise ValueError('Final video is empty. Render it again before downloading')
            temporary = destination / ('.storyforge-' + uid() + '.part')
            target = None
            reserved = False
            try:
                shutil.copyfile(source, temporary)
                after = source.stat()
                if (initial.st_size, initial.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or temporary.stat().st_size != initial.st_size:
                    raise ValueError('The render changed while downloading. Wait for rendering to finish and download again')
                number = 0
                while True:
                    target = destination / ('final_video' + (f' ({number})' if number else '') + '.mp4')
                    try:
                        with target.open('xb'):
                            pass
                        reserved = True
                        break
                    except FileExistsError:
                        number += 1
                os.replace(temporary, target)
                reserved = False
                project.settings = {**project.settings, 'media_download_folder': folder}
                db.commit()
                return {'saved': True, 'path': str(target), 'filename': target.name, 'folder': str(destination), 'size': initial.st_size}
            except OSError as error:
                raise ValueError('Cannot save the final video. Check free space and access to the project Downloads folder: ' + str(error)) from error
            finally:
                temporary.unlink(missing_ok=True)
                if reserved and target:
                    target.unlink(missing_ok=True)
