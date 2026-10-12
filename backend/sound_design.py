"""Reusable sound accents, scheduled against narration rather than AI timestamps."""
from array import array
import hashlib
import math
from pathlib import Path
import random
import re
import sys
from uuid import uuid4
import wave

from .config import safe_path
from .intelligence import digest, words, WORD_PATTERN
from .visual_planning import narration_clock

VERSION = 1
RATE = 24000
EFFECTS = {
    'opening_texture': (30.0, 'Opening mystery texture'),
    'tension_riser': (3.0, 'Tension rise'),
    'soft_impact': (2.0, 'Low suspense accent'),
    'reveal_sting': (4.0, 'Mystery reveal'),
    'radio_static': (1.5, 'Radio interference'),
    'muted_knock': (1.0, 'Muted knock'),
}
TRIGGERS = (
    ('radio_static', r'\b(?:radio|intercom|speaker|receiver)\b.{0,45}\b(?:crackled|static|hissed|burst|sputtered)\b'),
    ('muted_knock', r'\b(?:heard|came|sounded)\b.{0,35}\b(?:knock|knocking|tapping)\b|\b(?:knock|knocking|knocked)\b.{0,25}\b(?:door|wall|window)\b'),
    ('soft_impact', r'\b(?:suddenly|without warning|all at once)\b|\b(?:door|gate)\b.{0,20}\bslammed\b'),
    ('reveal_sting', r'\b(?:that was when I (?:realized|understood)|I finally realized|the truth was|it wasn.t (?:him|her|human))\b'),
)
NEGATED_SOUND = re.compile(
    r'\b(?:no|never|not|without|didn.t|couldn.t|wasn.t|was not)\b.{0,24}\b(?:sound|knock|knocking|static|noise|heard|hear|crackle|crackled)\b', re.I)


def literal_sound(kind, text):
    pattern = dict(TRIGGERS).get(kind)
    return bool(pattern and re.search(pattern, text, re.I) and not NEGATED_SOUND.search(text))


def enabled(project):
    settings = project.get('settings') or {}
    return settings.get('sound_design', {}).get('enabled',
                        bool(settings.get('production_options', {}).get('music_enabled')))


def tokens(text):
    return [w.casefold().replace('’', "'") for w in words(text)]


def anchor_index(text, anchor, start=0, end=None):
    haystack, needle = tokens(text), tokens(anchor)
    if not 4 <= len(needle) <= 60:
        return None
    end = min(len(haystack), end if end is not None else len(haystack))
    matches = [i for i in range(max(0, start), end - len(needle) + 1)
               if haystack[i:i + len(needle)] == needle]
    return matches[0] if len(matches) == 1 else None


def plan(project, chunks=(), scenes=()):
    text = project.get('draft', '')
    clock, timing = narration_clock(text, project.get('wpm', 150), chunks)
    duration = clock[-1] if clock else 0
    result = {'version': VERSION, 'enabled': bool(enabled(project)), 'timing': timing,
              'opening_seconds': min(30, duration), 'story_seconds': round(duration, 3), 'cues': []}
    if not result['enabled'] or not text.strip() or duration <= 0:
        return result
    candidates = []
    for scene in scenes:
        cues = (scene.get('continuity') or {}).get('sound_cues', [])
        for cue in (cues if isinstance(cues,list) else [])[:2]:
            if not isinstance(cue, dict) or cue.get('kind') not in EFFECTS or cue['kind'] == 'opening_texture':
                continue
            anchor = cue.get('anchor_text', '')
            if not isinstance(anchor, str):
                continue
            if cue['kind'] in ('radio_static', 'muted_knock') and not literal_sound(cue['kind'], anchor):
                continue
            index = anchor_index(text, anchor, scene.get('start_word', 0), scene.get('end_word'))
            if index is not None:
                candidates.append((clock[index], cue['kind'], anchor, 'story_plan', index))
    # Existing visual plans also work. Only concrete narrated sounds or explicit
    # reversals qualify; a generic dark location alone must not trigger effects.
    offsets = [m.start() for m in WORD_PATTERN.finditer(text)]
    from bisect import bisect_left
    for sentence in re.finditer(r'[^.!?\n]+[.!?]?', text):
        fragment = sentence.group().strip()
        for kind, pattern in TRIGGERS:
            match = re.search(pattern, fragment, re.I)
            if not match or kind in ('radio_static', 'muted_knock') and not literal_sound(kind, fragment):
                continue
            index = bisect_left(offsets, sentence.start() + sentence.group().find(fragment) + match.start())
            if index < len(clock) - 1:
                candidates.append((clock[index], kind, fragment[:400], 'narration', index))
            break
    # Plan cues win when several candidates describe the same beat.
    candidates.sort(key=lambda item: (item[3] != 'story_plan', item[0]))
    chosen = []
    for candidate in candidates:
        offset = candidate[0]
        spacing = 7 if offset < 30 else 25
        if offset < 1 or offset + .5 >= duration or any(abs(offset - item[0]) < spacing for item in chosen):
            continue
        if offset < 30 and sum(c[0] < 30 for c in chosen) >= 3:
            continue
        if offset >= 30 and sum(c[0] >= 30 for c in chosen) >= min(10, max(3, math.ceil(duration / 180))):
            continue
        chosen.append(candidate)
    # Musical accents do not imply fictional footsteps, doors or monsters.
    for offset, kind in ((3.0, 'soft_impact'), (13.0, 'tension_riser'), (23.0, 'reveal_sting')):
        if offset + EFFECTS[kind][0] < min(30, duration) and not any(abs(offset - c[0]) < 7 for c in chosen):
            chosen.append((offset, kind, '', 'opening', None))
    scheduled = [(0.0, 'opening_texture', '', 'opening', None), *sorted(chosen)]
    for number, (offset, kind, anchor, source, index) in enumerate(scheduled):
        length = min(EFFECTS[kind][0], duration - offset, 30 if kind == 'opening_texture' else duration)
        if length < .1:
            continue
        result['cues'].append({'id': f'cue_{number + 1:03}', 'kind': kind, 'label': EFFECTS[kind][1],
                               'offset': round(offset, 3), 'duration': round(length, 3),
                               'anchor_text': anchor, 'word_index': index, 'source': source,
                               'scene_key': next((s.get('scene_key', '') for s in scenes
                                   if index is not None and s.get('start_word', 0) <= index < s.get('end_word', 0)), '')})
    result['signature'] = digest(result)
    return result


def effect_path(root, kind):
    if kind not in EFFECTS:
        raise ValueError('Unknown sound effect')
    return safe_path(Path(root), f'shared_sound_effects/v{VERSION}-{kind}.wav')


def prepare_library(root):
    """Prepare six short, original textures once. No provider call per scene."""
    for kind, (duration, _) in EFFECTS.items():
        target = effect_path(root, kind)
        if target.is_file() and not target.is_symlink():
            try:
                with wave.open(str(target), 'rb') as audio:
                    if audio.getframerate() == RATE and audio.getnframes() == round(duration * RATE):
                        continue
            except (OSError, EOFError, wave.Error):
                pass
        target.parent.mkdir(parents=True, exist_ok=True)
        rng = random.Random(f'storyforge-sound-{VERSION}-{kind}')
        samples, low = array('h'), 0.0
        for i in range(round(duration * RATE)):
            t = i / RATE
            low += .12 * (rng.uniform(-1, 1) - low)
            if kind == 'opening_texture':
                value = (.28 * math.sin(2 * math.pi * 73 * t) + .13 * math.sin(2 * math.pi * 109.5 * t)
                         + .1 * low) * (.68 + .32 * math.sin(math.pi * 1.1 * t) ** 2)
            elif kind == 'tension_riser':
                value = (.27 * low + .16 * math.sin(2 * math.pi * (130 * t + 35 * t * t))) * (t / duration) ** 1.5
            elif kind == 'soft_impact':
                value = (.48 * math.sin(2 * math.pi * (58 * t + 17 * (1 - math.exp(-5 * t)))) + .2 * low) * math.exp(-3 * t)
            elif kind == 'reveal_sting':
                value = (.19 * math.sin(2 * math.pi * 146.83 * t) + .16 * math.sin(2 * math.pi * 220 * t)
                         + .1 * math.sin(2 * math.pi * 293.66 * t)) * math.exp(-.8 * t)
            elif kind == 'radio_static':
                value = .45 * (rng.uniform(-1, 1) - low) * (.35 + .65 * math.sin(2 * math.pi * 6 * t) ** 2)
            else:
                pulse = sum(math.exp(-45 * (t - beat)) if beat <= t < beat + .2 else 0 for beat in (.03, .32, .61))
                value = pulse * (.48 * math.sin(2 * math.pi * 125 * t) + .2 * low)
            envelope = min(1, t / .035, (duration - t) / (.8 if kind == 'opening_texture' else .12))
            samples.append(round(max(-.7, min(.7, value * max(0, envelope))) * 32767))
        if sys.byteorder != 'little':
            samples.byteswap()
        temporary = target.with_name(target.name + '.' + uuid4().hex + '.tmp')
        try:
            with wave.open(str(temporary), 'wb') as audio:
                audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(RATE)
                audio.writeframes(samples.tobytes())
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)


def assets_for_plan(root, sound_plan):
    if not sound_plan['enabled'] or not sound_plan['cues']:
        return []
    prepare_library(root)
    checksums = {}
    result = []
    for cue in sound_plan['cues']:
        path = effect_path(root, cue['kind'])
        if cue['kind'] not in checksums:
            with path.open('rb') as audio:
                checksums[cue['kind']] = hashlib.file_digest(audio, 'sha256').hexdigest()
        result.append({'id': 'auto-sound-' + cue['id'], 'kind': 'sfx', 'name': cue['label'],
                       'path': str(path.relative_to(Path(root).resolve())), 'sha256': checksums[cue['kind']],
                       'duration': cue['duration'], 'metadata_json': {**cue, 'role': 'automatic_story_sound',
                                                                    'sound_design_version': VERSION}})
    return result


def sound_gain(voice, effect, texture=False, narration_db=0):
    # Fixed gain for each sound, with no ducking of the background score.
    target_gap = 14 if texture else 7
    if not voice or not effect or voice['silent'] or effect['silent']:
        return -18.0
    return round(max(-60, min(6, voice['rms_db'] + narration_db - effect['rms_db'] - target_gap,
                              voice['peak_db'] + narration_db - 4 - effect['peak_db'], -6 - effect['peak_db'])), 3)
