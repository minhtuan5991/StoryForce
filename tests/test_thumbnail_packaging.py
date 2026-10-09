import hashlib
import json
import io
from pathlib import Path
import pytest
from PIL import Image
from backend.models import Artifact, Asset, Channel, Job, Project, Scene
from backend.thumbnail_packaging import thumbnail_context, validate_plan, plan_fingerprint, ThumbnailStyle, ThumbnailPlan, output_contract
from backend.youtube_metadata import metadata_context, validate_metadata
from test_metadata_packaging import package as metadata_package
from conftest import job

DRAFT='Room 614 appeared on the hotel blueprint. Ethan worked at a print shop, but the original plans had no such room. A door appeared where the wall should have been.'


def ready(client, project):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.draft=DRAFT;p.locked=True;p.story_version=1
        p.publish={'title':'Room 614 Appeared on the Blueprint','description':'Keep this description','url':'https://youtube.com/watch?v=keep'}
        p.settings={**p.settings,'render_options':{'subtitles':False},'media_download_folder':'Stable folder'}
        db.add(Artifact(project_id=p.id,kind='story_bible',content={'primary_location':'Print shop','important_objects':['hotel blueprint','Room 614']}))
        db.add(Scene(project_id=p.id,story_version=1,number=1,scene_key='scene_001',visual_type='IMAGE',prompt='A hotel blueprint at the print shop.'))
        db.commit()
    return '/api/projects/'+project['id']


def generated(client, project):
    return job(client,project,'thumbnail_plan')


def test_concepts_are_isolated_and_do_not_modify_story_or_publishing(client,project):
    base=ready(client,project);before=client.get(base).json();output=generated(client,project)
    after=client.get(base).json()
    assert after['draft']==before['draft'] and after['publish']==before['publish'] and after['locked']
    assert after['scenes']==before['scenes'] and after['settings']==before['settings']
    assert len(output['thumbnail_variants'])==3 and after['thumbnail_packaging']['current']
    assert all(v['text_mode']=='NO_TEXT' for v in output['thumbnail_variants'])
    assert 'not CTR' in output['score_provenance']
    workflow=client.app.state.workflow
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id'])
        ctx=workflow.context(db,Job(kind='visual_director',project_id=p.id))
        assert 'thumbnail_plan' not in ctx['artifacts'] and 'thumbnail_style' not in ctx['channel']['settings']
        db.add(Artifact(project_id=p.id,kind='youtube_metadata',story_version=1,content={'title_variants':[{'title':'An editorial alternative'}]}));db.commit()
        assert output['content_fingerprint']==plan_fingerprint(db,p)  # No title/image regeneration loop.


def test_thumbnail_prompt_always_includes_the_actual_output_schema_even_with_an_old_custom_template(client,project):
    ready(client,project)
    custom=client.app.state.workflow.root/'prompts'/'thumbnail_plan.md'
    custom.write_text('Legacy customized thumbnail instructions',encoding='utf-8')
    generated(client,project)
    with client.app.state.database.session() as db:
        record=db.query(Job).filter_by(project_id=project['id'],kind='thumbnail_plan').one()
        context=thumbnail_context(db,db.get(Project,project['id']))
        assert record.prompt.startswith(output_contract(context))
        assert 'Legacy customized thumbnail instructions' in record.prompt
        schema=ThumbnailPlan.model_json_schema()
        assert schema['$defs']['VisualDNA']['properties']['threat_visibility']['maxItems']==3
        assert all(value in record.prompt for value in schema['$defs']['VisualDNA']['properties']['threat_visibility']['items']['enum'])
        assert all(name in record.prompt for name in schema['$defs']['ConceptScores']['required'])
        assert '\"maxLength\":2000' in record.prompt
    assert custom.read_text(encoding='utf-8')=='Legacy customized thumbnail instructions'


def test_thumbnail_quote_bank_uses_literal_source_sentences_and_does_not_change_plan_fingerprints(client,project):
    ready(client,project)
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);context=thumbnail_context(db,p);before=plan_fingerprint(db,p)
        contract=output_contract(context)
        schema=json.loads(contract[contract.index('{'):])
        quotes=schema['$defs']['ThumbnailVariant']['properties']['evidence_quotes']['items']['enum']
        assert quotes and all(q in DRAFT for q in quotes)
        assert quotes==schema['$defs']['VisualDNA']['properties']['evidence_quotes']['items']['enum']
        assert plan_fingerprint(db,p)==before


@pytest.mark.parametrize('change',['fake_quote','missing_variant','same_concept','bad_strategy','long_text','true_claim','unexplained_alternative'])
def test_invalid_concepts_are_rejected(client,project,change):
    ready(client,project);data=generated(client,project)
    if change=='fake_quote':data['visual_dna']['evidence_quotes']=['An unrelated demon appeared in a different story.']
    if change=='missing_variant':data['thumbnail_variants'].pop()
    if change=='same_concept':data['thumbnail_variants'][1]['concept']=data['thumbnail_variants'][0]['concept']
    if change=='bad_strategy':data['thumbnail_variants'][0]['strategy']='human_threat'
    if change=='long_text':data['thumbnail_variants'][0].update(text_mode='MICRO_HOOK',text_overlay='This headline contains far too many words')
    if change=='true_claim':data['thumbnail_variants'][0].update(text_mode='MICRO_HOOK',text_overlay='TRUE HORROR STORY')
    if change=='unexplained_alternative':data['thumbnail_variants'][1]['strategy']='alternative_evidence'
    with client.app.state.database.session() as db:
        ctx=thumbnail_context(db,db.get(Project,project['id']))
    with pytest.raises(ValueError):validate_plan(data,ctx)


def test_channel_preferences_reuse_and_stale_plan_guards(client,project):
    base=ready(client,project);generated(client,project)
    settings=ThumbnailStyle().model_dump();settings.update(text_usage='SHORT_TEXT',color_mode='STORY_DRIVEN',typography='SINGLE_BOLD_FONT')
    settings['research_evidence']=[{'claim':'One object leads the composition','evidence_type':'OBSERVED_CHANNEL_PATTERN','source':'https://youtube.com/watch?v=example','observed_on':'2026-10-07'}]
    assert client.patch(base+'/thumbnail-style',json=settings).status_code==200
    state=client.get(base+'/thumbnail-packaging').json();assert not state['current']
    other=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Other project'}).json()
    assert client.get('/api/projects/'+other['id']+'/thumbnail-packaging').json()['channel_style']==settings
    output=generated(client,project)
    assert all(v['text_overlay'] for v in output['thumbnail_variants'])
    settings['research_evidence'][0]['observed_on']=''
    assert client.patch(base+'/thumbnail-style',json=settings).status_code==422
    assert client.get(base).json()['settings']['render_options']=={'subtitles':False}


def bridge(client):
    client.patch('/api/settings',json={'provider_mode':'browser'})
    return {'X-Bridge-Token':client.post('/api/settings/pair-bridge').json()['token']}


def complete_concepts(client, project, identifier):
    workflow=client.app.state.workflow
    with workflow.database.session() as db:
        record=db.get(Job,identifier);context=workflow.context(db,record)
        output=workflow.mock.generate('thumbnail_plan',context,record.prompt)
        attempt=record.attempts
    workflow.complete_ai(identifier,output,expected_attempt=attempt)


@pytest.mark.parametrize('invalid',['quote','enum','count'])
def test_thumbnail_contract_retry_corrects_the_sent_attempt_without_accepting_invalid_concepts(client,project,invalid):
    base=ready(client,project);headers=bridge(client)
    identifier=client.post('/api/jobs',json={'kind':'thumbnail_plan','project_id':project['id'],'payload':{'auto_continue':False}}).json()['id']
    path='/api/bridge/jobs/'+identifier
    client.post(path+'/claim',headers=headers,json={'owner':'one','attempt':1,'authorize_send':True}).raise_for_status()
    with client.app.state.database.session() as db:
        record=db.get(Job,identifier);context=client.app.state.workflow.context(db,record)
        valid=client.app.state.workflow.mock.generate('thumbnail_plan',context,record.prompt)
    bad=json.loads(json.dumps(valid))
    if invalid=='quote':bad['thumbnail_variants'][0]['evidence_quotes']=['The hero opened a door in a different story.']
    if invalid=='enum':bad['visual_dna']['threat_visibility']=['INSTRUMENT_ANOMALY']
    if invalid=='count':bad['visual_dna']['threat_visibility']=['OBJECT_ANOMALY']*5
    rejected=client.post(path+'/result',headers=headers,json={'attempt':1,'result':bad})
    assert rejected.status_code==422 and rejected.json()['code']=='THUMBNAIL_CONTRACT'
    assert not client.get(base+'/thumbnail-packaging').json()['current']
    retry={'owner':'one','attempt':1,'retry_id':'repair-thumbnail','reason':'THUMBNAIL_CONTRACT'}
    assert client.post(path+'/retry',headers=headers,json=retry).status_code==200
    current=next(j for j in client.get('/api/bridge/jobs',headers=headers).json()['items'] if j['id']==identifier)
    assert current['attempt']==2 and 'Previous response validation feedback' in current['prompt']
    assert client.post(path+'/result',headers=headers,json={'attempt':1,'result':valid}).status_code==422
    client.post(path+'/claim',headers=headers,json={'owner':'one','attempt':2,'authorize_send':True}).raise_for_status()
    assert client.post(path+'/retry',headers=headers,json={**retry,'attempt':2,'retry_id':'unrejected-attempt'}).status_code==422
    assert client.post(path+'/result',headers=headers,json={'attempt':2,'result':valid}).json()['accepted']
    assert client.get(base+'/thumbnail-packaging').json()['current']
    assert client.get(base).json()['draft']==DRAFT


def test_thumbnail_retry_rejects_stale_story_context_and_unrecorded_rejections(client,project):
    base=ready(client,project);headers=bridge(client)
    identifier=client.post('/api/jobs',json={'kind':'thumbnail_plan','project_id':project['id']}).json()['id']
    path='/api/bridge/jobs/'+identifier
    client.post(path+'/claim',headers=headers,json={'owner':'one','attempt':1,'authorize_send':True})
    retry={'owner':'one','attempt':1,'retry_id':'repair-thumbnail','reason':'THUMBNAIL_CONTRACT'}
    assert client.post(path+'/retry',headers=headers,json=retry).status_code==422
    assert client.post(path+'/result',headers=headers,json={'attempt':0,'result':{}}).status_code==422
    with client.app.state.database.session() as db:assert '_thumbnail_feedback' not in db.get(Job,identifier).payload
    assert client.post(path+'/result',headers=headers,json={'attempt':1,'result':{}}).status_code==422
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.publish={**p.publish,'title':'A changed title'};db.commit()
    assert client.post(path+'/retry',headers=headers,json=retry).status_code==422


def test_approved_visual_queue_prepares_concepts_then_resumes_without_new_count_approval(client,project,monkeypatch,tmp_path):
    base=ready(client,project);bridge(client)
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    preview=client.get(base+'/media-automation/preview').json()
    response=client.post(base+'/media-automation/start',json={'kind':'visuals',**{k:preview[k] for k in ('confirmation','image_count','video_count')}})
    assert response.status_code==200,response.text
    assert response.json()['kind']=='thumbnail_plan'
    complete_concepts(client,project,response.json()['id'])
    p=client.get(base).json();state=p['settings']['media_automation']
    assert state['kind']=='visuals' and state['confirmed_counts']=={'images':1,'videos':0} and state['total']==2
    current=next(j for j in p['jobs'] if j['id']==state['current_job_id'])
    assert current['payload']['_media']['target_type']=='thumbnail'
    assert 'No overlay headline' in current['prompt'] and 'STRUCTURED STORY' in current['prompt']
    assert 'thumbnail_pending_visuals' not in p['settings']


@pytest.mark.parametrize('stop',[True,False])
def test_pending_visuals_do_not_resume_after_stop_or_scene_change(client,project,monkeypatch,tmp_path,stop):
    base=ready(client,project);bridge(client)
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    preview=client.get(base+'/media-automation/preview').json()
    preparation=client.post(base+'/media-automation/start',json={'kind':'visuals',**{k:preview[k] for k in ('confirmation','image_count','video_count')}}).json()
    if stop:
        client.post(base+'/media-automation/stop')
        with pytest.raises(ValueError):complete_concepts(client,project,preparation['id'])
    else:
        with client.app.state.database.session() as db:
            scene=db.query(Scene).filter_by(project_id=project['id']).one();scene.prompt='Changed scene';db.commit()
        complete_concepts(client,project,preparation['id'])
    p=client.get(base).json()
    assert not any(j['payload'].get('_media') for j in p['jobs'])
    assert 'thumbnail_pending_visuals' not in p['settings']


def test_three_images_download_in_sequence_and_review_tracks_exact_asset(client,project,monkeypatch,tmp_path):
    base=ready(client,project);plan=generated(client,project);headers=bridge(client)
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    state=client.post(base+'/media-automation/start',json={'kind':'thumbnails','plan_hash':plan['plan_hash'],'variants':['A','B','C']}).json()
    assert state['total']==3
    for index,key in enumerate('ABC'):
        record=client.get('/api/bridge/jobs',headers=headers).json()['items'][0]
        assert record['media']['variant_id']==key and record['media']['filename']==f'thumbnail_{key}.png'
        client.post('/api/bridge/media/'+record['id']+'/claim',headers=headers,json={'owner':'test','attempt':record['attempt'],'authorize_send':True})
        path=Path(state['download_path'])/f'thumbnail_{key}.png';path.parent.mkdir(parents=True,exist_ok=True)
        Image.new('RGB',(1280,720),['red','green','blue'][index]).save(path)
        response=client.post('/api/bridge/media/'+record['id']+'/result',headers=headers,json={'owner':'test','attempt':record['attempt'],'download_id':index+1,'download_state':'complete','path':str(path)})
        assert response.status_code==200,response.text
    p=client.get(base).json();images=p['thumbnail_packaging']['assets']
    assert set(images)==set('ABC') and p['publish']['thumbnail_asset_id']==images['A']['asset_id']
    assert p['publish']['description']=='Keep this description' and not p['scenes'][0]['asset_id']
    assert all(a['checks']['aspect_16_9'] for a in images.values())
    image=images['B'];review={k:True for k in ('image_matches_story','anomaly_readable','mobile_readable','text_correct','no_major_spoiler')}
    review.update(asset_sha256=image['sha256'],plan_hash=plan['plan_hash'],actual_text='ROOM 614',notes='Checked the real pixels')
    assert client.post(base+'/thumbnail-review/'+image['asset_id'],json={**review,'asset_sha256':'changed'}).status_code==422
    assert client.post(base+'/thumbnail-review/'+image['asset_id'],json=review).json()['passed']
    assert client.post(base+'/thumbnail-select',json={'variant':'B','plan_hash':plan['plan_hash'],'asset_id':image['asset_id']}).status_code==200
    preview=client.get('/api/assets/'+image['asset_id']+'/thumbnail-preview')
    assert Image.open(io.BytesIO(preview.content)).size==(320,180)
    p=client.get(base).json();assert p['publish']['thumbnail_asset_id']==image['asset_id']
    with client.app.state.database.session() as db:
        ctx=metadata_context(db,db.get(Project,project['id']))
    assert ctx['thumbnail']['text']=='ROOM 614' and ctx['thumbnail']['reviewed_visual']
    metadata=metadata_package();metadata['thumbnail_title_overlap_risk']=15;metadata['title_variants'][0]['scores']['thumbnail_complement']=85
    checked=validate_metadata(metadata,ctx,True)
    assert checked['thumbnail_title_word_overlap']==100 and checked['thumbnail_title_overlap_risk']==15
    assert checked['title_variants'][0]['scores']['thumbnail_complement']==85
    exported=client.get(base+'/download/thumbnail_plan.json').json()
    assert set(exported['images'])==set('ABC') and exported['images']['B']['review']['provenance']=='human_image_review'
    assert exported['generation_prompts']['B']==p['thumbnail_packaging']['generation_prompts']['B']


def test_stale_images_and_external_asset_cannot_be_selected(client,project):
    base=ready(client,project);plan=generated(client,project)
    p=client.get(base).json();publish={**p['publish'],'title':'An updated published title'}
    client.patch(base,json={'publish':publish})
    assert not client.get(base+'/thumbnail-packaging').json()['current']
    assert client.post(base+'/thumbnail-select',json={'variant':'A','plan_hash':plan['plan_hash']}).status_code==422


def test_failed_variants_remain_visible_with_an_existing_thumbnail_and_clear_individually(client,project,monkeypatch,tmp_path):
    base=ready(client,project);plan=generated(client,project);headers=bridge(client)
    monkeypatch.setattr('backend.media_automation.downloads_root',lambda:tmp_path/'Downloads')
    root=client.app.state.root;Image.new('RGB',(1280,720),'navy').save(root/'kept.png')
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id'])
        asset=Asset(project_id=p.id,name='kept.png',kind='image',path='kept.png',story_version=1,
                    metadata_json={'role':'thumbnail','thumbnail_variant':'A','thumbnail_plan_hash':plan['plan_hash']})
        db.add(asset);db.flush();p.publish={**p.publish,'thumbnail_asset_id':asset.id};kept=asset.id;db.commit()
    response=client.post(base+'/media-automation/start',json={'kind':'thumbnails','plan_hash':plan['plan_hash'],'variants':['B','C']})
    assert response.status_code==200,response.text
    for key in 'BC':
        record=client.get('/api/bridge/jobs',headers=headers).json()['items'][0]
        assert record['media']['variant_id']==key
        client.post('/api/bridge/media/'+record['id']+'/claim',headers=headers,json={'owner':'test','attempt':record['attempt'],'authorize_send':True})
        failure=client.post('/api/bridge/media/'+record['id']+'/failure',headers=headers,json={'owner':'test','attempt':record['attempt'],'reason':'Browser image generation timed out'})
        assert failure.status_code==200,failure.text
    p=client.get(base).json()
    assert p['publish']['thumbnail_asset_id']==kept
    missing=[m for m in p['missing_resources'] if m['target_type']=='thumbnail']
    assert {m['variant_id'] for m in missing}=={'B','C'} and all(m['automatic_failure'] for m in missing)
    state=client.post(base+'/media-automation/start',json={'kind':'thumbnails','plan_hash':plan['plan_hash'],'variants':['B']}).json()
    record=client.get('/api/bridge/jobs',headers=headers).json()['items'][0]
    client.post('/api/bridge/media/'+record['id']+'/claim',headers=headers,json={'owner':'test','attempt':record['attempt'],'authorize_send':True})
    path=Path(state['download_path'])/'thumbnail_B.png';path.parent.mkdir(parents=True,exist_ok=True);Image.new('RGB',(1280,720),'green').save(path)
    assert client.post('/api/bridge/media/'+record['id']+'/result',headers=headers,json={'owner':'test','attempt':record['attempt'],'download_id':42,'download_state':'complete','path':str(path)}).status_code==200
    assert {m['variant_id'] for m in client.get(base).json()['missing_resources'] if m['target_type']=='thumbnail'}=={'C'}


def test_regenerated_concepts_with_identical_inputs_cannot_inherit_old_image_approval(client,project,monkeypatch):
    import copy
    base=ready(client,project);old=generated(client,project);root=client.app.state.root
    Image.new('RGB',(1280,720),'navy').save(root/'kept.png')
    checksum=hashlib.sha256((root/'kept.png').read_bytes()).hexdigest()
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id'])
        asset=Asset(project_id=p.id,name='kept.png',kind='image',path='kept.png',story_version=1,sha256=checksum,
                    metadata_json={'role':'thumbnail','thumbnail_variant':'A','thumbnail_plan_hash':old['plan_hash']})
        db.add(asset);db.flush();identifier=asset.id;p.publish={**p.publish,'thumbnail_asset_id':identifier};db.commit()
    review={k:True for k in ('image_matches_story','anomaly_readable','mobile_readable','text_correct','no_major_spoiler')}
    review.update(asset_sha256=checksum,plan_hash=old['plan_hash'],actual_text='',notes='Checked original concept')
    assert client.post(base+'/thumbnail-review/'+identifier,json=review).json()['passed']
    revised=copy.deepcopy(old);revised['thumbnail_variants'][0]['concept']='A close view of the newly appeared doorway, contrasting with the printed plan.'
    revised['thumbnail_variants'][0]['generation_prompt']='Photograph the newly appeared doorway beside the printed plan.'
    monkeypatch.setattr(client.app.state.workflow.mock,'generate',lambda kind,context,prompt:revised)
    new=generated(client,project)
    assert new['content_fingerprint']==old['content_fingerprint'] and new['plan_hash']!=old['plan_hash']
    state=client.get(base).json()
    assert state['thumbnail_packaging']['current'] and not state['thumbnail_packaging']['assets']
    assert state['publish']['thumbnail_asset_id']==identifier and (root/'kept.png').is_file()
    assert client.post(base+'/thumbnail-review/'+identifier,json=review).status_code==422
    assert client.post(base+'/thumbnail-select',json={'variant':'A','plan_hash':new['plan_hash'],'asset_id':identifier}).status_code==422
    with client.app.state.database.session() as db:
        context=metadata_context(db,db.get(Project,project['id']))
    assert context['thumbnail']['reviewed_visual']['concept']==old['thumbnail_variants'][0]['concept']
