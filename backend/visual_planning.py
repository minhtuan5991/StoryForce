"""User-selected visual budgets, shared by UI, prompts and output validation."""
import math
from .intelligence import duration_profile


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
