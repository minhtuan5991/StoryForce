import io
import math
import struct
import wave
import zipfile
from pathlib import Path
import pytest
from PIL import Image
from conftest import job,build_story
from backend.media import map_asset,parse_probe,timeline_from_audio,build_render_plan,find_binary,validate_assets
from backend.config import DEFAULT_SETTINGS,safe_path
from backend.portability import safe_extract


def wav_data(seconds=1.5,frequency=220):
    buffer=io.BytesIO()
    with wave.open(buffer,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000)
        w.writeframes(b''.join(struct.pack('<h',int(2000*math.sin(2*math.pi*frequency*i/16000))) for i in range(int(seconds*16000))))
    return buffer.getvalue()


@pytest.mark.parametrize('name,expected',[('tts_001.wav',('tts',1)),('scene_026.mp4',('scene',26)),('scene_012.jpg',('scene',12)),('random.png',(None,None))])
def test_asset_mapping(name,expected):assert map_asset(name)==expected


def test_ffprobe_parser():
    result=parse_probe({'streams':[{'codec_type':'video','width':1920,'height':1080,'avg_frame_rate':'30000/1001','codec_name':'h264'},{'codec_type':'audio','codec_name':'aac'}],'format':{'duration':'12.5','size':'100'}})
    assert result['duration']==12.5
    assert abs(result['fps']-29.970)<.001
    assert result['has_audio']


def test_timeline_uses_actual_chunk_durations():
    chunks=[{'id':'1','number':1,'text':'One two three four.','real_duration':4},{'id':'2','number':2,'text':'Five six seven eight.','real_duration':8}]
    scenes=[{'id':'a','number':1,'start_word':0,'end_word':6},{'id':'b','number':2,'start_word':6,'end_word':8}]
    timeline=timeline_from_audio(chunks,scenes)
    assert timeline['duration']==12
    assert timeline['scenes'][0]['duration']==8
    assert timeline['scenes'][1]['offset']==8
    with pytest.raises(ValueError):timeline_from_audio([{'id':'1','number':1,'text':'No measured audio.'}],scenes)


def test_render_plan_keeps_timeline_during_overlap():
    plan=build_render_plan([{'duration':5},{'duration':7}],DEFAULT_SETTINGS,12)
    assert plan['scenes'][0]['clip_duration']==5.4
    assert plan['scenes'][1]['clip_duration']==7
    assert plan['duration']==12


def test_path_and_zip_slip_protection(tmp_path):
    with pytest.raises(ValueError):safe_path(tmp_path,'../outside.txt')
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w') as z:z.writestr('../escape.txt','bad')
    buf.seek(0)
    with zipfile.ZipFile(buf) as z:
        with pytest.raises(ValueError):safe_extract(z,tmp_path)
    assert not (tmp_path.parent/'escape.txt').exists()


def test_missing_audio_blocks_even_with_visual_fallback(tmp_path):
    result=validate_assets([],[],[],tmp_path,1,True)
    assert not result['valid']
    assert 'Generate TTS chunks' in result['missing']


@pytest.mark.skipif(not find_binary('ffmpeg',DEFAULT_SETTINGS),reason='FFmpeg unavailable')
def test_real_end_to_end_ffmpeg_render(client,project,tmp_path):
    detail=build_story(client,project)
    job(client,project,'chunk_tts')
    job(client,project,'visual_director',{'count':2})
    detail=client.get('/api/projects/'+project['id']).json()
    assert detail['chunks']
    for chunk in detail['chunks']:
        response=client.post('/api/projects/'+project['id']+'/assets',files=[('files',(f"tts_{chunk['number']:03}.wav",wav_data(1.5,220+chunk['number']*50),'audio/wav'))])
        assert response.status_code==200,response.text
    for scene in detail['scenes']:
        buffer=io.BytesIO();Image.new('RGB',(320,180),(30+scene['number']*50,70,120)).save(buffer,format='PNG')
        response=client.post('/api/projects/'+project['id']+'/assets',files=[('files',(f"scene_{scene['number']:03}.png",buffer.getvalue(),'image/png'))])
        assert response.status_code==200,response.text
    assert client.get('/api/projects/'+project['id']+'/validate').json()['valid']
    timeline=job(client,project,'sync')
    assert timeline['duration']==len(detail['chunks'])*1.5
    assert client.patch('/api/settings',json={'render_width':320,'render_height':180,'render_fps':12}).status_code==200
    result=job(client,project,'render')
    assert result['status']=='READY',result
    assert result['captions_burned_in'] is True
    assert all(result['checks'].values())
    video=client.get('/api/projects/'+project['id']+'/download/final_video.mp4')
    assert video.status_code==200
    assert len(video.content)>1000
    (tmp_path/'verified-smoke.mp4').write_bytes(video.content)
    # Solid-color source images contain no white; visible subtitle glyphs must
    # be present in a decoded video frame, independent of the subtitle track.
    import subprocess
    frame=tmp_path/'caption-frame.png'
    subprocess.run([find_binary('ffmpeg',DEFAULT_SETTINGS),'-y','-ss','0.5','-i',str(tmp_path/'verified-smoke.mp4'),'-frames:v','1',str(frame)],check=True,capture_output=True)
    with Image.open(frame) as picture:
        pixels=picture.convert('RGB').crop((0,90,320,180))
        assert sum(1 for r,g,b in pixels.getdata() if min(r,g,b)>200)>10
    caption=client.get('/api/projects/'+project['id']+'/download/captions.srt')
    assert caption.status_code==200
    assert b'-->' in caption.content
