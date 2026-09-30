import pytest
from PIL import Image
from backend import render_acceleration as acceleration, media
from backend.config import DEFAULT_SETTINGS
from test_media import wav_data


def test_encoder_checks_driver_and_falls_back_through_candidates(monkeypatch):
    seen=[]
    def fake(args,**kwargs):
        encoder=args[args.index('-c:v')+1];seen.append(encoder)
        if encoder=='h264_nvenc':raise ValueError('driver mismatch')
    monkeypatch.setattr(acceleration,'run_process',fake)
    assert acceleration.detect_encoder('mock-driver',1)=='h264_qsv'
    assert seen==['h264_nvenc','h264_qsv']
    monkeypatch.setattr(acceleration,'run_process',lambda *args,**kwargs: (_ for _ in ()).throw(ValueError('no hardware')))
    assert acceleration.detect_encoder('mock-no-driver',1)=='libx264'
    assert acceleration.choose_encoder('not-even-a-file',{'render_encoder':'cpu'})=='libx264'


def test_runtime_gpu_failure_finishes_with_cpu_and_keeps_timing(tmp_path,monkeypatch):
    (tmp_path/'logs').mkdir()
    (tmp_path/'voice.wav').write_bytes(wav_data(1))
    Image.new('RGB',(320,180),'blue').save(tmp_path/'image.png')
    assets=[{'id':'a','path':'voice.wav','kind':'audio','duration':1,'metadata_json':media.probe(tmp_path/'voice.wav',DEFAULT_SETTINGS)},
            {'id':'i','path':'image.png','kind':'image'}]
    scenes=[{'id':'s','number':1,'scene_key':'scene_001','asset_id':'i','offset':0,'duration':1,'status':'ATTACHED','story_version':1}]
    chunks=[{'id':'c','number':1,'asset_id':'a','text':'Narration.','real_duration':1,'status':'ATTACHED','story_version':1}]
    monkeypatch.setattr(acceleration,'choose_encoder',lambda *args:'h264_qsv')
    original=media.run_process;failures=[]
    def run(args,*a,**kw):
        if '-c:v' in args and args[args.index('-c:v')+1]=='h264_qsv':
            failures.append(args);raise ValueError('GPU became unavailable')
        return original(args,*a,**kw)
    monkeypatch.setattr(media,'run_process',run)
    p={'id':'p','story_version':1,'title':'CPU fallback','settings':{'render_options':{'subtitles':False}}}
    config={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':30}
    report=media.render_project(tmp_path,p,chunks,scenes,assets,config,lambda *args:None)
    assert len(failures)==2  # scene preparation and final composition both recovered.
    assert report['render_performance']['encoder']=='libx264'
    assert all(report['checks'].values()),report
    assert report['metadata']['width']==320 and report['metadata']['fps']==30
