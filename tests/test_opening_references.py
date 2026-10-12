from pathlib import Path

from PIL import Image

from backend.models import Artifact, Project, Scene
from test_media_automation import production, start, media_job, claim, fail, result
from test_media_sessions import owned_post, image_asset


def prepare(client, p):
    with client.app.state.database.session() as db:
        db.add(Artifact(project_id=p['id'], kind='story_bible', content={'characters': [
            {'name': 'Mara', 'physical_traits': 'Brown eyes, short black hair', 'age': 34}]}))
        for scene in db.query(Scene).filter_by(project_id=p['id']):
            scene.visual_type = 'VIDEO' if scene.number == 1 else 'IMAGE'
            scene.continuity = {'timing_policy': {'version': 2, 'opening_video_count': 1}}
        db.commit()
    preview = client.get(p['path'] + '/preview').json()
    return start(client, p, 'visuals', **{k: preview[k] for k in ('confirmation', 'image_count', 'video_count')})


def skip_thumbnails(client, p):
    for variant in 'ABC':
        thumbnail=media_job(client,p)
        assert thumbnail['media']['target_type']=='thumbnail' and thumbnail['media']['variant_id']==variant
        claim(client,p,thumbnail)
        assert fail(client,p,thumbnail).status_code==200


def test_reference_is_prepared_before_opening_video_and_shared_with_later_images(client, production):
    p = production
    state = prepare(client, p)
    skip_thumbnails(client,p)
    board = media_job(client, p); claim(client, p, board)
    assert board['media']['target_type'] == 'character_reference'
    assert board['media']['filename'] == 'character_reference.png'
    assert 'Mara' in board['prompt'] and 'Brown eyes' in board['prompt']
    assert state['total'] == 5 and state['confirmed_counts'] == {'images': 1, 'videos': 1}
    path = Path(state['download_path']) / 'character_reference.png'
    Image.new('RGB', (300, 180), 'blue').save(path)
    accepted = result(client, p, board, path).json()
    picture = media_job(client, p); claim(client, p, picture)
    assert picture['provider']=='gemini' and picture['media']['filename']=='scene_002.png'
    files=owned_post(client,p,picture,'references').json()['files']
    assert files[0]['asset_id']==accepted['asset_id']
    detail = client.get('/api/projects/' + p['id']).json()
    assert not any(s['asset_id'] == accepted['asset_id'] for s in detail['scenes'])
    assert detail['manual_video_references'][0]['id']==accepted['asset_id']
    assert 'Brown eyes' in detail['scenes'][0]['generation_prompt']
    assert detail['settings']['character_references']['asset_ids'] == [accepted['asset_id']]


def test_existing_manual_reference_avoids_an_extra_generation(client, production):
    p = production
    asset = image_asset(client, p)
    assert client.post(p['path'] + '/references', json={'asset_ids': [asset]}).status_code == 200
    state = prepare(client, p)
    assert state['total'] == 4
    skip_thumbnails(client,p)
    video = media_job(client, p); claim(client, p, video)
    assert video['media']['target_type'] == 'scene'
    assert owned_post(client, p, video, 'references').json()['files'][0]['asset_id'] == asset


def test_failed_reference_continues_and_is_reported_without_accepting_late_file(client, production):
    p = production
    state = prepare(client, p)
    skip_thumbnails(client,p)
    board = media_job(client, p); claim(client, p, board); fail(client, p, board)
    assert media_job(client, p)['media']['filename'] == 'scene_002.png'
    detail = client.get('/api/projects/' + p['id']).json()
    assert any(m['filename'] == 'character_reference.png' and m['automatic_failure'] for m in detail['missing_resources'])
    path = Path(state['download_path']) / 'character_reference.png'
    Image.new('RGB', (300, 180), 'red').save(path)
    assert result(client, p, board, path).status_code == 422
    assert not client.get('/api/projects/' + p['id']).json()['settings'].get('character_references', {}).get('asset_ids')


def test_cast_change_rejects_stale_reference_download(client, production):
    p = production
    state = prepare(client, p)
    skip_thumbnails(client,p)
    board = media_job(client, p); claim(client, p, board)
    with client.app.state.database.session() as db:
        bible = db.query(Artifact).filter_by(project_id=p['id'], kind='story_bible').one()
        bible.content = {'characters': [{'name': 'Mara', 'physical_traits': 'Different face'}]}
        db.commit()
    path = Path(state['download_path']) / 'character_reference.png'
    Image.new('RGB', (300, 180), 'red').save(path)
    rejected = result(client, p, board, path)
    assert rejected.status_code == 422 and 'outdated download' in rejected.text
