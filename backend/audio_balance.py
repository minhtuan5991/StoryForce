"""Measure source levels for reporting; keep music at its original file level."""
import json
import math
import re
from pathlib import Path
from uuid import uuid4

from .render_cache import file_signature, fingerprint

MIX_VERSION = 4


def measure_level(path, binary, cache_folder, log=None):
    from .media import run_process

    key = {'measurement': 1, 'source': file_signature(path)}
    cached = Path(cache_folder) / ('audio-level-' + fingerprint(key) + '.json')
    try:
        saved = json.loads(cached.read_text(encoding='utf-8'))
        if saved.get('key') == key and all(math.isfinite(saved['level'][k]) for k in ('rms_db', 'peak_db', 'lufs')):
            return saved['level']
    except (OSError, ValueError, KeyError, TypeError):
        pass
    result = run_process([str(binary), '-hide_banner', '-nostdin', '-nostats',
                          '-protocol_whitelist', 'file,pipe', '-i', str(path), '-vn',
                          '-af', 'ebur128=framelog=verbose,volumedetect', '-f', 'null', '-'],
                         log, timeout=300)
    def value(pattern):
        matches = re.findall(pattern, result.stderr)
        if not matches:
            raise ValueError('Could not measure audio levels for background music balancing')
        return float(matches[-1])
    level = {'rms_db': value(r'mean_volume:\s*([-\d.]+) dB'),
             'peak_db': value(r'max_volume:\s*([-\d.]+) dB'),
             'lufs': value(r'\bI:\s*([-\d.]+) LUFS')}
    if not all(math.isfinite(v) for v in level.values()):
        raise ValueError('Could not measure finite audio levels for background music balancing')
    level['silent'] = level['peak_db'] < -75
    cached.parent.mkdir(parents=True, exist_ok=True)
    temporary = cached.with_name(cached.name + '.' + uuid4().hex + '.tmp')
    try:
        temporary.write_text(json.dumps({'key': key, 'level': level}), encoding='utf-8')
        temporary.replace(cached)
    finally:
        temporary.unlink(missing_ok=True)
    return level


def music_balance(asset, setting_db, narration, source, narration_db=0):
    """Source music gain is always 0 dB, independent of speech and saved dB settings.

    The output mix still has a peak limiter. No per-track normalization,
    intro/body envelope or speech-driven attenuation is applied to music.
    """
    measured = bool(narration and source and not narration['silent'] and not source['silent'])
    voice_db = narration['rms_db'] + float(narration_db) if narration else None
    return {'version': MIX_VERSION, 'measured': measured, 'setting_db': float(setting_db),
            'intro_db': 0.0, 'body_db': 0.0, 'intro_seconds': 0,
            'narration_rms_db': voice_db, 'source_rms_db': source['rms_db'] if source else None,
            'intro_gap_db': None, 'body_gap_db': None,
            'actual_gap_db': round(voice_db - source['rms_db'], 3) if measured else None,
            'ducking': False, 'max_duck_db': 0.0, 'volume_mode': 'constant',
            'source_level_preserved': True, 'saved_music_setting_applied': False,
            'source_silent': bool(source and source['silent'])}
