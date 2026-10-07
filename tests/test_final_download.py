from pathlib import Path

from backend.models import Artifact, Project


def rendered(client, project, name='Mystery project'):
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id']); p.title = name; p.story_version = 1
        file = client.app.state.root / 'projects' / p.id / 'render' / 'v1' / 'run' / 'final_video.mp4'
        file.parent.mkdir(parents=True, exist_ok=True); file.write_bytes(b'final MP4 ' + p.id.encode())
        db.add(Artifact(project_id=p.id, kind='render_report', story_version=1,
                        content={'file': str(file.relative_to(client.app.state.root)), 'story_version': 1}))
        db.commit()
    return file


def test_final_download_saves_current_project_folder_preserves_render_and_never_overwrites(client, project, tmp_path, monkeypatch):
    downloads = tmp_path / 'Downloads'
    monkeypatch.setattr('backend.media_automation.downloads_root', lambda: downloads)
    file = rendered(client, project)
    url = '/api/projects/' + project['id'] + '/download-final'
    first = client.post(url); assert first.status_code == 200, first.text
    assert first.json()['saved'] and Path(first.json()['path']) == downloads / 'Mystery project' / 'final_video.mp4'
    assert Path(first.json()['path']).read_bytes() == file.read_bytes()
    second = client.post(url); assert second.status_code == 200
    assert Path(second.json()['path']).name == 'final_video (1).mp4'
    assert file.read_bytes() == Path(first.json()['path']).read_bytes()
    assert not list(downloads.rglob('*.part'))
    # Ordinary download/preview streams remain unchanged.
    assert client.get('/api/projects/' + project['id'] + '/download/final_video.mp4').content == file.read_bytes()
    assert client.post(url, headers={'X-StoryForge-Token': 'wrong'}).status_code == 403


def test_final_download_reuses_media_folder_after_project_rename_and_separates_equal_titles(client, project, tmp_path, monkeypatch):
    downloads = tmp_path / 'Downloads'
    monkeypatch.setattr('backend.media_automation.downloads_root', lambda: downloads)
    rendered(client, project, 'Same title')
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id']); p.settings = {'media_automation': {'folder': 'Established folder'}}; db.commit()
    first = client.post('/api/projects/' + project['id'] + '/download-final').json()
    assert Path(first['path']).parent.name == 'Established folder'
    others = []
    for _ in range(2):
        other = client.post('/api/projects', json={'channel_id': project['channel_id'], 'title': 'Other same title'}).json(); rendered(client, other, 'Other same title'); others.append(other)
    paths = [Path(client.post('/api/projects/' + p['id'] + '/download-final').json()['path']) for p in others]
    assert paths[0].parent != paths[1].parent
    assert all(p.is_relative_to(downloads) for p in paths)
    assert all(p.read_bytes().endswith(project['id'].encode()) for p in [Path(first['path'])])


def test_final_download_reuses_verified_custom_browser_downloads_directory(client, project, tmp_path, monkeypatch):
    monkeypatch.setattr('backend.media_automation.downloads_root', lambda: tmp_path / 'DefaultDownloads')
    rendered(client, project)
    folder = tmp_path / 'BrowserDownloads' / 'Custom folder'; folder.mkdir(parents=True)
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id']); p.settings = {'media_automation': {'folder': 'Custom folder', 'completed': 2, 'download_path': str(folder)}}; db.commit()
    saved = client.post('/api/projects/' + project['id'] + '/download-final')
    assert saved.status_code == 200 and Path(saved.json()['path']).parent == folder


def test_failed_copy_or_stale_report_does_not_create_incomplete_final(client, project, tmp_path, monkeypatch):
    monkeypatch.setattr('backend.media_automation.downloads_root', lambda: tmp_path / 'Downloads')
    file = rendered(client, project)
    url = '/api/projects/' + project['id'] + '/download-final'
    import backend.final_download as final
    def failed_copy(source, destination):
        Path(destination).write_bytes(b'partial')
        raise ValueError('Copy interrupted')
    monkeypatch.setattr(final.shutil, 'copyfile', failed_copy)
    assert client.post(url).status_code == 422
    assert not list((tmp_path / 'Downloads').rglob('*.part'))
    assert not list((tmp_path / 'Downloads').rglob('*.mp4'))
    assert file.read_bytes().startswith(b'final MP4')
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id']); p.story_version = 2; db.commit()
    assert 'current story' in client.post(url).text
