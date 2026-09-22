from __future__ import annotations

import csv
import hashlib
import json
import math
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


def run_process(args: list[str], log_path: Path | None = None, timeout: int = 3600, cwd: Path | None = None):
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
                missing.append(f"scene_{scene['number']:03}.{'mp4' if scene['visual_type']=='VIDEO' else 'png'}")
        elif asset["kind"] == "video" and (asset.get("duration") or 0) < scene.get("duration", 0) and not backup:
            if fallback:
                warnings.append(f"Short video scene {scene['number']}: placeholder fills remainder")
                visuals_ok += 1
            else:
                missing.append(f"scene_{scene['number']:03}.png (short-video fallback)")
        else:
            visuals_ok += 1
    if not chunks:
        missing.append("Generate TTS chunks")
    if not scenes:
        missing.append("Generate visual scene plan")
    return {"valid": not missing, "missing": missing, "warnings": warnings,
            "narration": [narration_ok, len(chunks)], "visuals": [visuals_ok, len(scenes)]}


def timeline_from_audio(chunks: list[dict], scenes: list[dict]) -> dict:
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
    return {"duration": round(offset, 6), "chunks": timeline_chunks, "scenes": timeline_scenes,
            "alignment": "Sentence-weighted within real audio chunks; not forced speech alignment"}


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
    transition = max(0, min(1.5, float(settings.get("transition_seconds", .4))))
    for s in scenes:
        transition = min(transition, s["duration"] / 3)
    return {"width": int(settings["render_width"]), "height": int(settings["render_height"]), "fps": int(settings["render_fps"]),
            "duration": total, "transition": transition, "video_codec": "libx264", "audio_codec": "aac",
            "scenes": [{**s, "clip_duration": s["duration"] + (transition if i<len(scenes)-1 else 0)} for i,s in enumerate(scenes)]}


def render_inputs_hash(project, chunks, scenes, assets, settings):
    """Track production inputs without treating unrelated uploads as render changes."""
    used = {c.get("asset_id") for c in chunks} | {s.get(k) for s in scenes for k in ("asset_id", "fallback_asset_id")}
    selected_assets = [a for a in assets if a["id"] in used or a["kind"] in ("music", "ambient", "sfx")]
    def fields(items, keys):
        return [{k: item.get(k) for k in keys} for item in sorted(items, key=lambda x:x["id"])]
    value = {
        "renderer": 2, "version": project["story_version"],
        "chunks": fields(chunks, ("id", "text", "asset_id", "real_duration")),
        "scenes": fields(scenes, ("id", "number", "start_word", "end_word", "asset_id", "fallback_asset_id")),
        "assets": fields(selected_assets, ("id", "sha256", "path", "duration", "metadata_json")),
        "settings": {k:settings.get(k) for k in ("render_width", "render_height", "render_fps", "transition_seconds", "music_db", "ambient_db", "narration_db", "allow_visual_fallback", "silence_threshold")},
    }
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def render_project(root: Path, project: dict, chunks: list[dict], scenes: list[dict], assets: list[dict], settings: dict, progress):
    binary = find_binary("ffmpeg", settings)
    if not binary:
        raise ValueError("FFmpeg not found. Configure it in Settings.")
    validation = validate_assets(chunks, scenes, assets, root, project["story_version"], settings.get("allow_visual_fallback", False))
    if not validation["valid"]:
        raise ValueError("Missing assets: " + ", ".join(validation["missing"]))
    if any(not c.get("real_duration") for c in chunks) or any(not s.get("duration") for s in scenes):
        raise ValueError("Sync with real audio before rendering")
    folder = project_folder(root, project["id"]) / "render"
    # Keep the previous playable render intact until this attempt has finished.
    folder = folder / f"v{project['story_version']}" / uuid4().hex[:16]
    folder.mkdir(parents=True, exist_ok=True)
    log = root / "logs" / "ffmpeg.log"
    asset_map = {a["id"]: a for a in assets}
    total = sum(c["real_duration"] for c in chunks)
    plan = build_render_plan(scenes, settings, total)
    for scene in plan["scenes"]:
        asset=asset_map.get(scene.get("asset_id"))
        if asset and asset["kind"]=="video" and (asset.get("duration") or 0)<scene["clip_duration"]-.02 and not scene.get("fallback_asset_id") and not settings.get("allow_visual_fallback"):
            raise ValueError(f"Scene {scene['number']} needs an image fallback to cover the video tail and transition")
    fps, width, height = plan["fps"], plan["width"], plan["height"]
    base = [binary, "-hide_banner", "-y", "-nostdin", "-threads", "2"]
    color_filter = "format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709"
    color_args = ["-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    progress(4, "Normalizing narration")
    # Normalize each chunk before concatenation; imported sample formats may differ.
    concat = []
    for chunk in sorted(chunks, key=lambda c: c["number"]):
        path = safe_path(root, asset_map[chunk["asset_id"]]["path"])
        output = folder / f"normalized_{chunk['number']:03}.wav"
        run_process(base + ["-protocol_whitelist", "file,pipe", "-i", str(path), "-vn", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(output)], log)
        concat.append(f"file '{output.name}'")
    (folder / "narration.txt").write_text("\n".join(concat), encoding="utf-8")
    master = folder / "master_narration.wav"
    run_process(base + ["-f", "concat", "-safe", "1", "-i", "narration.txt", "-c:a", "pcm_s16le", str(master)], log, cwd=folder)
    write_subtitles(chunks, folder)

    def still(image_path: Path, duration: float, output: Path, number: int):
        frames = max(1, math.ceil(duration * fps))
        x = "iw/2-(iw/zoom/2)" if number % 2 else "(iw-iw/zoom)*on/" + str(frames)
        vf = f"scale={width*2}:{height*2}:force_original_aspect_ratio=increase:out_range=tv:out_color_matrix=bt709,crop={width*2}:{height*2},zoompan=z='min(1.0+on*0.00015,1.08)':x='{x}':y='ih/2-(ih/zoom/2)':d={frames}:s={width}x{height}:fps={fps},setsar=1,{color_filter}"
        run_process(base + ["-protocol_whitelist", "file,pipe", "-i", str(image_path), "-vf", vf, "-t", str(duration), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "2"] + color_args + [str(output)], log)

    placeholder = folder / "missing_visual.png"
    def placeholder_path():
        if not placeholder.exists():
            from PIL import Image, ImageDraw
            im = Image.new("RGB", (width, height), "#142438")
            ImageDraw.Draw(im).text((40, height//2), "STORYFORGE / MISSING VISUAL - REVIEW REQUIRED", fill="#f5b267", font_size=max(18,width//42))
            im.save(placeholder)
        return placeholder

    clips = []
    for i, scene in enumerate(plan["scenes"]):
        progress(10+int(60*i/len(scenes)), f"Rendering scene {i+1}/{len(scenes)}")
        output = folder / f"clip_{i:03}.mp4"
        asset = asset_map.get(scene.get("asset_id"))
        fallback = asset_map.get(scene.get("fallback_asset_id"))
        if not asset:
            asset = fallback
        duration = scene["clip_duration"]
        if not asset or asset["kind"] == "image":
            path = safe_path(root, asset["path"]) if asset else placeholder_path()
            still(path, duration, output, i)
        else:
            path = safe_path(root, asset["path"])
            video_duration = min(duration, asset.get("duration") or duration)
            part = folder / f"video_{i:03}.mp4"
            vf = f"scale={width}:{height}:force_original_aspect_ratio=increase:out_range=tv:out_color_matrix=bt709,crop={width}:{height},fps={fps},setsar=1,{color_filter}"
            run_process(base + ["-protocol_whitelist", "file,pipe", "-i", str(path), "-t", str(video_duration), "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-threads", "2"] + color_args + [str(part)], log)
            if video_duration < duration - .02:
                tail = folder / f"tail_{i:03}.mp4"
                still(safe_path(root, fallback["path"]) if fallback else placeholder_path(), duration-video_duration, tail, i)
                # Re-encode a single stream: copying H.264 packets from a video
                # and JPEG-derived tail can change pixel format/color metadata
                # midstream and reset the later xfade graph at the splice.
                join = f"[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,{color_filter}[v]"
                run_process(base + ["-i", str(part), "-i", str(tail), "-filter_complex", join, "-map", "[v]", "-an", "-r", str(fps), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "2"] + color_args + [str(output)], log)
            else:
                shutil.copyfile(part, output)
        clips.append(output)
    progress(76, "Mixing audio with narration ducking")
    beds = [a for a in assets if a["kind"] in ("music", "ambient")][:2]
    effects = [a for a in assets if a["kind"] == "sfx"][:30]
    audio_args = base + ["-i", str(master)]
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
    run_process(audio_args + ["-filter_complex", ";".join(filters), "-map", "[out]", "-t", str(total), "-ar", "48000", "-ac", "2", str(folder/"final_audio.wav")], log)
    progress(84, "Compositing transitions and captions")
    args = base[:]
    for clip in clips:
        args += ["-i", str(clip)]
    args += ["-i", str(folder/"final_audio.wav"), "-i", str(folder/"captions.srt")]
    graph = [f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[v{i}]" for i in range(len(clips))]
    previous, offset = "v0", 0.0
    transition = plan["transition"]
    if transition > 0:
        for i in range(1, len(clips)):
            offset += scenes[i-1]["duration"]
            graph.append(f"[{previous}][v{i}]xfade=transition=fade:duration={transition}:offset={offset}[x{i}]")
            previous = f"x{i}"
    elif len(clips) > 1:
        graph.append("".join(f"[v{i}]" for i in range(len(clips))) + f"concat=n={len(clips)}:v=1:a=0[joined]")
        previous = "joined"
    output = folder/"final_video.mp4"
    # Relative subtitle path avoids Windows drive-colon/filter escaping issues.
    graph.append(f"[{previous}]subtitles=filename=captions.srt:force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=24'[captioned]")
    run_process(args + ["-filter_complex_threads", "1", "-filter_complex", ";".join(graph), "-map", "[captioned]", "-map", f"{len(clips)}:a", "-map", f"{len(clips)+1}:s", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-disposition:s:0", "0", "-metadata:s:s:0", "language=eng", "-r", str(fps), "-t", str(total), "-movflags", "+faststart", "-threads", "2", str(output)], log, timeout=14400, cwd=folder)
    with (folder/"timeline.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scene", "offset", "duration", "story_version"])
        writer.writeheader()
        writer.writerows({"scene": s["scene_key"], "offset": s["offset"], "duration": s["duration"], "story_version": project["story_version"]} for s in scenes)
    (folder/"thumbnail_prompt.txt").write_text(project.get("publish", {}).get("thumbnail_concept") or f"Cinematic thumbnail for {project['title']}. One clear focal subject, strong contrast, no misleading imagery.", encoding="utf-8")
    progress(96, "Final technical QA")
    report = final_qa(output, plan, binary, settings, log)
    report['captions_burned_in'] = True
    report['inputs_hash'] = render_inputs_hash(project, chunks, scenes, assets, settings)
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
