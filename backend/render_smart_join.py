"""Render only fade windows; retain the already rendered motion in scene bodies."""
from pathlib import Path

from .render_cache import file_signature


def scene_parts(plan):
    fps = plan['fps']
    incoming = 0
    parts = []
    for scene in plan['scenes']:
        outgoing = round(scene['transition_after'] * fps)
        end = scene['clip_frames'] - outgoing
        if not 0 <= incoming < end <= scene['clip_frames']:
            raise ValueError('Transition windows leave no scene body')
        parts.append((incoming, end, outgoing))
        incoming = outgoing
    return parts


def keyframe_args(start, end, outgoing, fps):
    times = [value / fps for value in (start, end if outgoing else 0) if value > 0]
    # No B-frame reordering: exact packet cuts then have the same PTS and DTS.
    return ['-bf', '0', '-force_key_frames', ','.join(f'{v:.9f}' for v in sorted(set(times)))] if times else ['-bf', '0']


def _check(path, frames, plan, inspect):
    info = inspect(path)
    if (info.get('video_frames') != frames or info.get('has_b_frames', 0) != 0
            or info['width'] != plan['width'] or info['height'] != plan['height']
            or abs(info['fps'] - plan['fps']) > .01
            or abs(info['video_duration'] - frames / plan['fps']) > .002):
        raise ValueError('Smart timeline segment does not match the output frame grid')


def transition_key(clips, index, end, overlap, plan):
    return {'renderer': 2, 'left': file_signature(clips[index]), 'right': file_signature(clips[index + 1]),
            'start': end, 'frames': overlap, 'fps': plan['fps'], 'width': plan['width'],
            'height': plan['height'], 'encoder': plan['video_codec']}


def retain_transitions(clips, plan, cache):
    # A warm whole-timeline hit must also retain its component fades. Otherwise
    # pruning would erase them before a subsequent one-scene edit can reuse them.
    for index, (_, end, overlap) in enumerate(scene_parts(plan)):
        if overlap:
            path = cache.path('transition', transition_key(clips, index, end, overlap, plan), '.mp4')
            cache.valid(path, duration=overlap / plan['fps'], width=plan['width'], height=plan['height'], fps=plan['fps'])


def compose_local_transitions(clips, plan, folder, base, encode, remux, inspect, notify, *, cache=None, stats=None):
    fps = plan['fps']
    parts = scene_parts(plan)
    segments, owned = [], set()
    transitions = 0
    try:
        for index, (clip, (start, end, overlap)) in enumerate(zip(clips, parts)):
            body = folder / f'smart-body-{index:03}.mp4'
            owned.add(body)
            args = [*base, '-ss', f'{start / fps:.9f}', '-i', str(clip), '-map', '0:v:0', '-an',
                    '-c:v', 'copy', '-frames:v', str(end - start), '-avoid_negative_ts', 'make_zero', str(body)]
            remux(args)
            _check(body, end - start, plan, inspect)
            segments.append(body)
            if overlap:
                key = transition_key(clips, index, end, overlap, plan)
                fade = cache.path('transition', key, '.mp4') if cache else folder / f'smart-fade-{index:03}.mp4'
                if not cache or not cache.valid(fade, duration=overlap / fps, width=plan['width'], height=plan['height'], fps=fps):
                    pending = folder / f'smart-fade-{index:03}.mp4'
                    owned.add(pending)
                    graph = (f'[0:v]trim=end_frame={overlap},setpts=PTS-STARTPTS,fps={fps},settb=AVTB[a];'
                             f'[1:v]trim=end_frame={overlap},setpts=PTS-STARTPTS,fps={fps},settb=AVTB[b];'
                             f'[a][b]xfade=transition=fade:duration={overlap / fps:.9f}:offset=0,'
                             'scale=in_range=tv:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,'
                             'format=yuv420p,setparams=range=limited:color_primaries=bt709:'
                             'color_trc=bt709:colorspace=bt709[joined]')
                    args = [*base, '-ss', f'{end / fps:.9f}', '-i', str(clip), '-i', str(clips[index + 1]),
                            '-filter_complex_threads', '2', '-filter_complex', graph, '-map', '[joined]',
                            '-an', '-r', str(fps), '-frames:v', str(overlap), '-bf', '0']
                    actual_encoder = encode(args, pending)
                    if actual_encoder != plan['video_codec']:
                        raise ValueError('Transition encoder changed; use compatible timeline composition')
                    _check(pending, overlap, plan, inspect)
                    if cache:
                        cache.publish(pending, fade, render_encoder=actual_encoder)
                        owned.discard(pending)
                else:
                    _check(fade, overlap, plan, inspect)
                    if cache.metadata(fade).get('render_encoder') != plan['video_codec']:
                        raise ValueError('Cached transition encoder is incompatible')
                if not cache:
                    owned.add(fade)
                segments.append(fade)
                transitions += 1
            notify(78 + int(6 * (index + 1) / len(clips)), f'Joining scenes {index + 1}/{len(clips)} with local fades')
        listing = folder / 'smart-concat.txt'
        listing.write_text('\n'.join("file '" + str(Path(p).resolve()).replace('\\', '/').replace("'", "'\\''") + "'" for p in segments), encoding='utf-8')
        joined = folder / 'smart-joined.mp4'
        owned.add(joined)
        remux([*base, '-protocol_whitelist', 'file,pipe', '-f', 'concat', '-safe', '0', '-i', str(listing),
               '-map', '0:v:0', '-an', '-c:v', 'copy', str(joined)])
        _check(joined, round(plan['duration'] * fps), plan, inspect)
        for path in owned - {joined}:
            path.unlink(missing_ok=True)
        if stats is not None:
            stats.update(timeline_local_transitions=True, transition_windows=transitions,
                         transition_frames=sum(part[2] for part in parts),
                         copied_body_frames=sum(part[1] - part[0] for part in parts))
        notify(85, 'Joined timeline; scene motion and fades preserved')
        return joined, 0, {joined}
    except (ValueError, OSError):
        for path in owned:
            path.unlink(missing_ok=True)
        raise
