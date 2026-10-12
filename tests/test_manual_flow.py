"""Flow must never consume automatic generation credits or block image jobs."""
import copy

import pytest
from fastapi.testclient import TestClient

from backend.intelligence import digest
from backend.media_automation import target_hash
from backend.models import Asset, Job, Project, Scene, serialize
from test_media_automation import production, start, media_job, claim


@pytest.mark.parametrize('mode', ['manual', 'assisted', 'auto'])
@pytest.mark.parametrize('regenerate', [False, True])
def test_flow_is_excluded_in_every_mode_and_existing_video_is_preserved(client, production, mode, regenerate):
    p=production
    client.patch('/api/settings',json={'pipeline_mode':mode}).raise_for_status()
    with client.app.state.database.session() as db:
        project=db.get(Project,p['id'])
        video=db.query(Scene).filter_by(project_id=p['id'],visual_type='VIDEO').one()
        path=client.app.state.root/'existing.mp4'
        path.write_bytes(b'Existing video is preserved, not regenerated')
        asset=Asset(project_id=p['id'],kind='video',story_version=project.story_version,path='existing.mp4',name='scene_002.mp4',duration=10)
        db.add(asset);db.flush();video.asset_id=asset.id
        db.commit()
        original=[serialize(s) for s in db.query(Scene).filter_by(project_id=p['id']).order_by(Scene.number)]
    preview=client.get(p['path']+'/preview').json()
    batch=start(client,p,'visuals',regenerate=regenerate,**{k:preview[k] for k in ('confirmation','image_count','video_count')})
    assert batch['total']==4 and batch['manual_video_count']==1
    current=media_job(client,p)
    with client.app.state.database.session() as db:
        queued=[current['media'],*db.get(Project,p['id']).settings['media_automation']['pending']]
        assert all(item['kind']=='image_generation' and item['provider']=='gemini' for item in queued)
        assert {item.get('variant_id') for item in queued if item['target_type']=='thumbnail'}=={'A','B','C'}
        assert [serialize(s) for s in db.query(Scene).filter_by(project_id=p['id']).order_by(Scene.number)]==original
    assert path.read_bytes()==b'Existing video is preserved, not regenerated'


def test_legacy_flow_requests_are_hidden_and_cannot_obtain_a_send_permit(client,production):
    p=production
    with client.app.state.database.session() as db:
        old=Job(project_id=p['id'],kind='video_generation',provider='flow',status='waiting_user',attempts=1,
                payload={'_media':{'target_type':'scene'}},prompt='Old video prompt')
        db.add(old);db.flush();identifier=old.id;db.commit()
    assert not client.get('/api/bridge/jobs',headers=p['headers']).json()['items']
    response=client.post('/api/bridge/media/'+identifier+'/claim',headers=p['headers'],json={'owner':'old-bridge','attempt':1,'authorize_send':True})
    assert response.status_code==422 and 'manually' in response.text
    with client.app.state.database.session() as db:
        assert '_media_claim' not in db.get(Job,identifier).payload
    response=client.post('/api/jobs',json={'project_id':p['id'],'kind':'video_generation','payload':{'prompt':'New request'}})
    assert response.status_code==422 and 'manually' in response.text


@pytest.mark.parametrize('phase',['claimed','sent'])
def test_startup_releases_old_flow_job_and_continues_images_without_changing_sessions(client,production,phase):
    from backend.api import create_app
    p=production
    root=client.app.state.root
    flow_session={'url':'https://flow.google.com/project/our-story','last_prompt':'Keep this original prompt'}
    with client.app.state.database.session() as db:
        project=db.get(Project,p['id'])
        video=db.query(Scene).filter_by(project_id=p['id'],number=2).one()
        image=db.query(Scene).filter_by(project_id=p['id'],number=1).one()
        folder='Our story';download=root/'Downloads'/folder;download.mkdir(parents=True)
        common={'project_id':p['id'],'batch_id':'legacy-batch','folder':folder,'download_path':str(download),'story_version':1}
        descriptor={**common,'kind':'video_generation','provider':'flow','target_type':'scene','target_id':video.id,
                    'source_hash':target_hash(video),'filename':'scene_002.mp4','prompt':'Keep this video prompt'}
        old=Job(project_id=p['id'],kind='video_generation',provider='flow',status='waiting_user',attempts=1,prompt=descriptor['prompt'],
                payload={'_media':descriptor,'_draft_hash':digest(project.draft),'_media_claim':{'owner':'old-bridge','attempt':1,'phase':phase}})
        db.add(old);db.flush();identifier=old.id
        pending={'kind':'image_generation','provider':'gemini','target_type':'scene','target_id':image.id,
                 'source_hash':target_hash(image),'filename':'scene_001.png','prompt':'Keep this image prompt'}
        project.settings={**project.settings,'media_sessions':{'flow':flow_session},'media_automation':{
            'id':'legacy-batch','kind':'visuals','phase':'running','story_version':1,'draft_hash':digest(project.draft),
            'folder':folder,'download_path':str(download),'total':2,'completed':0,'failed':0,'skipped':0,
            'pending':[pending],'current_job_id':identifier}}
        original=[serialize(s) for s in (image,video)]
        db.commit()
    # Exercise the actual application startup migration, including a submitted
    # request whose provider tab must be left for the user to handle manually.
    app=create_app(root)
    with TestClient(app):
        automation=app.state.workflow.media_automation
        with app.state.database.session() as db:
            project=db.get(Project,p['id']);old=db.get(Job,identifier)
            assert old.status=='cancelled' and old.result['manual_video']
            assert old.prompt=='Keep this video prompt' and old.payload['_media_claim']['phase']==phase
            assert project.settings['media_sessions']['flow']==flow_session
            state=project.settings['media_automation']
            assert state['total']==1 and state['manual_video_count']==1 and not state['failed']
            next_job=db.get(Job,state['current_job_id'])
            assert next_job.provider=='gemini' and next_job.prompt=='Keep this image prompt'
            assert not next_job.payload.get('_media_claim')
            assert [serialize(s) for s in db.query(Scene).filter_by(project_id=p['id']).order_by(Scene.number)]==original
            saved=copy.deepcopy(project.settings)
        assert automation.manualize_videos()==0
        with app.state.database.session() as db:
            assert db.get(Project,p['id']).settings==saved


def test_pending_flow_item_is_removed_without_resetting_current_image_send_claim(client,production):
    p=production
    preview=client.get(p['path']+'/preview').json()
    start(client,p,'visuals',**{k:preview[k] for k in ('confirmation','image_count','video_count')})
    current=media_job(client,p);claim(client,p,current)
    with client.app.state.database.session() as db:
        project=db.get(Project,p['id']);state=project.settings['media_automation']
        project.settings={**project.settings,'media_automation':{**state,'total':state['total']+1,
            'pending':[{'kind':'video_generation','provider':'flow','prompt':'Old pending clip'},*state['pending']]}}
        saved_claim=copy.deepcopy(db.get(Job,current['id']).payload['_media_claim'])
        db.commit()
    assert client.app.state.workflow.media_automation.manualize_videos()==0
    with client.app.state.database.session() as db:
        state=db.get(Project,p['id']).settings['media_automation']
        assert state['current_job_id']==current['id'] and state['total']==4
        assert not any(item['provider']=='flow' for item in state['pending'])
        assert db.get(Job,current['id']).payload['_media_claim']==saved_claim
