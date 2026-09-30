import io
import json
from pathlib import Path

import pytest
from PIL import Image

from backend.config import DEFAULT_SETTINGS
from backend.media import find_binary, probe, render_project, run_process, final_qa
from backend.models import Artifact, Chunk, Scene
from conftest import build_story, job
from test_media import wav_data


def test_pipeline_identifies_missing_outro_and_continues_when_attached(client, project, monkeypatch):
    build_story(client, project)
    job(client, project, 'chunk_tts')
    job(client, project, 'visual_director', {'count': 2})
    path = '/api/projects/' + project['id']
    p = client.get(path).json()
    for c in p['chunks'][:-1]:
        client.post(path+'/assets', files=[('files',(f"tts_{c['number']:03}.wav",wav_data(frequency=220+c['number']*40),'audio/wav'))])
    for s in p['scenes']:
        picture=io.BytesIO();Image.new('RGB',(320,180),(s['number']*50,70,120)).save(picture,'JPEG')
        client.post(path+'/assets',files=[('files',(f"scene_{s['number']:03}.jpg",picture.getvalue(),'image/jpeg'))])
    result=client.post(path+'/pipeline').json()
    assert result['validation']['narration']==[len(p['chunks'])-1,len(p['chunks'])]
    assert result['validation']['missing']==[f"tts_{p['chunks'][-1]['number']:03}.wav"]
    assert result['validation']['visuals']==[2,2]
    c=p['chunks'][-1]
    client.post(path+'/assets',files=[('files',(f"tts_{c['number']:03}.wav",wav_data(frequency=410),'audio/wav'))])
    client.patch('/api/settings',json={'pipeline_mode':'manual'})
    assert client.get(path).json()['next']=={'kind':'sync'}
    assert client.post(path+'/pipeline').json()['kind']=='sync'
    assert client.get(path).json()['next']=={'kind':'render'}
    # Direct render after replacing narration must recompute scene durations.
    c=p['chunks'][0]
    client.post(path+'/assets',files=[('files',(f"tts_{c['number']:03}.wav",wav_data(seconds=2.7,frequency=380),'audio/wav'))])
    def capture_render(root, project, chunks, scenes, assets, settings, progress):
        assert abs(sum(s['duration'] for s in scenes)-sum(c['real_duration'] for c in chunks))<.001
        assert chunks[0]['real_duration']==2.7
        assert scenes[-1]['offset']+scenes[-1]['duration']==sum(c['real_duration'] for c in chunks)
        return {'status':'READY','story_version':project['story_version']}
    monkeypatch.setattr('backend.workflow.render_project',capture_render)
    job(client,project,'render')


@pytest.mark.skipif(not find_binary('ffmpeg',DEFAULT_SETTINGS),reason='FFmpeg unavailable')
def test_mixed_videos_and_images_reach_all_eight_scenes_and_rerender(tmp_path):
    root=tmp_path; (root/'logs').mkdir()
    audio=root/'voice.wav';audio.write_bytes(wav_data(seconds=10.4))
    assets=[{'id':'audio','kind':'audio','path':'voice.wav','duration':10.4,'metadata_json':probe(audio,DEFAULT_SETTINGS)}]
    chunks=[{'id':'c','number':1,'text':'One two three. Four five six. Seven eight nine. Thank you.', 'real_duration':10.4,'asset_id':'audio','status':'ATTACHED','story_version':1}]
    scenes=[]
    ffmpeg=find_binary('ffmpeg',DEFAULT_SETTINGS)
    colors=[(140,30,20),(20,120,20),(20,20,160),(180,120,20),(120,20,120),(20,170,180),(180,90,50),(30,180,50)]
    for i,color in enumerate(colors):
        name=f'scene{i}.jpg';Image.new('RGB',(320,180),color).save(root/name)
        aid=f'image{i}';assets.append({'id':aid,'kind':'image','path':name})
        scene={'id':f's{i}','number':i+1,'scene_key':f'S{i+1:03}','asset_id':aid,'fallback_asset_id':None,'visual_type':'IMAGE','duration':1.3,'offset':1.3*i,'status':'ATTACHED','story_version':1}
        if i in (4,6):
            video=root/f'video{i}.mp4'
            run_process([ffmpeg,'-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24','-t','0.4','-an','-c:v','libx264','-pix_fmt','yuv420p',str(video)])
            aid=f'video{i}';assets.append({'id':aid,'kind':'video','path':video.name,'duration':.4})
            scene.update(asset_id=aid,fallback_asset_id=f'image{i}',visual_type='VIDEO')
        scenes.append(scene)
    settings={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':24,'transition_seconds':.2}
    project={'id':'p','story_version':1,'title':'Regression','publish':{}}
    result=render_project(root,project,chunks,scenes,assets,settings,lambda *args:None)
    assert all(result['checks'].values()),result
    assert abs(result['metadata']['video_duration']-10.4)<.1
    # Decode a frame inside every scene, past the short video and its JPEG tail.
    for i,color in enumerate(colors):
        if i in (4,6):continue  # Short video ends early; the next image fills the gap.
        frame=root/f'frame{i}.png'
        run_process([ffmpeg,'-y','-ss',str(i*1.3+.9),'-i',str(root/result['file']),'-frames:v','1',str(frame)])
        with Image.open(frame) as im:
            pixel=im.convert('RGB').getpixel((160,25))
            assert max(abs(a-b) for a,b in zip(pixel,color))<16,(i,pixel,color)
    # A second attempt writes a new output, keeping the last playable file intact.
    old=(root/result['file']).read_bytes()
    rerender=render_project(root,project,chunks,scenes,assets,settings,lambda *args:None)
    assert result['file']!=rerender['file']
    assert (root/result['file']).read_bytes()==old
    assert rerender['inputs_hash']==result['inputs_hash']
    assert rerender['render_performance']['cached_scenes']==8
    # Updating one input rebuilds only that scene, preserving all other cache entries.
    Image.new('RGB',(320,180),'white').save(root/'scene7.jpg')
    changed=render_project(root,project,chunks,scenes,assets,settings,lambda *args:None)
    assert changed['render_performance']['rendered_scenes']==1
    assert changed['render_performance']['cached_scenes']==7


def test_qa_rejects_short_video_stream_even_when_container_matches(tmp_path,monkeypatch):
    import subprocess
    from backend import media
    output=tmp_path/'video.mp4';output.touch()
    (tmp_path/'captions.srt').touch();(tmp_path/'thumbnail_prompt.txt').touch()
    monkeypatch.setattr(media,'probe',lambda *args:{'duration':312,'video_duration':96,'audio_duration':312,'width':1920,'height':1080,'fps':30,'has_audio':True})
    monkeypatch.setattr(media,'run_process',lambda *args,**kw:subprocess.CompletedProcess([],0,'',''))
    result=final_qa(output,{'duration':312,'width':1920,'height':1080,'fps':30,'scenes':[{'duration':312}]},'ffmpeg',DEFAULT_SETTINGS,tmp_path/'log')
    assert result['status']=='BLOCKED'
    assert result['checks']['duration_matches']
    assert not result['checks']['video_duration_matches']


def test_downloads_use_latest_render_folder_and_no_cache(client,project):
    with client.app.state.database.session() as db:
        from backend.models import Project
        p=db.get(Project,project['id']);p.story_version=1
        relative=f"projects/{p.id}/render/v1/attempt2/final_video.mp4"
        db.add(Artifact(project_id=p.id,kind='render_report',provider='ffmpeg',story_version=1,content={'file':relative,'story_version':1}))
        db.commit()
    root=client.app.state.workflow.root
    target=root/relative;target.parent.mkdir(parents=True);target.write_bytes(b'new video')
    response=client.get('/api/projects/'+project['id']+'/download/final_video.mp4')
    assert response.content==b'new video'
    assert response.headers['cache-control']=='no-store'
