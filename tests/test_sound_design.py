from array import array
import hashlib
import math
from pathlib import Path
import wave

import pytest
from PIL import Image

from backend.config import DEFAULT_SETTINGS
from backend.media import find_binary, probe, render_inputs_hash, render_project, run_process
from backend.models import Job, Project
from backend.sound_design import EFFECTS, RATE, anchor_index, assets_for_plan, effect_path, plan, prepare_library, sound_gain


def story_fixture():
    tokens = [f'word{i}' for i in range(120)]
    anchor = 'The radio suddenly crackled beside me'
    tokens[80:86] = anchor.split()
    text = ' '.join(tokens)
    p = {'id':'fixture', 'title':'Mystery', 'draft':text, 'story_version':1, 'wpm':150,
         'settings':{'production_options':{'music_enabled':True}, 'render_options':{'subtitles':False}}}
    scenes = [{'id':'s1','scene_key':'scene_001','number':1,'start_word':0,'end_word':60,'duration':30,'offset':0},
              {'id':'s2','scene_key':'scene_002','number':2,'start_word':60,'end_word':120,'duration':30,'offset':30,
               'continuity':{'sound_cues':[{'kind':'radio_static','anchor_text':anchor}]}}]
    chunks = [{'id':'c','number':1,'text':text,'real_duration':60,'status':'ATTACHED','story_version':1}]
    return p, chunks, scenes


def test_opening_and_scene_cues_use_real_narration_clock_and_exclude_outro():
    p,chunks,scenes = story_fixture()
    chunks.append({'number':2,'text':'Subscribe to the next story.','real_duration':8,'voice_profile':{'segment_role':'outro'}})
    result=plan(p,chunks,scenes)
    assert result['timing']=='actual' and result['story_seconds']==60
    assert result['opening_seconds']==30
    assert result['cues'][0]['kind']=='opening_texture' and result['cues'][0]['duration']==30
    radio=next(c for c in result['cues'] if c['kind']=='radio_static')
    assert radio['source']=='story_plan' and radio['offset']==40
    assert radio['scene_key']=='scene_002'
    assert all(c['offset']+c['duration']<=60 for c in result['cues'])
    # Uneven speech rates must change the cue, not rely on a uniform estimate.
    words=p['draft'].split()
    measured=[{'number':1,'text':' '.join(words[:60]),'real_duration':10},
              {'number':2,'text':' '.join(words[60:]),'real_duration':120}]
    assert next(c for c in plan(p,measured,scenes)['cues'] if c['kind']=='radio_static')['offset']==50
    assert plan(p,[],scenes)['timing']=='estimated'
    assert next(c for c in plan(p,[],scenes)['cues'] if c['kind']=='radio_static')['offset']==32


def test_cues_reject_missing_repeated_or_invented_literal_anchors():
    assert anchor_index('Same words in this place. Same words in this place.', 'Same words in this place') is None
    assert anchor_index('Same words in this place. Same words in this place.', 'Same words in this place',5,10)==5
    p,chunks,scenes=story_fixture()
    p['draft']=p['draft'].replace('The radio suddenly crackled beside me','The silent radio rested beside me')
    chunks[0]['text']=p['draft']
    scenes[1]['continuity']['sound_cues']=[{'kind':'radio_static','anchor_text':'The silent radio rested beside me'},
                                         {'kind':'soft_impact','anchor_text':'A monster invented by the model'}]
    assert all(c['source']=='opening' for c in plan(p,chunks,scenes)['cues'])
    for negated in ('I never heard a knock at the door.', 'The radio did not crackle or make static.',
                    'I could not hear any knocking.', 'There was no radio static at all.'):
        p['draft']=negated;chunks[0]['text']=negated
        assert not any(c['kind'] in ('radio_static','muted_knock') for c in plan(p,chunks,[])['cues'])
    scenes[1]['continuity']['sound_cues']='invalid older data'
    assert plan(p,chunks,scenes)['enabled']


def test_short_stories_clip_opening_and_disabled_projects_have_no_effects():
    p,_,_=story_fixture()
    p['draft']='A strange photograph lay beside the closed window.'
    result=plan(p,[{'number':1,'text':p['draft'],'real_duration':8}],[])
    assert result['opening_seconds']==8
    assert all(c['offset']+c['duration']<=8 for c in result['cues'])
    p['settings']['sound_design']={'enabled':False}
    assert plan(p)['cues']==[] and not plan(p)['enabled']
    p['settings']={}
    assert not plan(p)['enabled']


def test_later_cues_are_spaced_and_capped():
    text=' '.join(f'Before event {i}, the radio suddenly crackled beside station {i}.' for i in range(100))
    p={'draft':text,'wpm':150,'settings':{'sound_design':{'enabled':True}}}
    result=plan(p,[{'number':1,'text':text,'real_duration':1800}])
    later=[c for c in result['cues'] if c['offset']>=30]
    assert 0<len(later)<=10
    assert all(b['offset']-a['offset']>=25 for a,b in zip(later,later[1:]))
    assert len([c for c in result['cues'] if c['offset']<30 and c['kind']!='opening_texture'])<=3


def test_shared_effect_library_is_reused_and_repairs_incomplete_files(tmp_path):
    prepare_library(tmp_path)
    snapshots={kind:(effect_path(tmp_path,kind).stat().st_mtime_ns,effect_path(tmp_path,kind).read_bytes()) for kind in EFFECTS}
    prepare_library(tmp_path)
    for kind,(duration,_) in EFFECTS.items():
        path=effect_path(tmp_path,kind)
        assert (path.stat().st_mtime_ns,path.read_bytes())==snapshots[kind]
        with wave.open(str(path),'rb') as audio:
            assert audio.getframerate()==RATE and audio.getnframes()==round(duration*RATE)
            samples=array('h',audio.readframes(audio.getnframes()))
        assert max(abs(s) for s in samples)<32767*.71
        assert samples[0]==0 and abs(samples[-1])<100
    effect_path(tmp_path,'radio_static').write_bytes(b'incomplete')
    prepare_library(tmp_path)
    assert effect_path(tmp_path,'radio_static').read_bytes()==snapshots['radio_static'][1]
    p,chunks,scenes=story_fixture()
    assert all((tmp_path/a['path']).is_file() for a in assets_for_plan(tmp_path,plan(p,chunks,scenes)))
    with pytest.raises(ValueError):effect_path(tmp_path,'../../secret')


def test_sound_gain_keeps_speech_clear_and_bounds_peaks():
    voice={'silent':False,'rms_db':-22,'peak_db':-3}
    effect={'silent':False,'rms_db':-12,'peak_db':-6}
    assert sound_gain(voice,effect)==-17
    assert sound_gain(voice,effect,texture=True)==-24
    assert sound_gain(voice,effect,narration_db=3)==-14
    assert sound_gain({**voice,'silent':True},effect)==-18
    assert sound_gain(voice,{**effect,'peak_db':0})<=-7


def test_sound_settings_api_and_render_fingerprint(client,project,tmp_path):
    with client.app.state.database.session() as db:
        p=db.get(Project,project['id']);p.locked=True;p.draft='Something strange was waiting behind the door.'
        p.settings={**p.settings,'production_options':{'music_enabled':True}}
        p.publish={**p.publish,'final_reviewed':True};db.commit()
    base='/api/projects/'+project['id']+'/sound-design'
    assert client.get(base).json()['enabled'] and not client.get(base).json()['prepared']
    assert client.post(base,json={'enabled':'yes'}).status_code==422
    assert client.post(base,json={'arbitrary':'data'}).status_code==422
    result=client.post(base,json={})
    assert result.status_code==200 and result.json()['prepared']
    assert client.get(base+'/effects/opening_texture').status_code==200
    assert client.get(base+'/effects/unknown').status_code==422
    assert client.post(base,json={'enabled':False}).json()['enabled'] is False
    with client.app.state.database.session() as db:
        assert not db.get(Project,project['id']).publish['final_reviewed']
        db.add(Job(project_id=project['id'],kind='image_generation',status='waiting_user'));db.commit()
    assert client.post(base,json={'enabled':True}).status_code==422
    p,chunks,scenes=story_fixture()
    before=render_inputs_hash(p,chunks,scenes,[],DEFAULT_SETTINGS)
    p['settings']['sound_design']={'enabled':False}
    assert render_inputs_hash(p,chunks,scenes,[],DEFAULT_SETTINGS)!=before


@pytest.mark.skipif(not find_binary('ffmpeg',DEFAULT_SETTINGS),reason='FFmpeg unavailable')
def test_real_render_adds_opening_and_later_cue_preserving_steady_music_and_cache(tmp_path):
    (tmp_path/'logs').mkdir()
    config={**DEFAULT_SETTINGS,'render_width':160,'render_height':90,'render_fps':8,'render_encoder':'cpu'}
    binary=find_binary('ffmpeg',config)
    for name,freq,length in (('voice',900,60),('outro',900,8),('music',185.3,16)):
        run_process([binary,'-v','error','-y','-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000','-t',str(length),str(tmp_path/(name+'.wav'))])
    Image.new('RGB',(160,90),(30,40,65)).save(tmp_path/'image.png')
    p,chunks,scenes=story_fixture()
    chunks[0]['asset_id']='voice'
    chunks.append({'id':'outro','number':2,'text':'Listen again next time.','asset_id':'outro','real_duration':8,
                   'story_version':1,'status':'ATTACHED','voice_profile':{'segment_role':'outro'}})
    scenes[1]['duration']=38
    for s in scenes:s.update(asset_id='image',story_version=1,status='ATTACHED')
    assets=[{'id':name,'path':name+'.wav','kind':'music' if name=='music' else 'audio','duration':length,'story_version':1,
             'sha256':hashlib.sha256((tmp_path/(name+'.wav')).read_bytes()).hexdigest(),'metadata_json':probe(tmp_path/(name+'.wav'),config)}
            for name,length in (('voice',60),('outro',8),('music',16))]
    assets.append({'id':'image','path':'image.png','kind':'image','story_version':1,'sha256':'image'})
    p['settings']['background_music']={'asset_id':'music'}
    report=render_project(tmp_path,p,chunks,scenes,assets,config,lambda *args:None)
    assert all(report['checks'].values()),report
    assert probe(tmp_path/report['file'],config)['duration']==pytest.approx(68,abs=.2)
    design=report['audio_mix']['sound_design']
    assert design['enabled'] and design['timing']=='actual'
    assert any(c['kind']=='radio_static' and c['offset']==40 for c in design['cues'])
    assert (tmp_path/report['file']).parent.joinpath('sound_design.json').is_file()
    def read_audio(r):
        with wave.open(str((tmp_path/r['file']).parent/'final_audio.wav'),'rb') as audio:
            return audio.getframerate(),audio.getnchannels(),array('h',audio.readframes(audio.getnframes()))
    rate,channels,with_effects=read_audio(report)
    warm=render_project(tmp_path,p,chunks,scenes,assets,config,lambda *args:None)
    assert warm['render_performance']['audio_cached']
    p['settings']['sound_design']={'enabled':False}
    plain=render_project(tmp_path,p,chunks,scenes,assets,config,lambda *args:None)
    assert plain['render_performance']['timeline_cached'] and plain['render_performance']['narration_cached']
    assert not plain['render_performance']['audio_cached']
    assert not plain['audio_mix']['sound_design']['enabled']
    assert report['audio_mix']['music']==plain['audio_mix']['music']
    assert report['audio_mix']['ducking'] is False
    _,_,without_effects=read_audio(plain)
    def difference(start,seconds=1):
        start=int(start*rate*channels);end=start+int(seconds*rate*channels)
        return math.sqrt(sum((a-b)**2 for a,b in zip(with_effects[start:end],without_effects[start:end]))/(end-start))
    assert difference(1)>20  # Sustained opening layer is audible.
    assert difference(40.2,.8)>20  # Later cue is actually mixed, not just in the report.
    assert difference(32)<2 and difference(50)<2 and difference(65)<2  # No stray effects in the outro.
    assert max(abs(s) for s in with_effects)<=32767*.951
