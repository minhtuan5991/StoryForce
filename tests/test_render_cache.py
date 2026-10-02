import json
from PIL import Image, ImageDraw
from backend import media
from backend.config import DEFAULT_SETTINGS
from backend.render_cache import RenderCache, reuse_file
from test_media import wav_data


def test_pruning_only_owned_entries_preserves_previous_outputs_and_unknown_files(tmp_path):
    metadata={'duration':2,'video_duration':0,'has_audio':True}
    cache=RenderCache(tmp_path/'cache',lambda *args:metadata,DEFAULT_SETTINGS)
    pending=tmp_path/'pending.wav';pending.write_bytes(b'original audio')
    first=cache.path('audio',{'gain':0},'.wav');cache.publish(pending,first)
    old=tmp_path/'previous-render.wav';reuse_file(first,old)
    owned_json=first.with_suffix('.wav.json')
    unrelated=cache.directory/'user-upload.png';unrelated.write_bytes(b'keep')
    unowned=cache.directory/'unowned.wav';unowned.write_bytes(b'keep')
    unowned.with_suffix('.wav.json').write_text(json.dumps({'signature':[],'metadata':metadata}),encoding='utf-8')
    second=cache.path('audio',{'gain':1},'.wav');pending.write_bytes(b'new audio');cache.publish(pending,second)
    cache.used={second};cache.prune()
    assert not first.exists() and not owned_json.exists()
    assert old.read_bytes()==b'original audio' and second.read_bytes()==b'new audio'
    assert unrelated.read_bytes()==b'keep' and unowned.read_bytes()==b'keep'
    assert cache.valid(second,duration=2)
    second.write_bytes(b'corrupted')
    assert not cache.valid(second,duration=2)


def test_rerender_reuses_timeline_audio_and_key_but_rebuilds_changed_inputs(tmp_path):
    (tmp_path/'logs').mkdir()
    settings={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':12,
              'render_encoder':'cpu','transition_seconds':0}
    binary=media.find_binary('ffmpeg',settings)
    (tmp_path/'voice.wav').write_bytes(wav_data(2))
    Image.new('RGB',(320,180),'blue').save(tmp_path/'first.png')
    Image.new('RGB',(320,180),'yellow').save(tmp_path/'second.png')
    logo=Image.new('RGBA',(320,180),(0,0,0,0));ImageDraw.Draw(logo).rectangle((200,140,240,160),fill='red');logo.save(tmp_path/'logo.png')
    wave=tmp_path/'wave.mp4'
    media.run_process([binary,'-v','error','-y','-f','lavfi','-i','color=c=0x2DA63B:s=320x180:r=24',
        '-vf','drawbox=x=50:y=145:w=200:h=10:color=white:t=fill','-t','0.5','-an','-c:v','libx264',str(wave)])
    assets=[{'id':'voice','path':'voice.wav','kind':'audio','duration':2,'metadata_json':media.probe(tmp_path/'voice.wav',settings)}, {'id':'first','path':'first.png','kind':'image'},
            {'id':'second','path':'second.png','kind':'image'}, {'id':'logo','path':'logo.png','kind':'image'},
            {'id':'wave','path':'wave.mp4','kind':'video','duration':.5}]
    chunks=[{'id':'c','number':1,'text':'First scene. Second scene.','asset_id':'voice','real_duration':2}]
    scenes=[{'id':str(i),'number':i+1,'scene_key':f'scene_{i+1:03}','offset':i,'duration':1,
             'asset_id':name} for i,name in enumerate(('first','second'))]
    for item in chunks+scenes:item.update(story_version=1,status='ATTACHED')
    p={'id':'p','title':'Cache','story_version':1,'settings':{'render_options':{'subtitles':False,
       'waveform':True,'waveform_asset_id':'wave','overlay':True,'logo_asset_id':'logo'}}}
    def render():
        result=media.render_project(tmp_path,p,chunks,scenes,assets,settings,lambda *args:None)
        assert all(result['checks'].values()),result
        return result
    cold=render();old=(tmp_path/cold['file']).read_bytes()
    assert cold['render_performance']['timeline_stream_copy']
    # Branding and displayed text do not change the actual narration/timeline.
    ImageDraw.Draw(logo).rectangle((200,140,240,160),fill='cyan');logo.save(tmp_path/'logo.png')
    chunks[0]['text']='Updated subtitle text. Same narration audio.'
    warm=render();perf=warm['render_performance']
    assert perf['cached_scenes']==2 and perf['timeline_cached'] and perf['audio_cached'] and perf['waveform_cached']
    assert (tmp_path/cold['file']).read_bytes()==old
    # Changing only volume rebuilds the audio mix, leaving video and normalization cached.
    settings['narration_db']=3
    gain=render()['render_performance']
    assert gain['narration_cached'] and gain['timeline_cached'] and not gain['audio_cached']
    # Never trust a cache file that was truncated/replaced outside the renderer.
    folder=tmp_path/'projects/p/render'
    cached_timeline=next((folder/'processing_cache').glob('timeline-*.mp4'))
    cached_timeline.write_bytes(b'corrupt')
    corrupt=render()['render_performance']
    assert not corrupt['timeline_cached'] and corrupt['timeline_stream_copy']
    # Image timing follows the new narration length, with no stale audio.
    (tmp_path/'voice.wav').write_bytes(wav_data(2.75,frequency=410));chunks[0]['real_duration']=2.75
    assets[0].update(duration=2.75,metadata_json=media.probe(tmp_path/'voice.wav',settings))
    changed=render()['render_performance']
    assert changed['cached_scenes']==0 and changed['rendered_scenes']==2
    assert not changed['narration_cached'] and not changed['audio_cached'] and not changed['timeline_cached']
