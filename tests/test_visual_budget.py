import math
import pytest
from backend.config import DEFAULT_SETTINGS
from backend.visual_planning import visual_budget
from backend.models import Project, Job
from conftest import build_story, job


def test_minimum_halves_images_and_videos_separately():
    p={'target_minutes':45,'wpm':150,'settings':{}}
    standard=visual_budget(p,DEFAULT_SETTINGS)
    minimum=visual_budget(p,DEFAULT_SETTINGS,{'mode':'minimum'})
    assert minimum['image_count']==math.ceil(standard['image_count']/2)
    assert minimum['video_count']==math.ceil(standard['video_count']/2)
    assert minimum['image_count']>=1


def test_custom_budget_is_exact_and_rejects_invalid_counts():
    p={'target_minutes':10,'wpm':150,'settings':{}}
    assert visual_budget(p,DEFAULT_SETTINGS,{'mode':'custom','image_count':5,'video_count':3})['count']==8
    for images,videos in ((0,1),(2,-1),(199,2),(True,0),(2.5,1),(None,1)):
        with pytest.raises(ValueError):visual_budget(p,DEFAULT_SETTINGS,{'mode':'custom','image_count':images,'video_count':videos})


def test_saved_counts_reach_prompt_and_output_and_existing_scene_labels(client,project):
    build_story(client,project)
    base='/api/projects/'+project['id']
    assert client.patch(base+'/visual-options',json={'mode':'custom','image_count':3,'video_count':2}).status_code==200
    result=job(client,project,'visual_director')
    assert len(result['scenes'])==5
    assert sum(s['visual_type']=='VIDEO' for s in result['scenes'])==2
    p=client.get(base).json()
    assert [s['scene_key'] for s in p['scenes']]==[f'scene_{i:03}' for i in range(1,6)]
    with client.app.state.database.session() as db:
        j=db.query(Job).filter_by(project_id=project['id'],kind='visual_director').one()
        assert 'exactly 3 IMAGE scenes and 2 VIDEO scenes' in j.prompt
        assert 'Reserve at least 10 seconds of corresponding narration' in j.prompt
        assert 'at least 25 words' in j.prompt
    assert client.patch(base+'/visual-options',json={'mode':'minimum'}).status_code==200
    assert len(client.get(base).json()['scenes'])==5  # Selection does not silently regenerate or detach media.


@pytest.mark.parametrize('mode, expected_videos', [('standard', 2), ('minimum', 1), ('efficient', 2)])
def test_default_and_minimum_plans_keep_the_prompt_video_count(client, project, mode, expected_videos):
    build_story(client, project)
    base = '/api/projects/' + project['id']
    selection = client.patch(base + '/visual-options', json={'mode': mode})
    assert selection.status_code == 200, selection.text
    result = job(client, project, 'visual_director')
    assert sum(scene['visual_type'] == 'VIDEO' for scene in result['scenes']) == expected_videos
    assert [scene['visual_type'] for scene in result['scenes'][:expected_videos]] == ['VIDEO'] * expected_videos
    detail = client.get(base).json()
    assert len(detail['scenes']) == len(result['scenes'])
    assert detail['scenes'][0]['start_word'] == 0


def test_efficient_preset_halves_images_but_preserves_opening_video_count():
    p = {'target_minutes': 45, 'wpm': 150, 'settings': {}}
    standard = visual_budget(p, DEFAULT_SETTINGS)
    efficient = visual_budget(p, DEFAULT_SETTINGS, {'mode': 'efficient'})
    assert efficient['image_count'] == math.ceil(standard['image_count'] / 2)
    assert efficient['video_count'] == standard['video_count'] == 3


def test_invalid_ai_count_keeps_existing_plan(client,project):
    build_story(client,project)
    job(client,project,'visual_director',{'count':2})
    base='/api/projects/'+project['id']
    client.patch('/api/settings',json={'provider_mode':'browser'})
    j=client.post('/api/jobs',json={'kind':'visual_director','project_id':project['id'],'payload':{'count':3}}).json()
    # Malformed AI output must fail before deleting existing scenes.
    with client.app.state.database.session() as db:
        record=db.get(Job,j['id']);p=db.get(Project,project['id'])
        with pytest.raises(ValueError,match='selected image and video counts'):
            client.app.state.workflow.apply_output(db,record,p,{'scenes':[{'visual_type':'IMAGE','prompt':'One'}]})
    assert len(client.get(base).json()['scenes'])==2
    assert client.patch(base+'/visual-options',json={'mode':'minimum'}).status_code==409
