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


@pytest.mark.parametrize('encoder', ['h264_qsv', 'h264_nvenc'])
def test_runtime_gpu_failure_finishes_with_cpu_and_keeps_timing(tmp_path,monkeypatch,encoder):
    (tmp_path/'logs').mkdir()
    (tmp_path/'voice.wav').write_bytes(wav_data(1))
    Image.new('RGB',(320,180),'blue').save(tmp_path/'image.png')
    assets=[{'id':'a','path':'voice.wav','kind':'audio','duration':1,'metadata_json':media.probe(tmp_path/'voice.wav',DEFAULT_SETTINGS)},
            {'id':'i','path':'image.png','kind':'image'}]
    scenes=[{'id':'s','number':1,'scene_key':'scene_001','asset_id':'i','offset':0,'duration':1,'status':'ATTACHED','story_version':1}]
    chunks=[{'id':'c','number':1,'asset_id':'a','text':'Narration.','real_duration':1,'status':'ATTACHED','story_version':1}]
    monkeypatch.setattr(acceleration,'choose_encoder',lambda *args:encoder)
    monkeypatch.setattr(acceleration,'cuda_compositing',lambda *args:True)
    original=media.run_process;failures=[]
    def run(args,*a,**kw):
        if '-c:v' in args and args[args.index('-c:v')+1]==encoder:
            failures.append(args);raise ValueError('GPU became unavailable')
        return original(args,*a,**kw)
    monkeypatch.setattr(media,'run_process',run)
    p={'id':'p','story_version':1,'title':'CPU fallback','settings':{'render_options':{'subtitles':False}}}
    config={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':30}
    report=media.render_project(tmp_path,p,chunks,scenes,assets,config,lambda *args:None)
    assert len(failures)==(3 if encoder=='h264_nvenc' else 2)
    assert report['render_performance']['encoder']=='libx264'
    assert all(report['checks'].values()),report
    assert report['metadata']['width']==320 and report['metadata']['fps']==30


def test_compatible_runtime_is_used_only_for_working_nvenc_and_respects_user_paths(tmp_path,monkeypatch):
    original=tmp_path/'ffmpeg.exe';original.touch()
    compatible=tmp_path/'tools/ffmpeg-compatible.exe';compatible.parent.mkdir();compatible.touch()
    monkeypatch.setattr(acceleration,'APP_ROOT',tmp_path)
    monkeypatch.setattr(acceleration,'RESOURCE_ROOT',tmp_path)
    monkeypatch.setattr(acceleration,'choose_encoder',lambda binary,settings:'h264_nvenc' if binary==str(compatible) else 'h264_qsv')
    assert acceleration.render_binary(str(original),{'render_encoder':'auto'})==str(compatible)
    assert acceleration.render_binary(str(original),{'render_encoder':'cpu'})==str(original)
    assert acceleration.render_binary(str(original),{'ffmpeg_path':str(original)})==str(original)
    monkeypatch.setattr(acceleration,'choose_encoder',lambda *args:'libx264')
    assert acceleration.render_binary(str(original),{})==str(original)


def test_source_decoder_failure_uses_main_ffmpeg_and_preserves_delivery(tmp_path,monkeypatch):
    (tmp_path/'logs').mkdir()
    (tmp_path/'voice.wav').write_bytes(wav_data(1))
    Image.new('RGB',(320,180),'blue').save(tmp_path/'image.png')
    assets=[{'id':'a','path':'voice.wav','kind':'audio','duration':1,'metadata_json':media.probe(tmp_path/'voice.wav',DEFAULT_SETTINGS)},
            {'id':'i','path':'image.png','kind':'image'}]
    scenes=[{'id':'s','number':1,'scene_key':'scene_001','asset_id':'i','offset':0,'duration':1,'status':'ATTACHED','story_version':1}]
    chunks=[{'id':'c','number':1,'asset_id':'a','text':'Narration.','real_duration':1,'status':'ATTACHED','story_version':1}]
    main=media.find_binary('ffmpeg',DEFAULT_SETTINGS);compatible=str(tmp_path/'compatible.exe')
    monkeypatch.setattr(acceleration,'render_binary',lambda *args:compatible)
    monkeypatch.setattr(acceleration,'choose_encoder',lambda *args:'libx264')
    original=media.run_process;seen=[]
    def run(args,*a,**kw):
        if '-i' in args and args[args.index('-i')+1]==str(tmp_path/'image.png'):
            seen.append(args[0])
            if args[0]==compatible:raise ValueError('Source decoder unavailable in compatibility runtime')
        return original([main,*args[1:]] if args[0]==compatible else args,*a,**kw)
    monkeypatch.setattr(media,'run_process',run)
    p={'id':'p','story_version':1,'title':'Decoder fallback','settings':{'render_options':{'subtitles':False}}}
    settings={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':12}
    report=media.render_project(tmp_path,p,chunks,scenes,assets,settings,lambda *args:None)
    assert all(report['checks'].values()),report
    assert seen[-1]==main and compatible in seen
