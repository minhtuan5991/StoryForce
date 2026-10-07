import base64
import hashlib
import io
from pathlib import Path

import pytest
from PIL import Image

from backend.media_sessions import provider_page
from backend.models import Asset, Artifact, Chunk, Project, Scene
from test_media_automation import production, start, claim, fail, result, media_job


def owned_post(client, p, job, endpoint, **body):
    return client.post('/api/bridge/media/' + job['id'] + '/' + endpoint, headers=p['headers'],
                       json={'owner': 'one', 'attempt': job['attempt'], **body})


def visuals(client, p):
    preview = client.get(p['path'] + '/preview').json()
    return start(client, p, 'visuals', **{k: preview[k] for k in ('confirmation', 'image_count', 'video_count')})


def image_asset(client, p, name='person.png', color='blue'):
    path = client.app.state.root / name
    Image.new('RGB', (80, 50), color).save(path)
    with client.app.state.database.session() as db:
        asset = Asset(project_id=p['id'], name=name, kind='image', path=name, story_version=1,
                      sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        db.add(asset); db.commit()
        return asset.id


def test_saved_session_is_owned_canonical_project_scoped_and_survives_failure(client, production):
    p = production; visuals(client, p); j = media_job(client, p); claim(client, p, j)
    for invalid in ('http://gemini.google.com/app/abc', 'https://elsewhere.test/app/abc',
                    'https://gemini.google.com.evil.test/app/abc', 'https://u:p@gemini.google.com/app/abc'):
        assert owned_post(client, p, j, 'session', url=invalid).status_code == 422
    assert owned_post(client, p, j, 'session', owner='another', url='https://gemini.google.com/app/abc').status_code == 422
    saved = owned_post(client, p, j, 'session', url='https://gemini.google.com/app/abc?account=private#clip')
    assert saved.status_code == 200, saved.text
    assert saved.json()['session']['url'] == 'https://gemini.google.com/app/abc'
    assert saved.json()['session']['last_prompt'] == j['prompt']
    assert owned_post(client, p, j, 'session', url='https://gemini.google.com/app/other').status_code == 422
    assert fail(client, p, j).status_code == 200
    next_job = media_job(client, p)
    assert next_job['project_id'] == p['id'] and next_job['media']['project_id'] == p['id']
    assert next_job['media_session']['url'] == saved.json()['session']['url']
    assert next_job['media_session']['last_prompt'] == j['prompt']
    assert owned_post(client, p, j, 'session', url=saved.json()['session']['url']).status_code == 422


def test_session_cannot_share_another_projects_chat_and_aistudio_keeps_voice_style_model(client, production):
    p = production
    with client.app.state.database.session() as db:
        original = db.get(Project, p['id'])
        db.add(Project(channel_id=original.channel_id, title='Same name', settings={'media_sessions': {'gemini': {'url': 'https://gemini.google.com/app/shared'}}}))
        db.commit()
    visuals(client, p); j = media_job(client, p); claim(client, p, j)
    assert owned_post(client, p, j, 'session', url='https://gemini.google.com/app/shared').status_code == 422
    client.post(p['path'] + '/stop')
    start(client, p); j = media_job(client, p); claim(client, p, j)
    saved = owned_post(client, p, j, 'session', url='https://aistudio.google.com/prompts/dialog-one')
    assert saved.status_code == 200, saved.text
    assert saved.json()['session']['tts'] == j['media']['tts'] == {'voice': 'Enzo', 'style': 'Friendly', 'model': 'Gemini 3.8 Flash TTS'}


@pytest.mark.parametrize('provider,url,expected', [
    ('gemini', 'https://gemini.google.com/app', None),
    ('flow', 'https://flow.google.com/', None),
    ('flow', 'https://labs.google/fx/tools/flow/project/id/edit/clip?x=1', 'https://labs.google/fx/tools/flow/project/id'),
    ('flow', 'https://flow.google.com/projects/id/edit/clip', 'https://flow.google.com/projects/id'),
    ('aistudio', 'https://aistudio.google.com/prompts/dialog?x=1', 'https://aistudio.google.com/prompts/dialog'),
])
def test_home_pages_are_not_recovery_chats_and_transient_routes_are_removed(provider, url, expected):
    assert provider_page(provider, url) == expected


def test_first_verified_scene_becomes_reference_for_flow_and_stays_fixed_on_plan_replacement(client, production):
    p = production
    with client.app.state.database.session() as db:
        db.add(Artifact(project_id=p['id'], kind='story_bible', content={'characters': [{'name': 'Ethan', 'appearance': 'Brown eyes'}]}))
        db.commit()
    state = visuals(client, p)
    thumbnail = media_job(client, p); claim(client, p, thumbnail)
    assert owned_post(client, p, thumbnail, 'references').json() == {'files': []}
    path = Path(state['download_path']) / 'thumbnail.png'; Image.new('RGB', (100, 80), 'black').save(path)
    assert result(client, p, thumbnail, path).status_code == 200
    scene = media_job(client, p); claim(client, p, scene)
    assert 'PROJECT CHARACTER REFERENCE' in scene['prompt'] and 'Brown eyes' in scene['prompt']
    assert owned_post(client, p, scene, 'references').json() == {'files': []}
    path = path.with_name('scene_001.png'); Image.new('RGB', (100, 80), 'green').save(path)
    completed = result(client, p, scene, path).json()
    video = media_job(client, p); claim(client, p, video)
    files = owned_post(client, p, video, 'references').json()['files']
    assert len(files) == 1 and files[0]['asset_id'] == completed['asset_id']
    assert files[0]['mime'] == 'image/jpeg' and files[0]['name'].startswith('sf_ref_')
    with Image.open(io.BytesIO(base64.b64decode(files[0]['data']))) as image:
        assert image.size == (100, 80)
    detail = client.get('/api/projects/' + p['id']).json()
    assert detail['settings']['character_references']['asset_ids'] == [completed['asset_id']]
    assert detail['settings']['character_references']['manual'] is False
    with client.app.state.database.session() as db:
        db.query(Scene).filter_by(project_id=p['id'], number=1).delete()
        db.commit()
    assert owned_post(client, p, video, 'references').json()['files'] == files


def test_reference_selection_is_validated_snapshot_is_fixed_and_changes_allowed_during_tts(client, production):
    p = production; a = image_asset(client, p)
    start(client, p)
    for bad in ([a, a], [{'id': a}], [a] * 4, ['foreign'], 'not a list'):
        assert client.post(p['path'] + '/references', json={'asset_ids': bad}).status_code == 422
    assert client.post(p['path'] + '/references', json={'asset_ids': [a]}).status_code == 200
    client.post(p['path'] + '/stop')
    visuals(client, p)
    thumbnail = media_job(client, p); claim(client, p, thumbnail); fail(client, p, thumbnail)
    scene = media_job(client, p); claim(client, p, scene)
    files = owned_post(client, p, scene, 'references').json()['files']
    assert files[0]['asset_id'] == a
    assert client.post(p['path'] + '/references', json={'asset_ids': []}).status_code == 422
    Image.new('RGB', (80, 50), 'red').save(client.app.state.root / 'person.png')
    response = owned_post(client, p, scene, 'references')
    assert response.status_code == 422 and 'file changed' in response.text
    client.post(p['path'] + '/stop')
    assert client.post(p['path'] + '/references', json={'asset_ids': []}).status_code == 200


def test_reference_confirmation_invalidates_if_user_changes_images_before_queuing(client, production):
    p = production; a = image_asset(client, p)
    preview = client.get(p['path'] + '/preview').json()
    assert client.post(p['path'] + '/references', json={'asset_ids': [a]}).status_code == 200
    response = client.post(p['path'] + '/start', json={'kind': 'visuals', **{k: preview[k] for k in ('confirmation', 'image_count', 'video_count')}})
    assert response.status_code == 422
