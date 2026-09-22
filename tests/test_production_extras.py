import io
from PIL import Image
from conftest import build_story,job
from backend.models import Chunk
from backend.production_extras import outro_chunk


def test_scene_context_and_separate_outro_preserve_existing_narration(client,project):
    build_story(client,project)
    job(client,project,'chunk_tts')
    job(client,project,'visual_director',{'count':2})
    path='/api/projects/'+project['id']
    p=client.get(path).json()
    assert p['chunks'][-1]['voice_profile']['segment_role']=='outro'
    assert 'like or a subscription' in p['chunks'][-1]['text']
    assert len(set(c['scene_context'] for c in p['chunks']))==len(p['chunks'])
    assert all('Read only the transcript' in c['scene_context'] for c in p['chunks'])
    assert client.post(path+'/outro').json()=={'added':False}
    # Simulate an existing project from before this update.
    with client.app.state.database.session() as db:
        db.query(Chunk).filter_by(id=p['chunks'][-1]['id']).delete();db.commit()
    before=client.get(path).json()
    assert client.post(path+'/outro').json()=={'added':True}
    after=client.get(path).json()
    assert after['chunks'][:-1]==before['chunks']
    assert after['draft']==before['draft'] and after['locked']==before['locked']
    assert after['story_version']==before['story_version']
    assert client.post(path+'/outro').json()=={'added':False}


def test_thumbnail_uses_project_image_and_preserves_exact_video_title(client,project):
    path='/api/projects/'+project['id']
    client.patch(path,json={'publish':{'title':'One Knock After Sundown'}})
    buffer=io.BytesIO();Image.new('RGB',(1600,900),(50,90,125)).save(buffer,format='PNG')
    asset=client.post(path+'/assets',files=[('files',('story.png',buffer.getvalue(),'image/png'))]).json()['items'][0]
    response=client.post(path+'/thumbnail',json={'asset_id':asset['id']})
    assert response.status_code==200,response.text
    thumb=response.json()
    assert thumb['metadata_json']['title']=='One Knock After Sundown'
    picture=Image.open(io.BytesIO(client.get('/api/assets/'+thumb['id']+'/file').content))
    assert picture.size==(1280,720)
    assert client.get(path).json()['publish']['thumbnail_asset_id']==thumb['id']
    assert 'One Knock After Sundown' in client.get(path).json()['thumbnail_prompt']
    other=client.post('/api/projects',json={'title':'Other','channel_id':project['channel_id']}).json()
    assert client.post('/api/projects/'+other['id']+'/thumbnail',json={'asset_id':asset['id']}).status_code==422
    assert client.get('/api/assets/'+asset['id']+'/file').content==buffer.getvalue()


def test_vietnamese_outro():
    c=outro_chunk(4,{'voice_name':'Kore'},'Tiếng Việt',150,'Kết thúc truyện.')
    assert 'Cảm ơn' in c['text'] and 'đăng ký' in c['text']
    assert c['voice_profile']['voice_name']=='Kore'
