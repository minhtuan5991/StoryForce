import pytest

from backend.audio_balance import measure_level, music_balance
from backend.background_music import music_volume_filter
from backend.config import DEFAULT_SETTINGS
from backend.media import find_binary, run_process

ASSET={'metadata_json':{'envelope_version':1,'intro_seconds':30,'intro_db':-23,'body_db':-31}}
VOICE={'rms_db':-24.0,'peak_db':-8.0,'lufs':-21.0,'silent':False}
MUSIC={'rms_db':-18.0,'peak_db':-3.0,'lufs':-17.0,'silent':False}


def test_legacy_lyria_track_uses_native_level_and_ignores_saved_attenuation():
    normal=music_balance(ASSET,-28,VOICE,MUSIC)
    louder=music_balance(ASSET,-25,VOICE,MUSIC)
    quieter=music_balance(ASSET,-34,VOICE,MUSIC)
    assert normal['intro_db']==normal['body_db'] and normal['intro_seconds']==0
    assert normal['body_db']==louder['body_db']==quieter['body_db']==0
    assert not normal['ducking'] and normal['max_duck_db']==0
    assert normal['actual_gap_db']==VOICE['rms_db']-MUSIC['rms_db']
    assert normal['source_level_preserved'] and not normal['saved_music_setting_applied']
    assert music_volume_filter(ASSET,-28,balance=normal)==f"volume={normal['body_db']}dB"


@pytest.mark.parametrize('source_db',[-40,-18,-8])
def test_music_with_different_source_levels_is_not_normalized(source_db):
    source={**MUSIC,'rms_db':source_db,'peak_db':source_db+8}
    plan=music_balance(ASSET,-28,VOICE,source)
    assert plan['body_db']==0
    assert plan['intro_db']==plan['body_db']


def test_source_gain_is_not_lowered_for_speech_and_silent_tracks_are_not_boosted():
    loud=music_balance(ASSET,0,VOICE,MUSIC)
    assert loud['body_db']==0 and loud['body_gap_db'] is None
    silent=music_balance(ASSET,-28,VOICE,{'rms_db':-91,'peak_db':-91,'lufs':-70,'silent':True})
    assert not silent['measured'] and silent['source_silent']
    assert silent['intro_db']==0 and silent['body_db']==0


def test_level_measurements_are_cached_and_changed_audio_is_remeasured(tmp_path,monkeypatch):
    binary=find_binary('ffmpeg',DEFAULT_SETTINGS)
    source=tmp_path/'source.wav';cache=tmp_path/'cache'
    def tone(gain):
        run_process([binary,'-v','error','-y','-f','lavfi','-i','sine=frequency=900:sample_rate=24000',
                     '-t','4','-af',f'volume={gain}dB',str(source)])
    tone(0)
    original=measure_level(source,binary,cache)
    calls=[]
    from backend import media
    real_run=media.run_process
    def counted(*args,**kwargs):
        calls.append(args[0]);return real_run(*args,**kwargs)
    monkeypatch.setattr(media,'run_process',counted)
    assert measure_level(source,binary,cache)==original and not calls
    tone(-6)
    changed=measure_level(source,binary,cache)
    assert changed['rms_db']-original['rms_db']==pytest.approx(-6,abs=.2)
    assert len([args for args in calls if 'ebur128=framelog=verbose,volumedetect' in args])==1


def test_passenger_project_music_keeps_its_source_level_without_changing_narration():
    voice={'rms_db':-26.6,'peak_db':-3.5,'lufs':-22.9,'silent':False}
    source={'rms_db':-13.8,'peak_db':-.1,'lufs':-12,'silent':False}
    plan=music_balance(ASSET,-28,voice,source)
    assert plan['body_db']==0
    assert plan['narration_rms_db']==voice['rms_db']
    assert plan['volume_mode']=='constant' and not plan['ducking']


def test_mix_version_changes_render_fingerprint_only_for_music(monkeypatch):
    from backend import audio_balance
    from backend.media import render_inputs_hash
    project={'story_version':1,'settings':{}}
    music=[{'id':'music','kind':'music','path':'bed.wav'}]
    first=render_inputs_hash(project,[],[],music,DEFAULT_SETTINGS)
    no_music=render_inputs_hash(project,[],[],[],DEFAULT_SETTINGS)
    monkeypatch.setattr(audio_balance,'MIX_VERSION',audio_balance.MIX_VERSION+1)
    assert render_inputs_hash(project,[],[],music,DEFAULT_SETTINGS)!=first
    assert render_inputs_hash(project,[],[],[],DEFAULT_SETTINGS)==no_music
