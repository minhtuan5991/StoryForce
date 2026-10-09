import subprocess
import sys
import time
from pathlib import Path

import pytest
from PIL import Image, ImageDraw
from backend import media, render_pipeline as pipeline
from backend.config import DEFAULT_SETTINGS
from backend.render_acceleration import choose_encoder, render_binary, cuda_compositing
from test_media import wav_data


def test_watchdog_allows_advancing_work_but_stops_stalled_process(tmp_path,monkeypatch):
    original = subprocess.Popen
    def launch(args,**kwargs):
        # Python is a controllable fake FFmpeg; strip FFmpeg's progress flags.
        return original([args[0],*args[4:]],**kwargs)
    monkeypatch.setattr(pipeline.subprocess,'Popen',launch)
    ticks=[]
    script="import time;\nfor i in range(12):\n print('frame='+str(i),flush=True); print('out_time_us='+str(i*100000),flush=True); print('progress=continue',flush=True); time.sleep(.1)\n"
    pipeline.monitored_process([sys.executable,'-u','-c',script],tmp_path/'progress.log',
                               on_progress=lambda seconds,frame:ticks.append((seconds,frame)),idle_timeout=.6)
    assert ticks[-1] == (1.1,11)
    start=time.monotonic()
    with pytest.raises(ValueError,match='stopped advancing'):
        pipeline.monitored_process([sys.executable,'-u','-c',"import time; print('frame=1',flush=True); time.sleep(10)"],idle_timeout=.6)
    assert time.monotonic()-start < 4


def test_48_scene_composition_has_bounded_inputs_and_exact_frame_count(tmp_path):
    scenes=[{'offset':i*.113,'duration':.113,'media_kind':'image'} for i in range(48)]
    plan=media.build_render_plan(scenes,{**DEFAULT_SETTINGS,'render_fps':30},48*.113)
    clips=[]
    for i in range(48):
        path=tmp_path/f'source{i}.mp4';path.touch();clips.append(path)
    calls=[]
    def encode(args,output):
        calls.append(args);output.touch()
    output,groups,created=pipeline.compose_clips(clips,plan,tmp_path,['ffmpeg'],encode,lambda *args:None)
    assert groups==11
    assert all(args.count('-i') <= 6 for args in calls)
    assert int(calls[-1][calls[-1].index('-frames:v')+1])==round(48*.113*30)
    assert output.is_file() and created=={output}
    assert all(p.exists() for p in clips)  # Never delete the scene cache.


def test_dark_green_waveform_loops_under_logo_and_group_boundaries_keep_video_timing(tmp_path):
    (tmp_path/'logs').mkdir()
    ffmpeg=media.find_binary('ffmpeg',DEFAULT_SETTINGS)
    config={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':12,'render_encoder':'cpu','transition_seconds':.2}
    wave=tmp_path/'wave.mp4'
    media.run_process([ffmpeg,'-y','-f','lavfi','-i','color=c=0x2DA63B:s=320x180:r=30000/1001',
                       '-vf','drawbox=x=60:y=130:w=100:h=10:color=white:t=fill','-t','0.8','-an',
                       '-c:v','libx264','-pix_fmt','yuv420p',str(wave)])
    detected=pipeline.wave_key_color(ffmpeg,wave,.8)
    color=tuple(int(detected[i:i+2],16) for i in (2,4,6))
    assert max(abs(a-b) for a,b in zip(color,(45,166,59))) < 5
    video=tmp_path/'video.mp4'
    media.run_process([ffmpeg,'-y','-f','lavfi','-i','color=c=blue:s=320x180:r=12','-t','0.416666667',
                       '-an','-c:v','libx264','-pix_fmt','yuv420p',str(video)])
    logo=Image.new('RGBA',(320,180),(0,0,0,0));ImageDraw.Draw(logo).rectangle((90,130,110,140),fill='red');logo.save(tmp_path/'logo.png')
    (tmp_path/'voice.wav').write_bytes(wav_data(12))
    assets=[{'id':'voice','path':'voice.wav','kind':'audio','duration':12,'metadata_json':media.probe(tmp_path/'voice.wav',config)},
            {'id':'wave','path':'wave.mp4','kind':'video','duration':.8},
            {'id':'logo','path':'logo.png','kind':'image'}]
    scenes=[]
    for i in range(12):
        Image.new('RGB',(320,180),(70+i*10,30,140)).save(tmp_path/f'image{i}.png')
        asset={'id':str(i),'path':f'image{i}.png','kind':'image'}
        if i==7:asset.update(path='video.mp4',kind='video',duration=5/12)
        assets.append(asset)
        scenes.append({'id':str(i),'number':i+1,'scene_key':f'scene_{i+1:03}','offset':i,'duration':1,
                       'asset_id':str(i),'story_version':1,'status':'ATTACHED'})
    chunks=[{'id':'c','number':1,'text':'Test narration.','asset_id':'voice','real_duration':12,'story_version':1,'status':'ATTACHED'}]
    project={'id':'test','title':'Waveform','story_version':1,'settings':{'render_options':{'subtitles':False,'waveform':True,'waveform_asset_id':'wave','overlay':True,'logo_asset_id':'logo'}}}
    events=[]
    report=media.render_project(tmp_path,project,chunks,scenes,assets,config,lambda *args:events.append(args))
    assert all(report['checks'].values()),report
    assert report['render_performance']['join_groups']==0
    assert report['render_performance']['timeline_local_transitions']
    assert report['render_performance']['transition_windows']==9
    assert report['render_performance']['wave_key_color']==detected
    assert not list((tmp_path/report['file']).parent.glob('join_*.mp4'))
    assert all(a[0]<=b[0] for a,b in zip(events,events[1:]))
    for point,expected in ((6.5,(130,30,140)),(7.2,(0,0,255)),(7.7,(150,30,140)),(11.5,(180,30,140))):
        frame=tmp_path/f'frame-{point}.png'
        media.run_process([ffmpeg,'-y','-ss',str(point),'-i',str(tmp_path/report['file']),'-frames:v','1',str(frame)])
        with Image.open(frame) as image:
            center=image.convert('RGB').getpixel((160,90))
            assert max(abs(a-b) for a,b in zip(center,expected)) < 25,(point,center,expected)
            assert min(image.convert('RGB').getpixel((70,135))) > 225  # wave at original position, after multiple loops
            red=image.convert('RGB').getpixel((100,135))
            assert red[0]>220 and max(red[1:])<30  # logo above wave, no scaling or movement


def test_cuda_waveform_and_logo_keep_native_canvas_colors_and_video_anchor(tmp_path):
    binary=media.find_binary('ffmpeg',DEFAULT_SETTINGS)
    binary=render_binary(binary,DEFAULT_SETTINGS)
    if choose_encoder(binary,DEFAULT_SETTINGS)!='h264_nvenc' or not cuda_compositing(binary):
        pytest.skip('Working NVIDIA CUDA/NVENC unavailable')
    (tmp_path/'logs').mkdir()
    config={**DEFAULT_SETTINGS,'ffmpeg_path':binary,'render_width':320,'render_height':180,'render_fps':12}
    media.run_process([binary,'-v','error','-y','-f','lavfi','-i','color=c=0x2DA63B:s=320x180:r=30',
        '-vf','drawbox=x=60:y=130:w=100:h=10:color=white:t=fill','-t','0.4','-an','-c:v','libx264',str(tmp_path/'wave.mp4')])
    media.run_process([binary,'-v','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24',
        '-t','0.5','-an','-c:v','libx264',str(tmp_path/'video.mp4')])
    logo=Image.new('RGBA',(320,180),(0,0,0,0));ImageDraw.Draw(logo).rectangle((90,130,110,140),fill='red');logo.save(tmp_path/'logo.png')
    Image.new('RGB',(320,180),(180,60,20)).save(tmp_path/'image0.png')
    Image.new('RGB',(320,180),(140,20,100)).save(tmp_path/'image2.png')
    (tmp_path/'voice.wav').write_bytes(wav_data(3))
    assets=[{'id':'voice','path':'voice.wav','kind':'audio','duration':3,'metadata_json':media.probe(tmp_path/'voice.wav',config)},
            {'id':'wave','path':'wave.mp4','kind':'video','duration':.4},
            {'id':'logo','path':'logo.png','kind':'image'},{'id':'s0','path':'image0.png','kind':'image'},
            {'id':'s1','path':'video.mp4','kind':'video','duration':.5},{'id':'s2','path':'image2.png','kind':'image'}]
    scenes=[{'id':str(i),'number':i+1,'scene_key':f'scene_{i+1:03}','asset_id':f's{i}','offset':i,'duration':1} for i in range(3)]
    chunks=[{'id':'c','number':1,'text':'Test narration.','asset_id':'voice','real_duration':3}]
    for item in chunks+scenes:item.update(story_version=1,status='ATTACHED')
    project={'id':'cuda','title':'CUDA','story_version':1,'settings':{'render_options':{'subtitles':False,'waveform':True,
               'waveform_asset_id':'wave','overlay':True,'logo_asset_id':'logo'}}}
    result=media.render_project(tmp_path,project,chunks,scenes,assets,config,lambda *args:None)
    assert all(result['checks'].values()),result
    assert result['render_performance']['cuda_compositing'],result['render_performance']
    for point,expected in ((.5,(180,60,20)),(1.2,(0,0,255)),(1.8,(140,20,100)),(2.8,(140,20,100))):
        path=tmp_path/f'frame-{point}.png'
        media.run_process([binary,'-v','error','-y','-ss',str(point),'-i',str(tmp_path/result['file']),'-frames:v','1',str(path)])
        with Image.open(path) as picture:
            pixel=picture.convert('RGB').getpixel((160,70))
            assert max(abs(a-b) for a,b in zip(pixel,expected))<20,(point,pixel,expected)
            assert min(picture.convert('RGB').getpixel((70,135)))>225
            red=picture.convert('RGB').getpixel((100,135))
            assert red[0]>225 and max(red[1:])<25
