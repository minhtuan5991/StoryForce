from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
import shutil
import subprocess
import textwrap
from uuid import uuid4
from pathlib import Path
from .config import APP_ROOT, RESOURCE_ROOT, safe_path
from .intelligence import sentence_units, words

MEDIA_FOLDERS = {"audio": "audio", "image": "images", "video": "videos", "music": "music", "ambient": "ambient", "sfx": "sfx"}
EXTENSIONS = {".wav": "audio", ".mp3": "audio", ".m4a": "audio", ".flac": "audio", ".ogg": "audio", ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".mp4": "video", ".mov": "video", ".webm": "video"}


def find_binary(name: str, settings: dict) -> str | None:
    configured = settings.get(f"{name}_path")
    if configured and Path(configured).is_file():
        return str(Path(configured).resolve())
    for root in (RESOURCE_ROOT, APP_ROOT):
        bundled = root / "tools" / f"{name}.exe"
        if bundled.is_file():
            return str(bundled)
        matches = list((root / "tools" / "ffmpeg").glob(f"*/bin/{name}.exe"))
        if matches:
            return str(matches[0])
    return shutil.which(name)


def run_process(args: list[str], log_path: Path | None = None, timeout: int = 3600, cwd: Path | None = None, *, idle_timeout=None, on_progress=None):
    if idle_timeout is not None:
        from .render_pipeline import monitored_process
        return monitored_process(args,log_path,cwd,on_progress,idle_timeout)
    flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=flags, cwd=cwd, shell=False)
    if log_path:
        with log_path.open("a", encoding="utf-8") as log:
            log.write(result.stderr[-80_000:] + "\n")
    if result.returncode:
        raise ValueError(f"{Path(args[0]).name} failed: {result.stderr[-2200:]}")
    return result


def parse_probe(info: dict) -> dict:
    streams = info.get("streams", [])
    fmt = info.get("format", {})
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio = next((s for s in streams if s.get("codec_type") == "audio"), {})
    numerator, _, denominator = video.get("avg_frame_rate", "0/1").partition("/")
    fps = float(numerator or 0) / max(1, float(denominator or 1))
    duration = float(fmt.get("duration") or video.get("duration") or audio.get("duration") or 0)
    return {"duration": duration, "video_duration": float(video.get("duration") or 0), "audio_duration": float(audio.get("duration") or 0), "width": video.get("width"), "height": video.get("height"), "fps": fps,
            "has_audio": bool(audio), "has_video": bool(video), "audio_codec": audio.get("codec_name"),
            "video_codec": video.get("codec_name"), "sample_rate": audio.get("sample_rate"), "channels": audio.get("channels"), "size": int(fmt.get("size") or 0)}


def probe(path: Path, settings: dict) -> dict:
    binary = find_binary("ffprobe", settings)
    if not binary:
        raise ValueError("ffprobe is missing. Set its executable path in Settings.")
    result = run_process([binary, "-v", "error", "-protocol_whitelist", "file,pipe", "-show_format", "-show_streams", "-of", "json", str(path)], timeout=45)
    return parse_probe(json.loads(result.stdout))


def asset_kind(name: str) -> str:
    suffix = Path(name).suffix.lower()
    if suffix not in EXTENSIONS:
        raise ValueError("Unsupported file type. Use WAV/MP3/FLAC, PNG/JPG/WebP or MP4/MOV/WebM.")
    kind = EXTENSIONS[suffix]
    for prefix in ("music", "ambient", "sfx"):
        if name.lower().startswith(prefix + "_") and kind == "audio":
            return prefix
    return kind


def map_asset(name: str) -> tuple[str | None, int | None]:
    match = re.match(r"(?i)^(tts|scene)_(\d+)\.", name)
    return (match[1].lower(), int(match[2])) if match else (None, None)


def project_folder(root: Path, project_id: str) -> Path:
    folder = safe_path(root / "projects", project_id)
    for name in ("audio", "images", "videos", "music", "ambient", "sfx", "subtitles", "render"):
        (folder / name).mkdir(parents=True, exist_ok=True)
    return folder


def validate_assets(chunks: list[dict], scenes: list[dict], assets: list[dict], root: Path, version: int, fallback: bool = False):
    asset_map = {a["id"]: a for a in assets}
    missing, warnings = [], []
    narration_ok = visuals_ok = 0
    for chunk in chunks:
        asset = asset_map.get(chunk.get("asset_id"))
        if chunk["story_version"] != version or chunk["status"] == "STALE":
            missing.append(f"tts_{chunk['number']:03}.wav is stale")
        elif not asset or not asset.get("duration") or not safe_path(root, asset["path"]).is_file() or not asset.get("metadata_json", {}).get("has_audio"):
            missing.append(f"tts_{chunk['number']:03}.wav")
        else:
            narration_ok += 1
    for scene in scenes:
        asset = asset_map.get(scene.get("asset_id"))
        backup = asset_map.get(scene.get("fallback_asset_id"))
        if scene["story_version"] != version or scene["status"] == "STALE":
            missing.append(f"scene_{scene['number']:03} is stale")
            continue
        if not asset or not safe_path(root, asset["path"]).is_file():
            if backup and safe_path(root, backup["path"]).is_file():
                warnings.append(f"Scene {scene['number']} uses image fallback")
                visuals_ok += 1
            elif fallback:
                warnings.append(f"Scene {scene['number']} uses a labeled placeholder")
                visuals_ok += 1
            else:
                missing.append(f"Scene {scene['number']}: attach an image or video")
        elif asset["kind"] not in ("image", "video") or (asset["kind"] == "video" and (asset.get("duration") or 0) <= 0):
            missing.append(f"Scene {scene['number']}: attach a playable image or video")
        else:
            visuals_ok += 1
    if not chunks:
        missing.append("Generate TTS chunks")
    if not scenes:
        missing.append("Generate visual scene plan")
    return {"valid": not missing, "missing": missing, "warnings": warnings,
            "narration": [narration_ok, len(chunks)], "visuals": [visuals_ok, len(scenes)]}


def timeline_from_audio(chunks: list[dict], scenes: list[dict], assets: list[dict] | None = None, ending_asset_id=None) -> dict:
    offset, word_offset = 0.0, 0
    timeline_chunks = []
    for chunk in sorted(chunks, key=lambda c: c["number"]):
        duration = chunk.get("real_duration")
        if duration is None or duration <= 0:
            raise ValueError(f"Chunk {chunk['number']} needs a real ffprobe duration")
        wc = len(words(chunk["text"]))
        timeline_chunks.append({"id": chunk["id"], "number": chunk["number"], "offset": offset,
                                "duration": duration, "start_word": word_offset, "end_word": word_offset + wc})
        offset += duration
        word_offset += wc

    def at_word(position):
        for c in timeline_chunks:
            if position <= c["end_word"]:
                fraction = max(0, position - c["start_word"]) / max(1, c["end_word"] - c["start_word"])
                return c["offset"] + min(1, fraction) * c["duration"]
        return offset

    ordered = sorted(scenes, key=lambda s: s["number"])
    timeline_scenes = []
    for i, scene in enumerate(ordered):
        start = at_word(scene["start_word"])
        end = offset if i == len(ordered)-1 else at_word(scene["end_word"])
        if end <= start:
            raise ValueError("Visual plan contains an empty narration range")
        timeline_scenes.append({"id": scene["id"], "number": scene["number"], "offset": start, "duration": end-start})
    if assets is not None:
        timeline_scenes = fit_visual_timeline(ordered, timeline_scenes, assets, offset, ending_asset_id)
    return {"duration": round(offset, 6), "chunks": timeline_chunks, "scenes": timeline_scenes,
            "alignment": "Sentence-weighted within real audio chunks; not forced speech alignment"}


def fit_visual_timeline(scenes, baseline, assets, total, ending_asset_id=None):
    """Video starts are anchors; only the images between anchors absorb time."""
    asset_map = {a['id']:a for a in assets}
    result, pending, cursor = [], [], 0.0

    def fill_images(end):
        nonlocal cursor, pending
        available = end - cursor
        if available < -.001 or (pending and available <= 0):
            raise ValueError('Video scenes overlap or leave no time for the images between them. Review the scene timing.')
        if not pending:
            if available > .001:
                raise ValueError('An image is needed to cover the gap between fixed video scenes.')
            return
        weight = sum(row['duration'] for row in pending)
        for i, row in enumerate(pending):
            duration = end-cursor if i == len(pending)-1 else available*row['duration']/weight
            result.append({**row,'offset':cursor,'duration':duration,'media_kind':'image'})
            cursor += duration
        pending = []

    for scene, row in zip(scenes, baseline):
        asset = asset_map.get(scene.get('asset_id'))
        if not asset or asset['kind'] != 'video':
            pending.append(row)
            continue
        # Preserve a previously synced start. Unsynced scenes use their original
        # narration range; resizing adjacent images never moves this anchor.
        start = scene.get('offset',0) if (scene.get('duration') or 0)>0 else row['offset']
        duration = float(asset.get('metadata_json',{}).get('video_duration') or asset.get('duration') or 0)
        if duration <= 0 or not math.isfinite(duration):
            raise ValueError(f"Scene {scene['number']} has no playable video duration")
        if start + duration > total + .001:
            raise ValueError(f"Scene {scene['number']} extends beyond the narration. Add enough narration or revise its start; the video will not be cut.")
        fill_images(start)
        result.append({**row,'offset':start,'duration':duration,'media_kind':'video'})
        cursor = start + duration
    if not pending and total-cursor > .001:
        ending = asset_map.get(ending_asset_id)
        if not ending or ending['kind'] != 'image':
            raise ValueError('Choose an ending thumbnail to cover the remaining audio after the last video.')
        result.append({'id':'__ending_thumbnail__','number':max((s['number'] for s in scenes),default=0)+1,
                       'scene_key':'ENDING_THUMBNAIL','asset_id':ending['id'],'fallback_asset_id':None,
                       'offset':cursor,'duration':total-cursor,'media_kind':'image','ending_thumbnail':True})
    else:
        fill_images(total)
    return result


def validate_logo(path, settings):
    from PIL import Image
    with Image.open(path) as im:
        if im.format != 'PNG' or im.convert('RGBA').getchannel('A').getextrema()[0] == 255:
            raise ValueError('Overlay requires a transparent PNG canvas')
        expected = (int(settings['render_width']), int(settings['render_height']))
        if im.size != expected:
            raise ValueError(f'Overlay PNG must match the video canvas: {expected[0]} x {expected[1]} px. The image will not be resized or repositioned.')


def validate_waveform_video(path, settings):
    metadata = probe(path, settings)
    if not metadata['has_video'] or (metadata['video_duration'] or metadata['duration']) <= 0:
        raise ValueError('Choose a playable green-screen video for waveform')
    expected = (int(settings['render_width']), int(settings['render_height']))
    if (metadata['width'], metadata['height']) != expected:
        raise ValueError('Green-screen video must match the output video dimensions. It will not be resized or repositioned.')
    return metadata


def timestamp(seconds, vtt=False):
    ms = max(0, round(seconds * 1000))
    hours, ms = divmod(ms, 3_600_000)
    minutes, ms = divmod(ms, 60_000)
    secs, ms = divmod(ms, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{'.' if vtt else ','}{ms:03}"


def write_subtitles(chunks: list[dict], folder: Path):
    entries, offset = [], 0.0
    for chunk in sorted(chunks, key=lambda c: c["number"]):
        sentences = []
        for unit in sentence_units(chunk["text"]):
            sentences.extend(textwrap.wrap(unit["text"], width=84, break_long_words=False, break_on_hyphens=False))
        weights = [max(1, len(words(s))) for s in sentences]
        duration = chunk["real_duration"]
        local = 0.0
        for sentence, weight in zip(sentences, weights):
            end = local + duration * weight / sum(weights)
            entries.append((offset + local, offset + end, "\n".join(textwrap.wrap(sentence, 44, break_long_words=False))))
            local = end
        offset += duration
    folder.mkdir(parents=True, exist_ok=True)
    for extension in ("srt", "vtt"):
        blocks = [f"{i+1}\n{timestamp(a, extension=='vtt')} --> {timestamp(b, extension=='vtt')}\n{text}" for i, (a,b,text) in enumerate(entries)]
        content = ("WEBVTT\n\n" if extension == "vtt" else "") + "\n\n".join(blocks) + "\n"
        (folder / f"captions.{extension}").write_text(content, encoding="utf-8")
    return len(entries)


def build_render_plan(scenes, settings, total):
    fps = int(settings['render_fps'])
    transition = max(0, min(1.5, float(settings.get("transition_seconds", .4))))
    for s in scenes:
        transition = min(transition, s["duration"] / 3)
    transitions = [transition if i<len(scenes)-1 and s.get('media_kind')!='video' and scenes[i+1].get('media_kind')!='video' else 0 for i,s in enumerate(scenes)]
    clips, cursor = [], 0.0
    for i, s in enumerate(scenes):
        start = s.get('offset',cursor)
        end = start+s['duration']
        frames = round(end*fps)-round(start*fps)
        if frames < 1:raise ValueError('A scene is shorter than one output frame. Review scene timing.')
        overlap_frames = round(transitions[i]*fps)
        clips.append({**s,'render_offset':round(start*fps)/fps,'transition_after':overlap_frames/fps,
                      'clip_frames':frames+overlap_frames,'clip_duration':(frames+overlap_frames)/fps})
        cursor = end
    return {"width": int(settings["render_width"]), "height": int(settings["render_height"]), "fps": int(settings["render_fps"]),
            "duration": total, "transition": transition, "video_codec": "libx264", "audio_codec": "aac",
            "scenes": clips}


def render_options(project):
    saved = (project.get("settings") or {}).get("render_options") or {}
    waveform = bool(saved.get("waveform", False))
    return {"subtitles": bool(saved.get("subtitles", True)) and not waveform,
            "waveform": waveform, "overlay": bool(saved.get("overlay", False)),
            "waveform_asset_id": saved.get("waveform_asset_id") or None,
            "logo_asset_id": saved.get("logo_asset_id") or None,
            "ending_asset_id": saved.get("ending_asset_id") or (project.get('publish') or {}).get('thumbnail_asset_id') or None}


def render_inputs_hash(project, chunks, scenes, assets, settings):
    """Track production inputs without treating unrelated uploads as render changes."""
    used = {c.get("asset_id") for c in chunks} | {s.get(k) for s in scenes for k in ("asset_id", "fallback_asset_id")}
    options = render_options(project)
    used.add(options['ending_asset_id'])
    if options['waveform']:
        used.add(options['waveform_asset_id'])
    if options["overlay"]:
        used.add(options["logo_asset_id"])
    selected_assets = [a for a in assets if a["id"] in used or a["kind"] in ("music", "ambient", "sfx")]
    def fields(items, keys):
        return [{k: item.get(k) for k in keys} for item in sorted(items, key=lambda x:x["id"])]
    value = {
        "renderer": 8, "version": project["story_version"], "render_options": options,
        "chunks": fields(chunks, ("id", "text", "asset_id", "real_duration")),
        "scenes": fields(scenes, ("id", "number", "start_word", "end_word", "offset", "duration", "asset_id", "fallback_asset_id")),
        "assets": fields(selected_assets, ("id", "sha256", "path", "duration", "metadata_json")),
        "settings": {k:settings.get(k) for k in ("render_width", "render_height", "render_fps", "render_encoder", "transition_seconds", "music_db", "ambient_db", "narration_db", "allow_visual_fallback", "silence_threshold")},
    }
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def render_project(root: Path, project: dict, chunks: list[dict], scenes: list[dict], assets: list[dict], settings: dict, progress):
    from .render_acceleration import choose_encoder, video_encoding, cpu_threads, render_binary, cuda_compositing
    from .render_cache import RenderCache, file_signature, reuse_file
    from .render_composite import delivery_graph
    from .render_pipeline import compose_clips, wave_key_color
    started = time.monotonic()
    binary = find_binary("ffmpeg", settings)
    if not binary:
        raise ValueError("FFmpeg not found. Configure it in Settings.")
    original_binary = binary
    binary = render_binary(binary, settings)
    performance = {'compatible_runtime': binary != original_binary}
    stage_times = {}
    stage_started = started
    def stage_done(name):
        nonlocal stage_started
        now = time.monotonic()
        stage_times[name] = round(now - stage_started, 2)
        stage_started = now
    validation = validate_assets(chunks, scenes, assets, root, project["story_version"], settings.get("allow_visual_fallback", False))
    if not validation["valid"]:
        raise ValueError("Missing assets: " + ", ".join(validation["missing"]))
    if any(not c.get("real_duration") for c in chunks) or any(not s.get("duration") for s in scenes):
        raise ValueError("Sync with real audio before rendering")
    folder = project_folder(root, project["id"]) / "render"
    # Keep the previous playable render intact until this attempt has finished.
    folder = folder / f"v{project['story_version']}" / uuid4().hex[:16]
    folder.mkdir(parents=True, exist_ok=True)
    processing_cache = RenderCache(project_folder(root, project['id'])/'render'/'processing_cache', probe, settings)
    log = root / "logs" / "ffmpeg.log"
    asset_map = {a["id"]: a for a in assets}
    total = sum(c["real_duration"] for c in chunks)
    input_hash = render_inputs_hash(project, chunks, scenes, assets, settings)
    baseline = [{k:s[k] for k in ('id','number','offset','duration')} for s in scenes]
    options = render_options(project)
    timing = fit_visual_timeline(scenes, baseline, assets, total, options['ending_asset_id'])
    originals = {s['id']:s for s in scenes}
    scenes = [{**originals.get(t['id'],{}),**t} for t in timing]
    for s in scenes:
        if s.get('ending_thumbnail') and not safe_path(root,asset_map[s['asset_id']]['path']).is_file():
            raise ValueError('Ending thumbnail file is missing')
    plan = build_render_plan(scenes, settings, total)
    options = render_options(project)
    logo = asset_map.get(options["logo_asset_id"]) if options["overlay"] else None
    if options["overlay"] and (not logo or logo["kind"] != "image" or not safe_path(root, logo["path"]).is_file()):
        raise ValueError("Choose an available logo image or turn off overlay")
    if logo:
        validate_logo(safe_path(root,logo['path']),settings)
    wave = asset_map.get(options['waveform_asset_id']) if options['waveform'] else None
    if options['waveform'] and (not wave or wave['kind'] != 'video' or not safe_path(root,wave['path']).is_file()):
        raise ValueError('Choose an available green-screen video or turn off waveform')
    if wave:
        wave_metadata = validate_waveform_video(safe_path(root,wave['path']),settings)
        wave_color = wave_key_color(original_binary,safe_path(root,wave['path']),wave_metadata['video_duration'] or wave_metadata['duration'])
    fps, width, height = plan["fps"], plan["width"], plan["height"]
    encoder = choose_encoder(binary,settings)
    plan['video_codec'] = encoder
    workers = 2 if (os.cpu_count() or 1) >= 6 else 1
    base = [binary, "-hide_banner", "-y", "-nostdin", "-threads", "1"]
    source_base = [original_binary, *base[1:]]
    color_filter = "format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709"
    color_args = ["-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    def encode_scene(inputs, output, force_cpu=False):
        stage_encoder = 'libx264' if force_cpu else encoder
        try:
            run_process(inputs+video_encoding(stage_encoder,True)+color_args+[str(output)],log,idle_timeout=900)
        except ValueError:
            if stage_encoder=='libx264' and binary==original_binary:raise
            try:
                run_process(inputs+video_encoding('libx264',True)+color_args+[str(output)],log,idle_timeout=900)
            except ValueError:
                if binary==original_binary:raise
                # Preserve source-format support when the compatibility renderer
                # cannot decode a newer media format. The latest main FFmpeg
                # prepares a standard H.264 clip for the following GPU stages.
                run_process([original_binary,*inputs[1:]]+video_encoding('libx264',True)+color_args+[str(output)],log,idle_timeout=900)
            stage_encoder = 'libx264'
        return stage_encoder
    stage_done('initialization')
    progress(4, "Normalizing narration")
    # Normalize each chunk before concatenation; imported sample formats may differ.
    master = folder / "master_narration.wav"
    ordered_chunks = sorted(chunks, key=lambda c: c['number'])
    narration_key = {'renderer':1, 'audio': [file_signature(safe_path(root, asset_map[c['asset_id']]['path'])) for c in ordered_chunks],
                     'format': 'pcm_s16le/48000/2', 'duration':total}
    cached_master = processing_cache.path('narration', narration_key, '.wav')
    performance['narration_cached'] = processing_cache.valid(cached_master, duration=total)
    if not performance['narration_cached']:
        concat = []
        for chunk in ordered_chunks:
            path = safe_path(root, asset_map[chunk['asset_id']]['path'])
            output = folder / f"normalized_{chunk['number']:03}.wav"
            run_process(source_base + ['-protocol_whitelist', 'file,pipe', '-i', str(path), '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', str(output)], log)
            concat.append(f"file '{output.name}'")
        (folder/'narration.txt').write_text('\n'.join(concat), encoding='utf-8')
        pending = folder/'pending_narration.wav'
        run_process(source_base + ['-f', 'concat', '-safe', '1', '-i', 'narration.txt', '-c:a', 'pcm_s16le', str(pending)], log, cwd=folder)
        processing_cache.publish(pending, cached_master)
        for chunk in ordered_chunks:
            (folder / f"normalized_{chunk['number']:03}.wav").unlink(missing_ok=True)
    reuse_file(cached_master, master)
    write_subtitles(chunks, folder)
    stage_done('narration')

    def still(image_path: Path, duration: float, output: Path, number: int, frames: int):
        x = "iw/2-(iw/zoom/2)" if number % 2 else "(iw-iw/zoom)*on/" + str(frames)
        vf = f"scale={width*2}:{height*2}:force_original_aspect_ratio=increase:out_range=tv:out_color_matrix=bt709,crop={width*2}:{height*2},zoompan=z='min(1.0+on*0.00015,1.08)':x='{x}':y='ih/2-(ih/zoom/2)':d={frames}:s={width}x{height}:fps={fps},setsar=1,{color_filter}"
        return encode_scene(base + ["-protocol_whitelist", "file,pipe", "-i", str(image_path), "-vf", vf, "-frames:v", str(frames), "-an"],output)

    placeholder = folder / "missing_visual.png"
    def placeholder_path():
        if not placeholder.exists():
            from PIL import Image, ImageDraw
            im = Image.new("RGB", (width, height), "#142438")
            ImageDraw.Draw(im).text((40, height//2), "STORYFORGE / MISSING VISUAL - REVIEW REQUIRED", fill="#f5b267", font_size=max(18,width//42))
            im.save(placeholder)
        return placeholder

    cache = project_folder(root,project['id'])/'render'/'scene_cache'
    scene_cache = RenderCache(cache, probe, settings)
    def render_scene(i, scene):
        asset = asset_map.get(scene.get("asset_id"))
        fallback = asset_map.get(scene.get("fallback_asset_id"))
        if fallback and not safe_path(root, fallback["path"]).is_file():
            fallback = None
        if not asset or not safe_path(root, asset["path"]).is_file():
            asset = fallback
        source = safe_path(root,asset['path']) if asset else placeholder_path()
        info=source.stat()
        key = {'renderer':3,'path':str(source),'sha256':asset.get('sha256') if asset else None,'size':info.st_size,'mtime':info.st_mtime_ns,
               'width':width,'height':height,'fps':fps,'frames':scene['clip_frames'],'ending':bool(scene.get('ending_thumbnail')),
               'kind':asset['kind'] if asset else 'image','motion':i,'encoder':encoder}
        name=hashlib.sha256(json.dumps(key,sort_keys=True).encode()).hexdigest()
        output=cache/(name+'.mp4')
        if scene_cache.valid(output, duration=scene['clip_duration'], width=width, height=height, fps=fps):
            return i,output,True,scene_cache.metadata(output).get('render_encoder','unknown')
        pending=cache/(name+'.'+uuid4().hex[:8]+'.mp4')
        duration = scene["clip_duration"]
        if not asset or asset["kind"] == "image":
            path = safe_path(root, asset["path"]) if asset else placeholder_path()
            if scene.get('ending_thumbnail'):
                vf=f"scale={width}:{height}:force_original_aspect_ratio=decrease:out_range=tv:out_color_matrix=bt709,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,{color_filter}"
                used_encoder = encode_scene(base+["-loop","1","-i",str(path),"-vf",vf,"-r",str(fps),"-frames:v",str(scene['clip_frames']),"-an"],pending)
            else:
                used_encoder = still(path, duration, pending, i, scene['clip_frames'])
        else:
            path = safe_path(root, asset["path"])
            # Decode the entire video once at normal speed. No looping,
            # slow motion, image tail or transition overlap on dialogue clips.
            # Snap endpoints to the output frame grid, never accumulating one
            # rounding error per scene. At most one frame is held at the end.
            vf = f"setpts=PTS-STARTPTS,scale={width}:{height}:force_original_aspect_ratio=increase:out_range=tv:out_color_matrix=bt709,crop={width}:{height},fps={fps},tpad=stop_mode=clone:stop_duration={1/fps},trim=end_frame={scene['clip_frames']},setsar=1,{color_filter}"
            used_encoder = encode_scene(base + ["-protocol_whitelist", "file,pipe", "-i", str(path), "-vf", vf, "-an"],pending)
        scene_cache.publish(pending, output, render_encoder=used_encoder)
        return i,output,False,used_encoder
    clips = [None]*len(scenes)
    reused = 0
    scene_encoders = set()
    # Only two scene workers, keeping decoder/encoder memory bounded on laptops.
    with ThreadPoolExecutor(max_workers=workers,thread_name_prefix='render-scene') as executor:
        futures=[executor.submit(render_scene,i,s) for i,s in enumerate(plan['scenes'])]
        for done,future in enumerate(as_completed(futures),1):
            i,output,cached,used_encoder=future.result();clips[i]=output;reused+=int(cached);scene_encoders.add(used_encoder)
            progress(10+int(60*done/len(scenes)),f"Preparing scenes {done}/{len(scenes)} ({reused} reused)")
    plan['stream_copy_compatible'] = len(scene_encoders) == 1 and 'unknown' not in scene_encoders
    stage_done('scenes')
    progress(76, "Mixing audio with narration ducking")
    beds = [a for a in assets if a["kind"] in ("music", "ambient")][:2]
    effects = [a for a in assets if a["kind"] == "sfx"][:30]
    audio_args = source_base + ["-i", str(master)]
    filters = [f"[0:a]volume={float(settings.get('narration_db',0))}dB[n]"]
    if beds:
        filters.append(f"[n]asplit={len(beds)+1}[main]" + "".join(f"[sc{i}]" for i in range(len(beds))))
    else:
        filters.append("[n]anull[main]")
    labels = ["[main]"]
    for i, bed in enumerate(beds):
        audio_args += ["-stream_loop", "-1", "-protocol_whitelist", "file,pipe", "-i", str(safe_path(root, bed["path"]))]
        db = float(settings.get(f"{bed['kind']}_db", -28))
        filters.append(f"[{i+1}:a]volume={db}dB[b{i}];[b{i}][sc{i}]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[d{i}]")
        labels.append(f"[d{i}]")
    for i, effect in enumerate(effects):
        audio_args += ["-protocol_whitelist", "file,pipe", "-i", str(safe_path(root, effect["path"]))]
        delay = max(0, round(float(effect.get("metadata_json", {}).get("offset", 0))*1000))
        volume = float(effect.get("metadata_json", {}).get("volume_db", -18))
        filters.append(f"[{1+len(beds)+i}:a]volume={volume}dB,adelay={delay}:all=1[e{i}]")
        labels.append(f"[e{i}]")
    filters.append("".join(labels) + f"amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.95[out]")
    audio_key = {'renderer':1, 'master':file_signature(cached_master), 'duration':total,
                 'beds':[[file_signature(safe_path(root,a['path'])), a['kind'], settings.get(f"{a['kind']}_db", -28)] for a in beds],
                 'effects':[[file_signature(safe_path(root,a['path'])), a.get('metadata_json',{}).get('offset',0), a.get('metadata_json',{}).get('volume_db',-18)] for a in effects],
                 'narration_db':settings.get('narration_db',0)}
    cached_audio = processing_cache.path('mixed-audio', audio_key, '.wav')
    performance['audio_cached'] = processing_cache.valid(cached_audio, duration=total)
    if not performance['audio_cached']:
        pending = folder/'pending_audio.wav'
        run_process(audio_args + ['-filter_complex', ';'.join(filters), '-map', '[out]', '-t', str(total), '-ar', '48000', '-ac', '2', str(pending)], log)
        processing_cache.publish(pending, cached_audio)
    reuse_file(cached_audio, folder/'final_audio.wav')
    stage_done('audio_mix')
    progress(78, "Joining scene groups")
    # Some Quick Sync drivers change chroma on frames produced by concat/xfade.
    # NVIDIA intermediates can stay on hardware encoding. Keep Quick Sync's
    # proven CPU join workaround and bound all transition graphs to six inputs.
    joined, join_groups, join_files = compose_clips(clips,plan,folder,base,
        lambda inputs,output:encode_scene(inputs,output,force_cpu=encoder!='h264_nvenc'),progress,
        cache=processing_cache, remux=lambda args:run_process(args,log,idle_timeout=900), stats=performance)
    stage_done('timeline')
    progress(86, "Compositing waveform, logo and captions")
    keyed_wave = None
    if wave:
        keyed_wave = processing_cache.path('wave', {'renderer':2, 'source':file_signature(safe_path(root,wave['path'])),
                'color':wave_color, 'key':'0.12:0.05', 'pixel_format':'yuva420p'}, '.mkv')
        performance['waveform_cached'] = processing_cache.valid(keyed_wave,
                duration=wave_metadata['video_duration'] or wave_metadata['duration'], width=width, height=height, fps=wave_metadata['fps'])
        if not performance['waveform_cached']:
            pending = folder/'pending_wave.mkv'
            run_process(source_base+['-noautorotate','-protocol_whitelist','file,pipe','-i',str(safe_path(root,wave['path'])),
                '-vf',f'format=yuva444p,chromakey={wave_color}:0.12:0.05,scale=out_range=tv:out_color_matrix=bt709,'
                      'format=yuva420p,setparams=range=limited:colorspace=bt709:color_primaries=bt709:color_trc=bt709',
                '-an','-c:v','ffv1','-threads',str(min(4,cpu_threads())),*color_args,str(pending)],log,idle_timeout=900)
            processing_cache.publish(pending,keyed_wave)
    stage_done('waveform_key')
    output = folder/"final_video.mp4"
    logo_path = safe_path(root,logo['path']) if logo else None
    use_cuda = encoder=='h264_nvenc' and not options['subtitles'] and cuda_compositing(binary)
    final_args = delivery_graph(base,joined,folder/'final_audio.wav',options,keyed_wave,logo_path,cuda=use_cuda,width=width,height=height)
    suffix=['-c:a','aac','-b:a','160k','-r',str(fps),'-t',str(total),'-movflags','+faststart',str(output)]
    last_percent = 86
    def final_progress(seconds, frames):
        nonlocal last_percent
        percent = min(95,86+int(9*seconds/max(.001,total)))
        if percent > last_percent:
            last_percent = percent
            progress(percent,f'Compositing video {min(seconds,total):.0f}/{total:.0f}s')
    performance['cuda_compositing'] = use_cuda
    if use_cuda:
        try:
            run_process(final_args+video_encoding(encoder)+color_args+suffix,log,idle_timeout=900,on_progress=final_progress,cwd=folder)
        except ValueError:
            performance['cuda_compositing'] = False
            performance['cuda_fallback'] = True
            use_cuda = False
    if not use_cuda:
        final_args = delivery_graph(base,joined,folder/'final_audio.wav',options,keyed_wave,logo_path)
        try:
            run_process(final_args+video_encoding(encoder)+color_args+suffix,log,idle_timeout=900,on_progress=final_progress,cwd=folder)
        except ValueError:
            if encoder=='libx264':raise
            encoder='libx264'
            run_process(final_args+video_encoding(encoder)+color_args+suffix,log,idle_timeout=900,on_progress=final_progress,cwd=folder)
    stage_done('compositing')
    with (folder/"timeline.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scene", "offset", "duration", "story_version"])
        writer.writeheader()
        writer.writerows({"scene": s["scene_key"], "offset": s["offset"], "duration": s["duration"], "story_version": project["story_version"]} for s in scenes)
    (folder/"thumbnail_prompt.txt").write_text(project.get("publish", {}).get("thumbnail_concept") or f"Cinematic thumbnail for {project['title']}. One clear focal subject, strong contrast, no misleading imagery.", encoding="utf-8")
    progress(96, "Final technical QA")
    report = final_qa(output, plan, binary, settings, log)
    stage_done('qa')
    report['captions_burned_in'] = options['subtitles']
    report['render_options'] = options
    report['inputs_hash'] = input_hash
    report['render_performance']={**performance,'encoder':encoder,'scene_workers':workers,'cached_scenes':reused,'rendered_scenes':len(scenes)-reused,
                                  'elapsed_seconds':round(time.monotonic()-started,2),'target_video_mbps':5,'audio_kbps':160,
                                  'join_groups':join_groups,'wave_key_color':wave_color if wave else None,'stages_seconds':stage_times}
    if report['status']=='READY':
        for intermediate in join_files: intermediate.unlink(missing_ok=True)
        processing_cache.prune()
        scene_cache.prune()
    report["warnings"] += validation["warnings"]
    if report["warnings"] and report["status"] == "READY":
        report["status"] = "NEEDS REVIEW"
    report.update({"story_version": project["story_version"], "file": str(output.relative_to(root)), "human_review_required": True, "synthetic_media": project.get("is_demo", False)})
    (folder/"render_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def final_qa(output: Path, plan: dict, binary: str, settings: dict, log: Path):
    metadata = probe(output, settings)
    checks = {"video_exists": output.is_file(), "duration_matches": abs(metadata["duration"]-plan["duration"]) < .6,
              "video_duration_matches": abs(metadata["video_duration"]-plan["duration"]) < .6,
              "audio_duration_matches": abs(metadata["audio_duration"]-plan["duration"]) < .6,
              "resolution": metadata["width"] == plan["width"] and metadata["height"] == plan["height"],
              "fps": abs(metadata["fps"]-plan["fps"]) < .1, "audio_stream": metadata["has_audio"],
              "subtitles": (output.parent/"captions.srt").is_file(), "thumbnail_prompt": (output.parent/"thumbnail_prompt.txt").is_file(),
              "scene_coverage": abs(sum(s["duration"] for s in plan["scenes"])-plan["duration"]) < .1}
    threshold = float(settings.get("silence_threshold", 3))
    result = run_process([binary, "-hide_banner", "-nostdin", "-i", str(output.parent/"master_narration.wav"), "-af", f"silencedetect=noise=-45dB:d={threshold}", "-f", "null", "-"], log)
    gaps = re.findall(r"silence_start: ([\d.]+)", result.stderr)
    warnings = [f"Narration silence begins at {gap}s (threshold {threshold}s). Review whether intentional." for gap in gaps]
    return {"status": "BLOCKED" if not all(checks.values()) else "NEEDS REVIEW" if warnings else "READY",
            "checks": checks, "metadata": metadata, "warnings": warnings}
