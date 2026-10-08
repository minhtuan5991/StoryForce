import pytest

from backend.audience import timed_zones
from backend.config import DEFAULT_SETTINGS
from backend.intelligence import duration_profile
from backend.media import timeline_from_audio
from backend.models import Job, Project, Scene
from backend.visual_planning import narration_clock, opening_layout, visual_budget
from conftest import build_story, job


def text(count):
    return ' '.join(f'word{i}' for i in range(count))


@pytest.mark.parametrize('minutes', [1, 5, 20, 60])
def test_profile_front_loads_question_and_conflict_with_midpoint_climax(minutes):
    beats = {b['label']: b['seconds'] for b in duration_profile(minutes)['retention_map']}
    assert beats['Hook'] == 0 and beats['Question'] == 3 and beats['Conflict'] == 10
    assert beats['Climax'] == round(minutes * 60 * .45)
    assert beats['Reveal'] == round(minutes * 60 * .5)
    assert beats['Payoff'] == round(minutes * 60 * .95)


def test_structure_evidence_uses_current_draft_length_and_keeps_zone_contract():
    timing = timed_zones(text(1000), 100)
    assert timing['midpoint_target_seconds'] == [270, 330]
    windows = {w['id']: w for w in timing['structure_windows']}
    assert windows['midpoint']['text'] == ' '.join(text(1000).split()[400:600])
    assert windows['aftermath']['text'] == ' '.join(text(1000).split()[550:900])
    assert windows['ending']['text'] == ' '.join(text(1000).split()[900:])
    assert timing['zones'][0]['id'] == '0-10'
    assert not {'midpoint', 'aftermath', 'ending'}.intersection(z['id'] for z in timing['zones'])


def test_creative_and_audit_steps_share_midpoint_policy_even_with_custom_template(client, project):
    folder = client.app.state.root / 'prompts'
    folder.mkdir(exist_ok=True)
    (folder / 'full_draft.md').write_text('Legacy workspace template. Return a narration JSON.', encoding='utf-8')
    build_story(client, project)
    with client.app.state.database.session() as db:
        for kind in ('premise_generation', 'premise_mini_test', 'story_bible', 'outline', 'outline_rewrite',
                     'opening_variants', 'full_draft', 'retention_audit'):
            current = db.query(Job).filter_by(project_id=project['id'], kind=kind).first()
            assert '45–55%' in current.prompt and '0–10 seconds' in current.prompt, kind
            assert 'do not invent threats' in current.prompt, kind
        draft = db.query(Job).filter_by(project_id=project['id'], kind='full_draft').one()
        assert 'Legacy workspace template' in draft.prompt


@pytest.mark.parametrize('minutes', [1, 5, 20, 240])
def test_standard_budget_limits_opening_to_two_or_three_without_changing_custom_counts(minutes):
    p = {'target_minutes': minutes, 'wpm': 150, 'settings': {}}
    standard = visual_budget(p, DEFAULT_SETTINGS)
    assert 2 <= standard['video_count'] <= 3
    assert standard['opening_video_count'] == standard['video_count']
    assert visual_budget(p, {**DEFAULT_SETTINGS, 'visual_video_ratio': 0})['video_count'] == 0
    for videos in (0, 1, 2, 3, 7):
        custom = visual_budget(p, DEFAULT_SETTINGS, {'mode': 'custom', 'image_count': 4, 'video_count': videos})
        layout = opening_layout(custom, narration_clock(text(2000), 150)[0])
        assert sum(s['visual_type'] == 'VIDEO' for s in layout) == videos
        assert all(s['visual_type'] == 'VIDEO' for s in layout[:min(3, videos)])
        assert layout[0]['start_word'] == 0 and layout[-1]['end_word'] == 2000


@pytest.mark.parametrize('videos', [2, 3])
def test_long_story_opening_clips_take_ten_seconds_each_not_equal_scene_shares(videos):
    budget = {'count': videos + 12, 'video_count': videos, 'opening_video_count': videos}
    layout = opening_layout(budget, narration_clock(text(3000), 150)[0])
    assert [s['visual_type'] for s in layout[:videos]] == ['VIDEO'] * videos
    assert [s['narration_duration'] for s in layout[:videos]] == pytest.approx([10] * videos)
    assert layout[videos]['start_seconds'] == videos * 10
    assert all(a['end_word'] == b['start_word'] for a, b in zip(layout, layout[1:]))


def test_new_plan_prompt_and_saved_word_ranges_match_the_opening_layout(client, project):
    build_story(client, project)
    output = job(client, project, 'visual_director', {'mode': 'custom', 'image_count': 3, 'video_count': 2})
    assert [s['visual_type'] for s in output['scenes']] == ['VIDEO', 'VIDEO', 'IMAGE', 'IMAGE', 'IMAGE']
    with client.app.state.database.session() as db:
        record = db.query(Job).filter_by(project_id=project['id'], kind='visual_director').one()
        scenes = db.query(Scene).filter_by(project_id=project['id']).order_by(Scene.number).all()
        assert record.payload['_visual_layout'][0]['start_word'] == 0
        assert 'first 2 scenes are consecutive opening VIDEO clips' in record.prompt
        assert 'narration_scenes' in record.prompt
        assert scenes[0].end_word == 25 and scenes[1].end_word == 50
        assert all(s.continuity['timing_policy']['version'] == 2 for s in scenes)


def test_invalid_ai_reordering_preserves_existing_plan(client, project):
    build_story(client, project)
    job(client, project, 'visual_director', {'mode': 'custom', 'image_count': 3, 'video_count': 2})
    old_ids = [s['id'] for s in client.get('/api/projects/' + project['id']).json()['scenes']]
    client.patch('/api/settings', json={'provider_mode': 'browser'})
    submitted = client.post('/api/jobs', json={'project_id': project['id'], 'kind': 'visual_director',
                                             'payload': {'mode': 'custom', 'image_count': 3, 'video_count': 2}}).json()
    with client.app.state.database.session() as db:
        record = db.get(Job, submitted['id'])
        p = db.get(Project, project['id'])
        with pytest.raises(ValueError, match='opening video order'):
            client.app.state.workflow.apply_output(db, record, p, {'scenes': [
                {'visual_type': kind, 'prompt': 'Action from a different narration segment'}
                for kind in ('IMAGE', 'VIDEO', 'VIDEO', 'IMAGE', 'IMAGE')]})
    assert [s['id'] for s in client.get('/api/projects/' + project['id']).json()['scenes']] == old_ids


def synced_opening(videos=3):
    count, seconds = 333, 140
    chunks = [{'id': 'n', 'number': 1, 'text': text(count), 'real_duration': seconds}]
    clock = narration_clock(text(count), 150, chunks)[0]
    layout = opening_layout({'count': videos + 2, 'video_count': videos, 'opening_video_count': videos}, clock)
    scenes = [{**s, 'id': str(i), 'number': i + 1, 'asset_id': str(i),
               'continuity': {'timing_policy': {'version': 2, 'narration_word_count': count,
                                               'opening_video_count': videos}}} for i, s in enumerate(layout)]
    assets = [{'id': s['id'], 'kind': 'video' if i < videos else 'image', 'duration': 10 if i < videos else None}
              for i, s in enumerate(scenes)]
    return chunks, scenes, assets


def test_real_audio_rounding_plays_opening_clips_from_zero_back_to_back_and_resync_is_stable():
    chunks, scenes, assets = synced_opening()
    result = timeline_from_audio(chunks, scenes, assets)
    assert [s['offset'] for s in result['scenes'][:3]] == [0, 10, 20]
    assert [s['duration'] for s in result['scenes'][:3]] == [10, 10, 10]
    assert result['scenes'][3]['offset'] == 30
    assert sum(s['duration'] for s in result['scenes']) == pytest.approx(140)
    saved = [{**s, **row} for s, row in zip(scenes, result['scenes'])]
    assert timeline_from_audio(chunks, saved, assets) == result


def test_opening_video_replaced_with_image_keeps_its_narration_slot():
    chunks, scenes, assets = synced_opening()
    assets[0]['kind'], assets[0]['duration'] = 'image', None
    result = timeline_from_audio(chunks, scenes, assets)
    assert result['scenes'][0]['media_kind'] == 'image'
    assert result['scenes'][0]['duration'] >= 10
    assert result['scenes'][1]['offset'] >= 10


def test_short_recorded_audio_cannot_fit_three_opening_clips():
    chunks, scenes, assets = synced_opening()
    with pytest.raises(ValueError, match='Not enough narration'):
        timeline_from_audio([{**chunks[0], 'real_duration': 25}], scenes, assets)


def test_custom_extra_video_group_keeps_counts_and_fills_the_end_without_an_extra_image():
    count = 333
    chunks = [{'id': 'n', 'number': 1, 'text': text(count), 'real_duration': 140}]
    budget = {'count': 11, 'video_count': 10, 'opening_video_count': 3}
    layout = opening_layout(budget, narration_clock(text(count), 150, chunks)[0])
    scenes = [{**s, 'id': str(i), 'number': i + 1, 'asset_id': str(i),
               'continuity': {'timing_policy': {'version': 2, 'narration_word_count': count,
                                               'opening_video_count': 3}}} for i, s in enumerate(layout)]
    assets = [{'id': s['id'], 'kind': s['visual_type'].lower(), 'duration': 10 if s['visual_type']=='VIDEO' else None} for s in scenes]
    timeline = timeline_from_audio(chunks, scenes, assets)
    assert [s['offset'] for s in timeline['scenes'][:3]] == [0, 10, 20]
    assert len(timeline['scenes']) == 11 and sum(s['media_kind']=='video' for s in timeline['scenes']) == 10
    assert timeline['scenes'][-1]['offset'] + timeline['scenes'][-1]['duration'] == pytest.approx(140)
    assert sum(s['duration'] for s in timeline['scenes']) == pytest.approx(140)
    saved = [{**s, **row} for s, row in zip(scenes, timeline['scenes'])]
    assert timeline_from_audio(chunks, saved, assets) == timeline


def test_real_render_starts_with_two_native_clips_then_the_image(client, project, tmp_path):
    import io
    import subprocess
    from PIL import Image
    from backend.models import Chunk
    from backend.media import find_binary, probe
    from test_media import wav_data

    binary = find_binary('ffmpeg', DEFAULT_SETTINGS)
    if not binary:
        pytest.skip('FFmpeg unavailable')
    url = '/api/projects/' + project['id']
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        p.draft, p.locked, p.story_version = text(100), True, 1
        db.add(Chunk(project_id=p.id, story_version=1, number=1, text=p.draft,
                     word_count=100, estimated_duration=40, status='PENDING'))
        db.commit()
    assert client.post(url + '/assets', files=[('files', ('tts_001.wav', wav_data(25), 'audio/wav'))]).status_code == 200
    job(client, project, 'visual_director', {'mode': 'custom', 'image_count': 1, 'video_count': 2})
    for number, color in ((1, 'red'), (2, 'blue')):
        source = tmp_path / f'scene_{number:03}.mp4'
        subprocess.run([binary, '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
                        f'color=c={color}:s=320x180:r=12', '-t', '10', '-c:v', 'libx264',
                        '-threads', '1', '-pix_fmt', 'yuv420p', str(source)], check=True, capture_output=True)
        uploaded = client.post(url + '/assets', files=[('files', (source.name, source.read_bytes(), 'video/mp4'))])
        assert uploaded.status_code == 200, uploaded.text
    picture = io.BytesIO(); Image.new('RGB', (320, 180), (0, 180, 0)).save(picture, format='PNG')
    assert client.post(url + '/assets', files=[('files', ('scene_003.png', picture.getvalue(), 'image/png'))]).status_code == 200
    timeline = job(client, project, 'sync')
    assert [s['offset'] for s in timeline['scenes']] == [0, 10, 20]
    assert client.patch('/api/settings', json={'render_width': 320, 'render_height': 180,
                                              'render_fps': 12, 'render_encoder': 'cpu'}).status_code == 200
    report = job(client, project, 'render')
    assert report['status'] == 'READY', report
    output = tmp_path / 'final_video.mp4'
    output.write_bytes(client.get(url + '/download/final_video.mp4').content)
    assert probe(output, DEFAULT_SETTINGS)['duration'] == pytest.approx(25, abs=.1)
    for seconds, channel in ((1, 0), (11, 2), (21, 1)):
        frame = tmp_path / f'frame_{seconds}.png'
        subprocess.run([binary, '-v', 'error', '-nostdin', '-y', '-ss', str(seconds), '-i', str(output),
                        '-frames:v', '1', str(frame)], check=True, capture_output=True)
        with Image.open(frame) as image:
            pixel = image.convert('RGB').getpixel((160, 60))
            assert pixel[channel] > max(value for i, value in enumerate(pixel) if i != channel) + 80
