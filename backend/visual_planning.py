"""User-selected visual budgets, shared by UI, prompts and output validation."""
import math
from bisect import bisect_left, bisect_right
from .intelligence import duration_profile, words

DEFAULT_VIDEO_SECONDS = 10


def narration_clock(text, wpm, chunks=()):
    """Use the same word weights as audio sync; exclude a separate outro."""
    story_words = words(text)
    ordered = sorted((c for c in chunks if (c.get('voice_profile') or {}).get('segment_role') != 'outro'), key=lambda c: c['number'])
    chunk_words = [words(c['text']) for c in ordered]
    durations = [c.get('real_duration') for c in ordered]
    measured = (bool(ordered) and all(c.get('status') != 'STALE' for c in ordered)
                and all(isinstance(d, (int, float)) and math.isfinite(d) and d > 0 for d in durations)
                and [w for part in chunk_words for w in part][:len(story_words)] == story_words)
    if not measured:
        return [i * 60 / wpm for i in range(len(story_words) + 1)], 'estimated'
    clock, offset = [0.0], 0.0
    for part, duration in zip(chunk_words, durations):
        for i in range(1, len(part) + 1):
            if len(clock) > len(story_words):
                return clock, 'actual'
            clock.append(offset + duration * i / len(part))
        offset += duration
    return clock, 'actual'


def balance_scene_ranges(items, clock, minimums=None):
    """Reserve time for videos, preserving counts, order and contiguous words."""
    count, total = len(items), len(clock) - 1
    if not 0 < count <= total:
        raise ValueError('Not enough narration words for the selected scene count')
    if any(not math.isfinite(t) for t in clock) or any(b <= a for a, b in zip(clock, clock[1:])):
        raise ValueError('Narration timing must increase at every word')
    minimums = minimums if minimums is not None else [DEFAULT_VIDEO_SECONDS if s['visual_type'] == 'VIDEO' else 0 for s in items]
    if len(minimums) != count or any(not math.isfinite(t) or t < 0 for t in minimums):
        raise ValueError('Invalid video narration duration')
    latest = [0] * count + [total]
    for i in range(count - 1, -1, -1):
        end = latest[i + 1]
        latest[i] = min(end - 1, bisect_right(clock, clock[end] - minimums[i] + 1e-7) - 1) if end >= 0 else -1
        if latest[i] < 0:
            raise ValueError('Not enough narration for the selected videos (10 seconds each by default). Reduce the video count or add narration; videos will not be shortened or looped.')
    saved = (items[0].get('start_word') == 0 and items[-1].get('end_word') == total
             and all(isinstance(s.get('start_word'), int) and isinstance(s.get('end_word'), int)
                     and s['start_word'] < s['end_word'] for s in items)
             and all(a['end_word'] == b['start_word'] for a, b in zip(items, items[1:])))
    result, start = [], 0
    for i, item in enumerate(items):
        earliest = max(start + 1, bisect_left(clock, clock[start] + minimums[i] - 1e-7))
        preferred = item['end_word'] if saved else round(total * (i + 1) / count)
        end = max(earliest, min(preferred, latest[i + 1]))
        result.append({'start_word': start, 'end_word': end, 'narration_duration': clock[end] - clock[start]})
        start = end
    return result


def visual_budget(project, config, payload=None):
    total = min(200, max(2, round(sum(duration_profile(project['target_minutes'], project['wpm'])['scenes'])/2)))
    videos = min(total-1, int(total*config['visual_video_ratio']))
    standard = {'image_count':total-videos, 'video_count':videos}
    minimum = {'image_count':max(1, math.ceil(standard['image_count']/2)), 'video_count':math.ceil(videos/2)}
    options = {**((project.get('settings') or {}).get('visual_options') or {}), **(payload or {})}
    mode = options.get('mode','standard')
    if mode not in ('standard','minimum','custom'):
        raise ValueError('Choose standard, minimum or custom visual count')
    if mode == 'custom':
        chosen = {key:options.get(key) for key in ('image_count','video_count')}
        if any(isinstance(v,bool) or not isinstance(v,int) for v in chosen.values()) or not 1 <= chosen['image_count'] <= 200 or not 0 <= chosen['video_count'] <= 199 or sum(chosen.values()) > 200:
            raise ValueError('Choose at least one image, zero or more videos, and at most 200 visuals')
    elif 'count' in options:  # Preserve the existing total-count job API.
        count = options['count']
        if isinstance(count,bool) or not isinstance(count,int) or not 1 <= count <= 200:
            raise ValueError('Visual plan requires 1–200 scenes')
        chosen = {'video_count':min(count-1,int(count*config['visual_video_ratio']))}
        chosen['image_count'] = count-chosen['video_count']
    else:
        chosen = minimum if mode == 'minimum' else standard
    return {'mode':mode, **chosen, 'count':sum(chosen.values()), 'standard':standard, 'minimum':minimum}


def validate_visual_output(items, budget):
    if len(items) != budget['count'] or any(s.get('visual_type') not in ('IMAGE','VIDEO') for s in items):
        raise ValueError('Visual plan must match the selected image and video counts')
    if sum(s['visual_type']=='IMAGE' for s in items) != budget['image_count']:
        raise ValueError('Visual plan must match the selected image and video counts')
