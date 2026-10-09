import json

import pytest

from backend.models import Artifact, Job, Scene
from conftest import build_story


MOVED_TEXT_JOBS = (
    'story_dna', 'channel_fit', 'discovery',
    'outline_audit', 'retention_audit', 'visual_director',
)


@pytest.mark.parametrize('kind', MOVED_TEXT_JOBS)
@pytest.mark.parametrize('legacy_pending', [False, True], ids=['new-chatgpt', 'pending-gemini'])
def test_text_routing_accepts_results_and_preserves_pending_provider(client, project, kind, legacy_pending):
    client.patch('/api/settings', json={'pipeline_mode': 'manual'})
    if kind in ('outline_audit', 'retention_audit', 'visual_director'):
        detail = build_story(client, project)
        if kind == 'retention_audit':
            response = client.patch('/api/projects/' + project['id'], json={
                'draft': detail['draft'] + '\n\nA light shone along the shore.',
            })
            assert response.status_code == 200, response.text

    client.patch('/api/settings', json={'provider_mode': 'browser'})
    headers = {'X-Bridge-Token': client.post('/api/settings/pair-bridge').json()['token']}
    request = {'kind': kind}
    if kind == 'story_dna':
        request['source_id'] = project['source_id']
    elif kind == 'discovery':
        request['channel_id'] = project['channel_id']
    else:
        request['project_id'] = project['id']
    response = client.post('/api/jobs', json=request)
    assert response.status_code == 200, response.text
    job_id = response.json()['id']

    with client.app.state.database.session() as db:
        pending = db.get(Job, job_id)
        assert pending.status == 'waiting_user'
        assert pending.provider == 'chatgpt'
        assert pending.attempts == 1
        context = client.app.state.workflow.context(db, pending)
        if kind == 'channel_fit':
            output = {'channels': [{
                'channel_id': project['channel_id'], 'score': 75,
                'reasons': ['A source with a concrete mystery and consequential choices.'],
                'conflicts': [], 'adaptation_opportunity': 'Develop an original station mystery.',
            }]}
        elif kind == 'visual_director':
            layout = context['payload']['narration_scenes']
            output = {'scenes': [{
                'scene_id': f'scene_{index:03}', 'visual_type': span['visual_type'],
                'prompt': 'A photorealistic live-action view of Mara at the coastal radio station, lit by practical instrument lights.',
                'negative_prompt': 'Illustration, changed identity, text or logos',
                'continuity_references': ['Mara: navy jacket'],
                'camera': 'Steady medium shot', 'motion': 'A slow push toward the radio console',
            } for index, span in enumerate(layout, 1)]}
        else:
            output = client.app.state.workflow.mock.generate(kind, context, pending.prompt)
        if legacy_pending:
            # Simulate a durable job sent before the routing update. Its
            # response must still be collected from the recorded provider.
            pending.provider = 'gemini'
            pending.result = {**pending.result, 'provider': 'gemini',
                              'url': 'https://gemini.google.com/app'}
            db.commit()
        provider = 'gemini' if legacy_pending else 'chatgpt'
        original_prompt = pending.prompt

    items = client.get('/api/bridge/jobs', headers=headers).json()['items']
    queued = next(item for item in items if item['id'] == job_id)
    assert queued['provider'] == provider
    assert queued['url'] == ('https://gemini.google.com/app' if legacy_pending else 'https://chatgpt.com/')
    assert queued['prompt'] == original_prompt
    assert queued['media'] is None
    claim = client.post('/api/bridge/jobs/' + job_id + '/claim', headers=headers, json={
        'owner': 'routing-browser', 'attempt': 1, 'authorize_send': True,
    })
    assert claim.status_code == 200 and claim.json()['send'] is True
    result = client.post('/api/bridge/jobs/' + job_id + '/result', headers=headers, json={
        'attempt': 1, 'result': json.dumps(output),
    })
    assert result.status_code == 200, result.text

    with client.app.state.database.session() as db:
        completed = db.get(Job, job_id)
        assert completed.status == 'completed'
        assert completed.provider == provider
        assert completed.attempts == 1
        artifact = db.query(Artifact).filter_by(
            kind=kind, project_id=request.get('project_id'),
            source_id=request.get('source_id'), channel_id=request.get('channel_id'),
        ).order_by(Artifact.created_at.desc()).first()
        assert artifact is not None and artifact.provider == provider
        assert artifact.content == completed.result
        if kind == 'visual_director':
            scenes = db.query(Scene).filter_by(project_id=project['id']).order_by(Scene.number).all()
            assert [scene.visual_type for scene in scenes] == [span['visual_type'] for span in layout]
            assert scenes[0].start_word == 0
            assert scenes[0].continuity['timing_policy']['opening_video_count'] == 2
    assert all(item['id'] != job_id for item in client.get('/api/bridge/jobs', headers=headers).json()['items'])
