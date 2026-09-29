import pytest
from backend.media import timeline_from_audio, fit_visual_timeline, build_render_plan, validate_logo
from backend.config import DEFAULT_SETTINGS
from PIL import Image, ImageDraw


def test_only_images_absorb_time_between_fixed_video_anchors():
    chunks=[{'id':'c','number':1,'text':'one two three four five','real_duration':20}]
    scenes=[{'id':str(i),'number':i+1,'start_word':i,'end_word':i+1,'offset':i*4,'duration':4,'asset_id':str(i)} for i in range(5)]
    assets=[{'id':str(i),'kind':'video' if i in (1,3) else 'image','duration':2 if i==1 else 3} for i in range(5)]
    result=timeline_from_audio(chunks,scenes,assets)
    rows=result['scenes']
    assert [(s['offset'],s['duration']) for s in rows]==[(0,4),(4,2),(6,6),(12,3),(15,5)]
    # Re-sync is idempotent and does not move existing video starts.
    synced=[{**s,**t} for s,t in zip(scenes,rows)]
    assert timeline_from_audio(chunks,synced,assets)==result
    plan=build_render_plan(rows,DEFAULT_SETTINGS,20)
    assert all(s['transition_after']==0 for s in plan['scenes'])
    assert plan['scenes'][1]['clip_duration']==2


def test_short_final_video_uses_only_assigned_thumbnail_for_remaining_audio():
    scenes=[{'id':'a','number':1,'offset':0,'duration':4,'asset_id':'a'},
            {'id':'b','number':2,'offset':4,'duration':6,'asset_id':'v'}]
    assets=[{'id':'a','kind':'image'},{'id':'v','kind':'video','duration':2},{'id':'thumb','kind':'image'}]
    with pytest.raises(ValueError,match='ending thumbnail'):
        fit_visual_timeline(scenes,scenes,assets,10)
    result=fit_visual_timeline(scenes,scenes,assets,10,'thumb')
    assert result[1]['offset']==4 and result[1]['duration']==2
    assert result[-1]['asset_id']=='thumb' and result[-1]['offset']==6 and result[-1]['duration']==4


def test_conflicting_video_anchors_fail_without_cutting_or_moving():
    scenes=[{'id':'a','number':1,'offset':0,'duration':2,'asset_id':'a'},
            {'id':'b','number':2,'offset':2,'duration':2,'asset_id':'b'}]
    assets=[{'id':'a','kind':'video','duration':3},{'id':'b','kind':'video','duration':2}]
    with pytest.raises(ValueError,match='overlap'):
        fit_visual_timeline(scenes,scenes,assets,10)
    assets[0]['duration']=12
    with pytest.raises(ValueError,match='beyond the narration'):
        fit_visual_timeline(scenes,scenes,assets,10)


def test_overlay_rejects_opaque_or_wrong_size_instead_of_resizing(tmp_path):
    settings={**DEFAULT_SETTINGS,'render_width':320,'render_height':180}
    path=tmp_path/'logo.png'
    Image.new('RGB',(320,180),'red').save(path)
    with pytest.raises(ValueError,match='transparent PNG'):validate_logo(path,settings)
    Image.new('RGBA',(64,64),(0,0,0,0)).save(path)
    with pytest.raises(ValueError,match='320 x 180'):validate_logo(path,settings)
    im=Image.new('RGBA',(320,180),(0,0,0,0));ImageDraw.Draw(im).rectangle((15,85,55,125),fill='red');im.save(path)
    validate_logo(path,settings)


def test_frame_rounding_does_not_accumulate_before_a_video():
    rows=[{'id':str(i),'number':i,'offset':i*.113,'duration':.113,'media_kind':'image'} for i in range(40)]
    rows.append({'id':'video','number':40,'offset':4.52,'duration':8,'media_kind':'video'})
    plan=build_render_plan(rows,{**DEFAULT_SETTINGS,'render_fps':30},12.52)
    previous_frames=sum(s['clip_frames']-round(s['transition_after']*30) for s in plan['scenes'][:-1])
    assert previous_frames==round(4.52*30)
    assert plan['scenes'][-1]['clip_frames']==240


def test_render_last_video_once_then_thumbnail(tmp_path):
    from backend.media import render_project,run_process,find_binary,probe,render_inputs_hash
    from test_media import wav_data
    (tmp_path/'logs').mkdir();ffmpeg=find_binary('ffmpeg',DEFAULT_SETTINGS)
    video=tmp_path/'v.mp4'
    run_process([ffmpeg,'-y','-f','lavfi','-i','color=c=blue:s=320x180:r=12','-t','0.5','-c:v','libx264',str(video)])
    Image.new('RGB',(320,180),'red').save(tmp_path/'image.png')
    Image.new('RGB',(320,180),'yellow').save(tmp_path/'thumbnail.png')
    (tmp_path/'a.wav').write_bytes(wav_data(3))
    assets=[{'id':'a','path':'a.wav','kind':'audio','duration':3,'metadata_json':probe(tmp_path/'a.wav',DEFAULT_SETTINGS)},
            {'id':'v','path':'v.mp4','kind':'video','duration':.5}, {'id':'i','path':'image.png','kind':'image'},
            {'id':'t','path':'thumbnail.png','kind':'image'}]
    scenes=[{'id':'1','scene_key':'S1','number':1,'offset':0,'duration':1,'asset_id':'i','visual_type':'IMAGE','status':'ATTACHED','story_version':1},
            {'id':'2','scene_key':'S2','number':2,'offset':1,'duration':2,'asset_id':'v','visual_type':'VIDEO','status':'ATTACHED','story_version':1}]
    chunks=[{'id':'c','number':1,'asset_id':'a','real_duration':3,'text':'One two three.','status':'ATTACHED','story_version':1}]
    p={'id':'p','title':'Test','story_version':1,'publish':{'thumbnail_asset_id':'t'},'settings':{'render_options':{'subtitles':False}}}
    config={**DEFAULT_SETTINGS,'render_width':320,'render_height':180,'render_fps':12}
    r=render_project(tmp_path,p,chunks,scenes,assets,config,lambda *a:None)
    assert all(r['checks'].values()),r
    assert r['inputs_hash']==render_inputs_hash(p,chunks,scenes,assets,config)
    for time,expected in ((.8,(255,0,0)),(1.1,(0,0,255)),(1.6,(255,255,0)),(2.8,(255,255,0))):
        out=tmp_path/f'f{time}.png'
        run_process([ffmpeg,'-y','-ss',str(time),'-i',str(tmp_path/r['file']),'-frames:v','1',str(out)])
        with Image.open(out) as im:
            actual=im.convert('RGB').getpixel((160,90))
            assert max(abs(a-b) for a,b in zip(actual,expected))<16,(time,actual)
