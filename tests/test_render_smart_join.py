import hashlib
import subprocess

import pytest
from PIL import Image, ImageDraw

from backend import media, render_pipeline
from backend.config import DEFAULT_SETTINGS
from backend.render_acceleration import video_encoding
from backend.render_cache import RenderCache
from backend.render_smart_join import keyframe_args, scene_parts


def moving_clips(folder, fps):
    settings = {**DEFAULT_SETTINGS, 'render_width': 160, 'render_height': 90,
                'render_fps': fps, 'render_encoder': 'cpu', 'transition_seconds': .2}
    binary = media.find_binary('ffmpeg', settings)
    base = [binary, '-v', 'error', '-y', '-threads', '1']
    durations = [.71, .89, 1.03, .82, .96, .78, 1.10]
    scenes, offset = [], 0
    for i, duration in enumerate(durations):
        scenes.append({'offset': offset, 'duration': duration, 'media_kind': 'video' if i == 2 else 'image'})
        offset += duration
    plan = media.build_render_plan(scenes, settings, offset)
    plan['smart_join_ready'] = True
    parts = scene_parts(plan)
    clips = []
    def encode(args, path):
        media.run_process([*args, *video_encoding('libx264', True), '-color_range', 'tv',
                           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', str(path)])
        return 'libx264'
    for i, scene in enumerate(plan['scenes']):
        image = Image.new('RGB', (640, 360), (70 + i * 20, 30 + i * 15, 160 - i * 10))
        draw = ImageDraw.Draw(image)
        for x in range(0, 640, 40):draw.rectangle((x, 0, x + 5, 359), fill=(220, 210, 190))
        for y in range(0, 360, 40):draw.rectangle((0, y, 639, y + 5), fill=(20, 30, 40))
        source = folder / f'image-{i}.png'
        image.save(source)
        clip = folder / f'scene-{i}.mp4'
        # Moving grid makes a missing/repeated frame or restarted pan observable.
        vf = (f"zoompan=z='1+on*0.002':x='on*0.5':y='on*0.2':d={scene['clip_frames']}:s=160x90:fps={fps},"
              'format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709')
        encode([*base, '-i', str(source), '-vf', vf, '-frames:v', str(scene['clip_frames']),
                '-an', *keyframe_args(*parts[i], fps)], clip)
        clips.append(clip)
    return settings, base, plan, clips, encode


def decoded_frames(binary, path):
    result = subprocess.run([binary, '-v', 'error', '-xerror', '-i', str(path), '-an', '-pix_fmt', 'gray',
                             '-f', 'rawvideo', 'pipe:1'], capture_output=True, timeout=45,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    assert result.returncode == 0, result.stderr.decode(errors='replace')
    frame_size = 160 * 90
    assert len(result.stdout) % frame_size == 0
    return [result.stdout[i:i + frame_size] for i in range(0, len(result.stdout), frame_size)]


@pytest.mark.parametrize('fps', [24, 30])
def test_smart_join_preserves_every_motion_frame_and_matches_legacy_fades_with_fractional_timing(tmp_path, fps):
    settings, base, plan, clips, encode = moving_clips(tmp_path, fps)
    old_folder, new_folder = tmp_path / 'old', tmp_path / 'new'
    old_folder.mkdir();new_folder.mkdir()
    cache = RenderCache(tmp_path / 'cache', media.probe, settings)
    old, _, _ = render_pipeline.compose_clips(clips, plan, old_folder, base, encode, lambda *args: None)
    calls = []
    def counted(args, path):
        calls.append(path)
        return encode(args, path)
    stats = {}
    def render():
        return render_pipeline.compose_clips(clips, plan, new_folder, base, counted, lambda *args: None,
            cache=cache, remux=media.run_process, stats=stats, smart_join=True,
            inspect=lambda path: media.probe(path, settings))[0]
    output = render()
    old_frames = decoded_frames(base[0], old)
    new_frames = decoded_frames(base[0], output)
    assert len(new_frames) == len(old_frames) == round(plan['duration'] * fps)
    assert stats['timeline_local_transitions'] and stats['transition_windows'] == 4
    assert len(calls) == 4
    assert stats['copied_body_frames'] + stats['transition_frames'] == len(new_frames)
    cursor = 0
    sources = [decoded_frames(base[0], clip) for clip in clips]
    for index, (start, end, outgoing) in enumerate(scene_parts(plan)):
        source_frames = sources[index]
        assert new_frames[cursor:cursor + end - start] == source_frames[start:end]
        cursor += end - start
        for step in range(outgoing):
            expected = [round((a * (outgoing - step) + b * step) / outgoing)
                        for a, b in zip(source_frames[end + step], sources[index + 1][step])]
            actual = new_frames[cursor + step]
            assert sum(abs(a - b) for a, b in zip(actual, expected)) / len(actual) < 3
        cursor += outgoing
    assert cursor == len(new_frames)
    # Compare the actual old and new decoded pixels, including all fade frames.
    errors = [sum(abs(a - b) for a, b in zip(left, right)) / len(left)
              for left, right in zip(old_frames, new_frames)]
    # Legacy joining encodes entire bodies again at each grouping level.
    # The new bodies match their source exactly; allow the old lossy encode's
    # small pixel differences instead of treating those artifacts as a target.
    assert max(errors) < 4, max(errors)
    assert sum(errors) / len(errors) < 3, sum(errors) / len(errors)
    cache.prune()
    cache = RenderCache(tmp_path / 'cache', media.probe, settings)
    calls.clear();render()
    assert stats['timeline_cached'] and not calls
    cache.prune()
    assert len(list(cache.directory.glob('transition-*.mp4'))) == 4
    # Only the fade adjacent to a changed clip is rebuilt.
    media.run_process([*base, '-i', str(clips[0]), '-vf', 'hue=h=45', '-an', '-bf', '0',
                       *keyframe_args(*scene_parts(plan)[0], fps), *video_encoding('libx264', True),
                       str(tmp_path / 'changed.mp4')])
    (tmp_path / 'changed.mp4').replace(clips[0])
    cache = RenderCache(tmp_path / 'cache', media.probe, settings)
    render()
    assert not stats['timeline_cached'] and len(calls) == 1


@pytest.mark.parametrize('failure', ['frame_grid', 'encoder'])
def test_bad_segment_or_changed_encoder_falls_back_without_deleting_sources(tmp_path, failure):
    settings, base, plan, clips, encode = moving_clips(tmp_path, 30)
    original = [hashlib.sha256(path.read_bytes()).hexdigest() for path in clips]
    def inspect(path):
        info = media.probe(path, settings)
        if failure == 'frame_grid' and path.name.startswith('smart-body'):
            info['video_frames'] -= 1
        return info
    def failing_encoder(args, path):
        result = encode(args, path)
        return 'h264_nvenc' if failure == 'encoder' and path.name.startswith('smart-fade') else result
    stats = {}
    result, groups, _ = render_pipeline.compose_clips(clips, plan, tmp_path, base, failing_encoder, lambda *args: None,
        remux=media.run_process, inspect=inspect, stats=stats, smart_join=True)
    assert groups > 0 and not stats['timeline_local_transitions'] and stats['smart_join_fallback']
    assert media.probe(result, settings)['video_frames'] == round(plan['duration'] * 30)
    assert not list(tmp_path.glob('smart-*.mp4'))
    assert [hashlib.sha256(path.read_bytes()).hexdigest() for path in clips] == original


def test_unknown_container_frame_count_does_not_reject_existing_webm_assets():
    info = media.parse_probe({'format': {'duration': '10'}, 'streams': [
        {'codec_type': 'video', 'avg_frame_rate': '30/1', 'nb_frames': 'N/A', 'has_b_frames': 'N/A'}]})
    assert info['has_video'] and info['duration'] == 10 and info['fps'] == 30
    assert info['video_frames'] == 0 and info['has_b_frames'] == 0
