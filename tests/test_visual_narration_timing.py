import pytest
from backend.visual_planning import narration_clock, balance_scene_ranges
from backend.media import timeline_from_audio
from backend.models import Project, Scene, Chunk, Job, Asset
from backend.config import DEFAULT_SETTINGS


def story(count):
    return ' '.join(f'word{i}' for i in range(count))


def plan(kinds, count):
    return [{'id': str(i), 'number': i + 1, 'visual_type': kind,
             'start_word': round(count * i / len(kinds)), 'end_word': round(count * (i + 1) / len(kinds)),
             'continuity': {'timing_policy': {'version': 1, 'video_seconds': 10, 'narration_word_count': count}}}
            for i, kind in enumerate(kinds)]


@pytest.mark.parametrize('wpm', [90, 150, 240])
def test_reserves_ten_seconds_and_keeps_every_word_in_order(wpm):
    clock, mode = narration_clock(story(110), wpm)
    items = plan(['IMAGE', 'VIDEO', 'IMAGE', 'VIDEO', 'IMAGE'], 110)
    spans = balance_scene_ranges(items, clock)
    assert mode == 'estimated'
    assert spans[0]['start_word'] == 0 and spans[-1]['end_word'] == 110
    assert all(a['end_word'] == b['start_word'] for a, b in zip(spans, spans[1:]))
    assert all(s['end_word'] > s['start_word'] for s in spans)
    assert all(span['narration_duration'] >= 10 - 1e-7 for item, span in zip(items, spans) if item['visual_type'] == 'VIDEO')


def test_images_keep_equal_cuts_and_measured_clock_excludes_outro():
    text = story(100)
    chunks = [{'number': 1, 'text': text, 'real_duration': 40},
              {'number': 2, 'text': 'Thank you for watching', 'real_duration': 9.4}]
    clock, mode = narration_clock(text, 150, chunks)
    assert mode == 'actual' and clock[-1] == 40
    spans = balance_scene_ranges(plan(['IMAGE'] * 4, 100), clock)
    assert [s['end_word'] for s in spans] == [25, 50, 75, 100]


def test_missing_or_stale_audio_uses_estimate():
    text = story(100)
    for duration, status in [(None, 'PENDING'), (2, 'STALE')]:
        clock, mode = narration_clock(text, 150, [{'number': 1, 'text': text, 'real_duration': duration, 'status': status}])
        assert mode == 'estimated' and clock[-1] == 40


def test_pending_outro_does_not_hide_complete_story_audio():
    text = story(100)
    chunks = [{'number': 1, 'text': text, 'real_duration': 35},
              {'number': 2, 'text': 'Thank you', 'real_duration': None, 'voice_profile': {'segment_role': 'outro'}}]
    clock, mode = narration_clock(text, 150, chunks)
    assert mode == 'actual' and clock[-1] == 35


def test_final_video_has_ten_seconds_before_the_outro():
    text = story(50)
    clock, _ = narration_clock(text, 150)
    spans = balance_scene_ranges(plan(['IMAGE', 'IMAGE', 'VIDEO'], 50), clock)
    assert spans[-1]['narration_duration'] >= 10
    assert spans[-1]['end_word'] == 50


def test_rebalances_fast_and_slow_real_narration():
    text = story(150)
    chunks = [{'number': 1, 'text': story(100), 'real_duration': 20},
              {'number': 2, 'text': ' '.join(text.split()[100:]), 'real_duration': 50}]
    clock, mode = narration_clock(text, 150, chunks)
    spans = balance_scene_ranges(plan(['IMAGE', 'VIDEO', 'IMAGE', 'VIDEO', 'IMAGE'], 150), clock)
    assert mode == 'actual'
    assert spans[1]['narration_duration'] >= 10
    assert spans[1]['end_word'] > 60  # Old equal cut left only six seconds.
    assert spans[3]['narration_duration'] >= 10


def test_short_audio_cannot_borrow_the_outro_to_fit_a_video():
    text = story(100)
    clock, _ = narration_clock(text, 150, [{'number': 1, 'text': text, 'real_duration': .04},
                                         {'number': 2, 'text': 'Closing thank you', 'real_duration': 30}])
    with pytest.raises(ValueError, match='Not enough narration'):
        balance_scene_ranges(plan(['IMAGE', 'VIDEO', 'IMAGE'], 100), clock)


@pytest.mark.parametrize('seconds', [10, 12])
def test_actual_sync_reserves_native_video_without_moving_resynced_start(seconds):
    chunks = [{'id': 'c', 'number': 1, 'text': story(90), 'real_duration': 24}]
    scenes = [{**s, 'asset_id': str(i)} for i, s in enumerate(plan(['IMAGE', 'VIDEO', 'IMAGE'], 90))]
    assets = [{'id': str(i), 'kind': 'video' if i == 1 else 'image', 'duration': seconds} for i in range(3)]
    result = timeline_from_audio(chunks, scenes, assets)
    rows = result['scenes']
    assert rows[1]['narration_duration'] >= seconds
    assert rows[1]['duration'] == seconds and rows[1]['offset'] == 8
    assert sum(r['duration'] for r in rows) == pytest.approx(24)
    synced = [{**s, **t} for s, t in zip(scenes, rows)]
    assert timeline_from_audio(chunks, synced, assets) == result
    with pytest.raises(ValueError, match='synced video start will not be moved'):
        timeline_from_audio([{**chunks[0], 'real_duration': 15}], synced, assets)


def test_failed_new_plan_keeps_old_scenes_and_assignments(client, project):
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        p.draft, p.locked = story(40), True
        old = Scene(project_id=p.id, story_version=p.story_version, number=1, scene_key='scene_001', text=p.draft,
                    start_word=0, end_word=40, visual_type='IMAGE', prompt='existing', asset_id='existing-media')
        db.add(old); db.commit()
        old_id = old.id
        j = Job(project_id=p.id, kind='visual_director', provider='chatgpt', payload={'mode': 'custom', 'image_count': 1, 'video_count': 2})
        items = [{'visual_type': k, 'prompt': 'new'} for k in ['VIDEO', 'IMAGE', 'VIDEO']]
        with pytest.raises(ValueError, match='Not enough narration'):
            client.app.state.workflow.apply_output(db, j, p, {'scenes': items})
        assert db.get(Scene, old_id).asset_id == 'existing-media'
        assert db.query(Scene).filter_by(project_id=p.id).count() == 1


def test_workflow_stores_balanced_plan_and_sync_word_ranges(client, project):
    workflow = client.app.state.workflow
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        p.draft, p.locked = story(90), True
        j = Job(project_id=p.id, kind='visual_director', provider='chatgpt', payload={'mode': 'custom', 'image_count': 2, 'video_count': 1})
        workflow.apply_output(db, j, p, {'scenes': [{'visual_type': k, 'prompt': 'test'} for k in ['IMAGE', 'VIDEO', 'IMAGE']]})
        db.commit()
        scenes = db.query(Scene).filter_by(project_id=p.id).order_by(Scene.number).all()
        assert scenes[1].end_word - scenes[1].start_word >= 25
        assert scenes[1].continuity['narration_timing'] == 'estimated'
    from test_media import wav_data
    upload = client.post('/api/projects/' + project['id'] + '/assets', files=[('files', ('tts_001.wav', wav_data(24), 'audio/wav'))])
    assert upload.status_code == 200, upload.text
    # Seed its matching chunk; sync uses the real file through ffprobe.
    with client.app.state.database.session() as db:
        asset = db.query(Asset).filter_by(project_id=project['id'], kind='audio').one()
        db.add(Chunk(project_id=project['id'], story_version=project['story_version'], number=1, text=story(90),
                     word_count=90, estimated_duration=36, asset_id=asset.id, status='ATTACHED'))
        db.commit()
    result = workflow.local_job('unused', 'sync', project['id'], DEFAULT_SETTINGS)
    assert result['scenes'][1]['narration_duration'] >= 10
    with client.app.state.database.session() as db:
        scenes = db.query(Scene).filter_by(project_id=project['id']).order_by(Scene.number).all()
        assert scenes[1].end_word == 68
        assert scenes[1].continuity['narration_timing'] == 'actual'
        assert scenes[1].text == ' '.join(story(90).split()[30:68])
