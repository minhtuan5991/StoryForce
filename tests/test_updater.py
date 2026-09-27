import hashlib
import io
import json
import sqlite3
from pathlib import Path
import pytest
from launcher import updater
from backend.config import VERSION


def release(data=b'installer', tag='v3.2.0'):
    name = f'StoryForge-US-{tag[1:]}-Setup.exe'
    return {'tag_name': tag, 'assets': [{'name': name, 'size': len(data),
        'digest': 'sha256:' + hashlib.sha256(data).hexdigest(),
        'browser_download_url': f'https://github.com/{updater.REPOSITORY}/releases/download/{tag}/{name}'}]}


def test_release_identity_and_versions():
    assert updater.candidate(release(), '3.1.0')['version'] == '3.2.0'
    assert updater.candidate(release(), '3.2.0') is None
    assert updater.candidate({**release(), 'prerelease': True}, '3.1.0') is None
    for field, value in [('digest', ''), ('size', updater.MAX_INSTALLER_BYTES + 1),
                         ('browser_download_url', 'https://github.com/attacker/repo/setup.exe')]:
        item = release()
        item['assets'][0][field] = value
        with pytest.raises(ValueError):
            updater.candidate(item, '3.1.0')
    for url in ['http://github.com/x', 'https://github.com.evil.com/x',
                'https://github.com@evil.com/x', 'file:///C:/setup.exe']:
        assert not updater.allowed_url(url)
    assert updater.allowed_url('https://release-assets.githubusercontent.com/x')


def test_download_verifies_before_staging(tmp_path, monkeypatch):
    info = updater.candidate(release(), '3.1.0')
    monkeypatch.setattr(updater, 'request', lambda url: io.BytesIO(b'corrupted'))
    with pytest.raises(ValueError):
        updater.download(tmp_path, info)
    assert not (tmp_path / 'updates/pending.json').exists()
    assert not (tmp_path / 'updates/download.part').exists()
    monkeypatch.setattr(updater, 'request', lambda url: io.BytesIO(b'installer'))
    assert updater.download(tmp_path, info).read_bytes() == b'installer'
    assert json.loads((tmp_path / 'updates/pending.json').read_text()) == info


def test_check_offline_and_throttling(tmp_path, monkeypatch):
    calls = []
    def offline(url):
        calls.append(url)
        raise OSError('offline')
    monkeypatch.setattr(updater, 'request', offline)
    updater.check(tmp_path, '3.1.0')
    updater.check(tmp_path, '3.1.0')
    assert len(calls) == 1
    assert json.loads((tmp_path / 'updates/status.json').read_text())['state'] == 'error'


def test_apply_backs_up_and_preserves_data(tmp_path, monkeypatch):
    monkeypatch.setattr(updater, 'enabled', lambda app: True)
    monkeypatch.setattr(updater, 'request', lambda url: io.BytesIO(b'installer'))
    info = updater.candidate(release(), '3.1.0')
    updater.download(tmp_path, info)
    with sqlite3.connect(tmp_path / 'storyforge.db') as db:
        db.execute('create table example(value text)')
        db.execute("insert into example values ('keep me')")
    media = tmp_path / 'recording.wav'
    media.write_bytes(b'original audio')
    runner = tmp_path / 'resources/launcher/install_update.ps1'
    runner.parent.mkdir(parents=True)
    runner.write_text('# fixture')
    calls = []
    monkeypatch.setattr(updater.subprocess, 'Popen', lambda args, **kwargs: calls.append(args))
    assert updater.apply_pending(tmp_path, tmp_path / 'app', '3.1.0', runner.parents[1])
    assert len(calls) == 1 and '--helper' not in calls[0]
    backup = next((tmp_path / 'backups').glob('*.db'))
    with sqlite3.connect(backup) as db:
        assert db.execute('select value from example').fetchone()[0] == 'keep me'
    assert media.read_bytes() == b'original audio'
    assert not updater.apply_pending(tmp_path, tmp_path / 'app', '3.1.0', runner.parents[1])
    assert len(calls) == 1  # failed/unfinished attempt is never an installation loop
    assert not updater.apply_pending(tmp_path, tmp_path / 'app', '3.2.0', runner.parents[1])
    assert not (tmp_path / 'updates/pending.json').exists()


def test_tampered_staged_installer_cannot_launch(tmp_path, monkeypatch):
    monkeypatch.setattr(updater, 'enabled', lambda app: True)
    monkeypatch.setattr(updater, 'request', lambda url: io.BytesIO(b'installer'))
    info = updater.candidate(release(), '3.1.0')
    installer = updater.download(tmp_path, info)
    installer.write_bytes(b'evil')
    assert not updater.apply_pending(tmp_path, tmp_path / 'app', '3.1.0', tmp_path)


def test_manual_check_bypasses_interval(tmp_path, monkeypatch):
    calls = []
    def latest(url):
        calls.append(url)
        return io.BytesIO(json.dumps(release(tag='v3.1.0')).encode())
    monkeypatch.setattr(updater, 'request', latest)
    updater.check(tmp_path, '3.1.1')
    updater.check(tmp_path, '3.1.1')
    assert len(calls) == 1
    updater.check(tmp_path, '3.1.1', force=True)
    assert len(calls) == 2
    assert not updater.CHECK_LOCK.locked()


def test_updates_api_manual_and_verified_download(client, monkeypatch):
    import threading
    called = threading.Event()
    def check(root, current, force):
        assert force is True
        called.set()
    monkeypatch.setattr(updater, 'check', check)
    assert client.get('/api/updates').json()['current_version'] == VERSION
    assert client.post('/api/updates/check').status_code == 200
    assert called.wait(2)
    assert client.get('/api/updates/installer').status_code == 409
    monkeypatch.setattr(updater, 'request', lambda url: io.BytesIO(b'installer'))
    info = updater.candidate(release(), '3.1.1')
    path = updater.download(client.app.state.root, info)
    assert client.get('/api/updates/installer').content == b'installer'
    path.write_bytes(b'corrupt')
    assert client.get('/api/updates/installer').status_code == 409
    info['name'] = '../outside.exe'
    (client.app.state.root / 'updates/pending.json').write_text(json.dumps(info))
    assert client.get('/api/updates/installer').status_code == 409
