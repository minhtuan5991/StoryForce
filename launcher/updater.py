"""Public GitHub releases: download in the background, apply on next start."""
from __future__ import annotations
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
from urllib.parse import urlparse

REPOSITORY = 'minhtuan5991/StoryForce'
MAX_INSTALLER_BYTES = 300 * 1024 * 1024
LOG = logging.getLogger('app')
CHECK_LOCK = threading.Lock()


def version(value):
    match = re.fullmatch(r'v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value or '')
    if not match:
        raise ValueError('Invalid stable release version')
    return tuple(map(int, match.groups()))


def allowed_url(url):
    parsed = urlparse(url)
    host = parsed.hostname or ''
    return (parsed.scheme == 'https' and not parsed.username and not parsed.password
            and parsed.port in (None, 443)
            and (host in ('api.github.com', 'github.com') or host.endswith('.githubusercontent.com')))


class GitHubRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed_url(newurl):
            raise ValueError('Release redirect outside GitHub')
        # No authentication or project data is sent in these requests.
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def request(url):
    if not allowed_url(url):
        raise ValueError('Release URL outside GitHub')
    return urllib.request.build_opener(GitHubRedirect()).open(
        urllib.request.Request(url, headers={'User-Agent': 'StoryForge-Updater',
                                            'Accept': 'application/vnd.github+json'}), timeout=20)


def candidate(release, current):
    if release.get('draft') or release.get('prerelease'):
        return None
    tag = release.get('tag_name', '')
    if version(tag) <= version(current):
        return None
    normalized = '.'.join(map(str, version(tag)))
    name = f'StoryForge-US-{normalized}-Setup.exe'
    assets = [asset for asset in release.get('assets', []) if asset.get('name') == name]
    if len(assets) != 1:
        raise ValueError('Release must contain exactly one Windows installer')
    asset = assets[0]
    digest = asset.get('digest', '')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
        raise ValueError('GitHub SHA256 digest is required')
    size = asset.get('size', 0)
    if not isinstance(size, int) or not 0 < size <= MAX_INSTALLER_BYTES:
        raise ValueError('Invalid installer size')
    url = asset.get('browser_download_url', '')
    expected = f'https://github.com/{REPOSITORY}/releases/download/{tag}/{name}'
    if url != expected:
        raise ValueError('Installer is not from the configured repository release')
    return {'version': normalized, 'name': name, 'url': url, 'sha256': digest[7:], 'size': size}


def save_json(path, value):
    pending = path.with_suffix('.tmp')
    pending.write_text(json.dumps(value), encoding='utf-8')
    os.replace(pending, path)


def download(root, info):
    folder = root / 'updates'
    folder.mkdir(parents=True, exist_ok=True)
    partial = folder / 'download.part'
    digest = hashlib.sha256()
    size = 0
    try:
        with request(info['url']) as response, partial.open('wb') as target:
            while block := response.read(1024 * 1024):
                size += len(block)
                if size > info['size'] or size > MAX_INSTALLER_BYTES:
                    raise ValueError('Installer exceeded declared size')
                digest.update(block)
                target.write(block)
        if size != info['size'] or digest.hexdigest() != info['sha256']:
            raise ValueError('Installer checksum mismatch')
        target = folder / info['name']
        os.replace(partial, target)
        save_json(folder / 'pending.json', info)
        return target
    finally:
        partial.unlink(missing_ok=True)


def check(root, current, force=False):
    if not CHECK_LOCK.acquire(blocking=False):
        return
    try:
        _check(root, current, force)
    finally:
        CHECK_LOCK.release()


def _check(root, current, force=False):
    folder = root / 'updates'
    folder.mkdir(parents=True, exist_ok=True)
    status = folder / 'status.json'
    try:
        previous = json.loads(status.read_text(encoding='utf-8')) if status.exists() else {}
        if not force and time.time() - previous.get('checked_at', 0) < 6 * 3600:
            return
        save_json(status, {'checked_at': time.time(), 'state': 'checking'})
        with request(f'https://api.github.com/repos/{REPOSITORY}/releases/latest') as response:
            payload = response.read(1024 * 1024 + 1)
        if len(payload) > 1024 * 1024:
            raise ValueError('Release metadata too large')
        info = candidate(json.loads(payload), current)
        if info:
            pending_file = folder / 'pending.json'
            pending = json.loads(pending_file.read_text()) if pending_file.exists() else None
            if pending != info or not (folder / info['name']).exists():
                save_json(status, {'checked_at': time.time(), 'state': 'downloading', 'version': info['version']})
                download(root, info)
        save_json(status, {'checked_at': time.time(), 'state': 'ready' if info else 'current',
                           'version': info['version'] if info else current})
    except Exception as exc:
        LOG.warning('Online update check failed: %s', exc)
        save_json(status, {'checked_at': time.time(), 'state': 'error', 'message': str(exc)})


def enabled(app_root):
    return bool(getattr(sys, 'frozen', False) and (app_root / 'unins000.exe').is_file())


def start_check(root, app_root, current):
    if enabled(app_root):
        threading.Thread(target=check, args=(root, current), daemon=True, name='update-check').start()


def apply_pending(root, app_root, current, resource_root):
    """Called only before starting a server, after verifying no instance is active."""
    if not enabled(app_root):
        return False
    folder = root / 'updates'
    pending = folder / 'pending.json'
    if not pending.exists():
        return False
    try:
        info = json.loads(pending.read_text(encoding='utf-8'))
        normalized = '.'.join(map(str, version(info['version'])))
        name = f'StoryForge-US-{normalized}-Setup.exe'
        if info['name'] != name:
            raise ValueError('Unexpected pending installer filename')
        installer = folder / name
        if version(normalized) <= version(current):
            pending.unlink()
            installer.unlink(missing_ok=True)
            return False
        # A failed installation is not retried endlessly at each startup.
        attempt = folder / f'attempt-{normalized}.json'
        if attempt.exists():
            return False
        with installer.open('rb') as stream:
            valid_hash = hashlib.file_digest(stream, 'sha256').hexdigest() == info['sha256']
        if installer.stat().st_size != info['size'] or not valid_hash:
            raise ValueError('Pending installer failed SHA256 check')
        # SQLite backup includes committed WAL content, not only the main DB file.
        dbfile = root / 'storyforge.db'
        if dbfile.exists():
            from contextlib import closing
            backup = root / 'backups' / f'pre-update-{normalized}-{int(time.time())}.db'
            backup.parent.mkdir(exist_ok=True)
            with closing(sqlite3.connect(str(dbfile))) as source, closing(sqlite3.connect(str(backup))) as destination:
                source.backup(destination)
        runner = resource_root / 'launcher' / 'install_update.ps1'
        # Copy outside the installation folder before the installer replaces resources.
        local_runner = folder / 'install_update.ps1'
        local_runner.write_bytes(runner.read_bytes())
        save_json(attempt, {'started_at': time.time(), 'version': normalized})
        try:
            subprocess.Popen(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                              '-File', str(local_runner), '-Installer', str(installer), '-AppDirectory', str(app_root),
                              '-DataDirectory', str(root), '-ParentPid', str(os.getpid()), '-ExpectedHash', info['sha256']],
                             creationflags=subprocess.CREATE_NO_WINDOW, close_fds=True)
        except Exception:
            attempt.unlink(missing_ok=True)
            raise
        return True
    except Exception as exc:
        LOG.warning('Cannot apply pending update; starting existing app: %s', exc)
        return False
