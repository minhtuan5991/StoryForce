"""Project-owned render caches, independent of captions and branding changes."""
import hashlib
import json
import os
import shutil
from pathlib import Path
from uuid import uuid4


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def file_signature(path):
    path = Path(path)
    info = path.stat()
    return [str(path.resolve()), info.st_size, info.st_mtime_ns]


def reuse_file(source, destination):
    """Completed render attempts keep their own immutable directory entries."""
    source, destination = Path(source), Path(destination)
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination)


class RenderCache:
    def __init__(self, directory, probe, settings):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.probe, self.settings = probe, settings
        self.used = set()

    def path(self, kind, value, suffix):
        return self.directory / (kind + '-' + fingerprint(value) + suffix)

    def valid(self, path, *, duration, width=None, height=None, fps=None):
        path = Path(path)
        if not path.is_file():
            return False
        marker = path.with_suffix(path.suffix + '.json')
        try:
            saved = json.loads(marker.read_text(encoding='utf-8'))
            if saved.get('storyforge_render_cache') != 1 or saved['signature'] != file_signature(path):
                return False
            info = saved['metadata']
            stream_duration = (info['video_duration'] or info['duration']) if width is not None else info['duration']
            tolerance = 1 / fps + .002 if fps else .02
            if abs(stream_duration - duration) > tolerance:
                return False
            if width is not None and (info['width'] != width or info['height'] != height or abs(info['fps']-fps) > .01):
                return False
            if width is None and not info['has_audio']:
                return False
            self.used.add(path)
            return True
        except (OSError, ValueError, KeyError, TypeError):
            return False

    def metadata(self, path):
        return json.loads(Path(path).with_suffix(Path(path).suffix + '.json').read_text(encoding='utf-8'))['metadata']

    def publish(self, pending, destination, **extra_metadata):
        info = self.probe(pending, self.settings)
        info.update(extra_metadata)
        Path(pending).replace(destination)
        marker = Path(destination).with_suffix(Path(destination).suffix + '.json')
        temporary = marker.with_name(marker.name + '.' + uuid4().hex[:8])
        temporary.write_text(json.dumps({'storyforge_render_cache':1, 'signature':file_signature(destination), 'metadata':info}), encoding='utf-8')
        temporary.replace(marker)
        self.used.add(Path(destination))
        return info

    def prune(self):
        """Keep only cache entries used by this successful attempt, never media."""
        for marker in self.directory.glob('*.json'):
            path = marker.with_suffix('')
            if path in self.used or path.parent != self.directory or path.is_symlink() or marker.is_symlink():
                continue
            try:
                saved = json.loads(marker.read_text(encoding='utf-8'))
                if saved.get('storyforge_render_cache') != 1 or saved['signature'] != file_signature(path):
                    continue
                path.unlink()
                marker.unlink()
            except (OSError, ValueError, KeyError):
                continue
