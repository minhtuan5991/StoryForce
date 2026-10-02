"""Native, local CapCut Desktop drafts. Times are integer microseconds.

The schema is derived from a blank CapCut International 9.5 Windows draft.
No CapCut accounts, cloud services or paid effects are used.
"""
from __future__ import annotations

import copy
import json
import math
import os
import re
import shutil
import time
from pathlib import Path
from uuid import uuid4

from PIL import Image

from .config import safe_path
from .media import (probe, timeline_from_audio, render_options, validate_assets,
                    validate_logo, validate_waveform_video, write_subtitles,
                    find_binary)
from .render_pipeline import wave_key_color


def new_id():
    return str(uuid4()).upper()


def micros(seconds):
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError("Invalid CapCut timeline time")
    return round(seconds * 1_000_000)


def default_drafts_folder():
    local = os.environ.get("LOCALAPPDATA")
    if local:
        config = Path(local) / "CapCut/User Data/Config/globalSetting"
        if config.is_file():
            for line in config.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.startswith('currentCustomDraftPath='):
                    custom = Path(line.split('=', 1)[1].replace('\\\\', '\\').strip())
                    if custom.is_absolute() and custom.is_dir():
                        return str(custom)
        folder = Path(local) / "CapCut/User Data/Projects/com.lveditor.draft"
        if folder.is_dir():
            return str(folder)
    return ""


def drafts_folder(value):
    folder = Path(value).expanduser()
    if not folder.is_absolute() or not folder.is_dir():
        raise ValueError("Choose an existing CapCut drafts folder from CapCut Settings → Draft location")
    # Never put a new project inside an existing draft or a filesystem root.
    if folder.parent == folder or (folder / "draft_content.json").exists():
        raise ValueError("Choose the folder containing CapCut projects, not an individual project")
    return folder.resolve()


def draft_document(title, width, height, fps, duration):
    categories = ("videos audios texts speeds chromas transitions audio_fades material_animations "
                  "canvases sound_channel_mappings vocal_separations effects stickers images flowers "
                  "tail_leaders audio_effects beats placeholders placeholder_infos common_mask "
                  "text_templates realtime_denoises video_trackings hsl drafts color_curves "
                  "primary_color_wheels log_color_wheels video_effects audio_balances handwrites "
                  "manual_deformations manual_beautys plugin_effects green_screens shapes "
                  "material_colors digital_humans digital_human_model_dressing smart_crops "
                  "ai_translates audio_track_indexes loudnesses vocal_beautifys smart_relights "
                  "time_marks multi_language_refs").split()
    platform = {"app_id": 359289, "app_source": "cc", "app_version": "9.5.0", "os": "windows"}
    return {"id": new_id(), "name": title, "version": 360000, "new_version": "187.0.0",
            "duration": micros(duration), "fps": fps, "create_time": int(time.time()),
            "update_time": int(time.time()), "canvas_config": {"width": width, "height": height, "ratio": "original", "background": None},
            "config": {"maintrack_adsorb": False, "material_save_mode": 0, "video_mute": False,
                       "subtitle_sync": True, "subtitle_taskinfo": [], "system_font_list": []},
            "materials": {key: [] for key in categories}, "tracks": [],
            "keyframes": {key: [] for key in ("videos", "audios", "texts", "stickers", "filters", "effects", "adjusts", "handwrites")},
            "platform": platform, "last_modified_platform": dict(platform),
            "color_space": -1, "render_index_track_mode_on": True,
            "free_render_index_mode_on": False, "mixed_track_mode_on": False,
            "is_drop_frame_timecode": False, "keyframe_graph_list": [], "relationships": [],
            "group_container": None, "cover": None, "retouch_cover": None, "extra_info": None,
            "mutable_config": None, "static_cover_image_path": "", "source": "default",
            "time_marks": None, "lyrics_effects": [], "path": "", "draft_type": "video"}


def track(kind, name, layer=0):
    return {"id": new_id(), "type": kind, "name": name, "attribute": 0,
            "flag": 0, "is_default_name": False, "segments": [], "render_index": layer}


def segment(document, material, start, duration, *, visual=False, layer=0, volume=1, source_start=0):
    speed_id = new_id()
    document["materials"]["speeds"].append({"id": speed_id, "type": "speed", "mode": 0, "speed": 1.0, "curve_speed": None})
    result = {"id": new_id(), "material_id": material["id"],
              "target_timerange": {"start": micros(start), "duration": micros(start+duration)-micros(start)},
              "source_timerange": {"start": micros(source_start), "duration": micros(duration)},
              "speed": 1.0, "volume": volume, "last_nonzero_volume": volume or 1.0,
              "extra_material_refs": [speed_id], "common_keyframes": [], "keyframe_refs": [],
              "reverse": False, "visible": True, "track_attribute": 0,
              "track_render_index": layer, "render_index": layer,
              "enable_adjust": True, "enable_lut": True, "enable_color_curves": True,
              "enable_color_wheels": True, "enable_color_correct_adjust": False,
              "enable_color_match_adjust": False, "enable_smart_color_adjust": False,
              "clip": None, "hdr_settings": None, "is_tone_modify": False}
    if visual:
        result.update(clip={"alpha": 1.0, "flip": {"horizontal": False, "vertical": False},
                            "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0},
                            "transform": {"x": 0.0, "y": 0.0}},
                      uniform_scale={"on": True, "value": 1.0},
                      hdr_settings={"intensity": 1.0, "mode": 1, "nits": 1000})
    return result


def media_material(asset, path):
    info = asset["metadata_json"]
    duration = asset.get("duration") or 0
    if asset["kind"] in ("image", "video"):
        return {"id": new_id(), "type": "photo" if asset["kind"] == "image" else "video",
                "path": path.as_posix(), "material_name": asset["name"], "media_path": "",
                "local_material_id": "", "duration": micros(duration) if duration else 10_800_000_000,
                "width": info["width"], "height": info["height"], "check_flag": 63487,
                "category_name": "local", "category_id": "", "audio_fade": None,
                "crop_ratio": "free", "crop_scale": 1.0,
                "crop": {"upper_left_x": 0, "upper_left_y": 0, "upper_right_x": 1, "upper_right_y": 0,
                         "lower_left_x": 0, "lower_left_y": 1, "lower_right_x": 1, "lower_right_y": 1}}
    mid = new_id()
    return {"id": mid, "type": "extract_music", "name": asset["name"], "path": path.as_posix(),
            "duration": micros(duration), "local_material_id": mid, "music_id": mid,
            "category_name": "local", "category_id": "", "check_flag": 3,
            "copyright_limit_type": "none", "source_platform": 0, "app_id": 0,
            "effect_id": "", "formula_id": "", "wave_points": []}


def captions(document, chunks, folder):
    write_subtitles(chunks, folder)
    result = track("text", "Subtitles", 15000)
    content = (folder / "captions.srt").read_text(encoding="utf-8")
    def seconds(value):
        h, m, s = value.replace(",", ".").split(":")
        return int(h)*3600 + int(m)*60 + float(s)
    for block in content.strip().split("\n\n"):
        lines = block.splitlines()
        if len(lines) < 3:
            continue
        a, b = map(seconds, lines[1].split(" --> "))
        text = "\n".join(lines[2:])
        # CapCut measures text ranges in UTF-16 code units.
        style = {"fill": {"alpha": 1.0, "content": {"render_type": "solid", "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}}},
                 "range": [0, len(text.encode('utf-16-le'))//2], "size": 5.0,
                 "bold": False, "italic": False, "underline": False,
                 "strokes": [{"width": 0.05, "content": {"solid": {"color": [0.04, 0.04, 0.04]}}, "alpha": 1.0}]}
        mat = {"id": new_id(), "type": "subtitle", "content": json.dumps({"text": text, "styles": [style]}, ensure_ascii=False),
               "alignment": 1, "typesetting": 0, "letter_spacing": 0, "line_spacing": 0.02,
               "line_feed": 1, "line_max_width": 0.82, "force_apply_line_max_width": False,
               "check_flag": 15, "global_alpha": 1.0}
        document["materials"]["texts"].append(mat)
        seg = segment(document, mat, a, b-a, visual=True, layer=15000)
        seg["source_timerange"] = None
        seg["clip"]["transform"]["y"] = -0.8
        result["segments"].append(seg)
    document["tracks"].append(result)


def export_project(root, project, chunks, scenes, assets, settings, destination, progress=lambda *_: None, cancelled=lambda: False):
    """Copy assigned media into a new draft; never touch existing user drafts."""
    parent = drafts_folder(destination)
    assets = copy.deepcopy(assets)
    chunks = copy.deepcopy(chunks)
    scenes = copy.deepcopy(scenes)
    options = render_options(project)
    ids = {c.get("asset_id") for c in chunks} | {s.get(k) for s in scenes for k in ("asset_id", "fallback_asset_id")}
    ids.add(options["ending_asset_id"])
    if options["overlay"]:
        ids.add(options["logo_asset_id"])
    if options["waveform"]:
        ids.add(options["waveform_asset_id"])
    beds = sorted((a for a in assets if a["kind"] in ("music", "ambient")), key=lambda a: (a.get("created_at", ""), a["id"]))[:2]
    effects = sorted((a for a in assets if a["kind"] == "sfx"), key=lambda a: (a.get("created_at", ""), a["id"]))[:30]
    ids.update(a["id"] for a in beds+effects)
    selected = [a for a in assets if a["id"] in ids]
    progress(5, "Checking assigned media")
    for i, asset in enumerate(selected):
        if cancelled():
            raise ValueError("CapCut export cancelled")
        source = safe_path(root, asset["path"])
        if not source.is_file():
            continue  # validate_assets can choose a declared image fallback.
        if asset["kind"] == "image":
            with Image.open(source) as im:
                info = {"width": im.width, "height": im.height}
        else:
            info = probe(source, settings)
            stream = "video" if asset["kind"] == "video" else "audio"
            if not info["has_"+stream]:
                raise ValueError("Invalid media stream: " + asset["name"])
            asset["duration"] = info[stream+"_duration"] or info["duration"]
        asset["metadata_json"] = {**(asset.get("metadata_json") or {}), **info}
        progress(5+round(15*(i+1)/max(1,len(selected))), "Checking assigned media")
    amap = {a["id"]: a for a in assets}
    for chunk in chunks:
        asset = amap.get(chunk.get("asset_id"))
        if asset:
            chunk["real_duration"] = asset.get("duration")
    validation = validate_assets(chunks, scenes, assets, root, project["story_version"], False)
    if not validation["valid"]:
        raise ValueError("Missing assets: " + ", ".join(validation["missing"]))
    # Resolve an unavailable primary clip before fitting video anchors. The
    # declared still fallback behaves as an image and absorbs narration time.
    for scene in scenes:
        primary = amap.get(scene.get("asset_id"))
        if not primary or not safe_path(root, primary["path"]).is_file():
            backup = amap.get(scene.get("fallback_asset_id"))
            if not backup or backup["kind"] != "image":
                raise ValueError("A scene fallback must be an available image")
            scene["asset_id"] = backup["id"]
    timing = timeline_from_audio(chunks, scenes, assets, options["ending_asset_id"])
    originals = {s["id"]: s for s in scenes}
    rows = [{**originals.get(s["id"], {}), **s} for s in timing["scenes"]]
    width, height, fps = (int(settings[k]) for k in ("render_width", "render_height", "render_fps"))
    document = draft_document(project["title"], width, height, fps, timing["duration"])
    suffix = uuid4().hex[:8]
    title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", project["title"]).strip(" .")[:60] or "StoryForge"
    name = f"StoryForge - {title} - v{project['story_version']} - {suffix}"
    output = parent / name
    # Staging is outside the drafts list; only a complete validated draft is published.
    staging = root / "exports" / ("capcut-" + suffix)
    staging.mkdir(parents=True, exist_ok=False)
    media = staging / "media"
    media.mkdir()
    materials = {}
    try:
        def material(aid):
            if cancelled():
                raise ValueError("CapCut export cancelled")
            if aid in materials:
                return materials[aid]
            asset = amap.get(aid)
            if not asset:
                raise ValueError("An assigned CapCut resource is missing")
            source = safe_path(root, asset["path"])
            if not source.is_file():
                raise ValueError("Missing resource: " + asset["name"])
            filename = uuid4().hex[:12] + source.suffix.lower()
            shutil.copy2(source, media / filename)
            mat = media_material(asset, output / "media" / filename)
            category = "videos" if asset["kind"] in ("image", "video") else "audios"
            document["materials"][category].append(mat)
            materials[aid] = mat
            return mat
        visuals = track("video", "Scenes", 0)
        for i, row in enumerate(rows):
            aid = row.get("asset_id")
            if not aid or not safe_path(root, amap[aid]["path"]).is_file():
                aid = row.get("fallback_asset_id")
            mat = material(aid)
            seg = segment(document, mat, row["offset"], row["duration"], visual=True, volume=0)
            # Match StoryForge's fill crop for scene media. Native-size overlays
            # use scale 1 and (0,0) on their own tracks below.
            factor = max(width/mat["width"], height/mat["height"]) / min(width/mat["width"], height/mat["height"])
            if row.get("ending_thumbnail"):
                factor = 1
            seg["clip"]["scale"] = {"x": factor, "y": factor}
            visuals["segments"].append(seg)
            progress(20+round(40*(i+1)/len(rows)), "Copying scene media")
        document["tracks"].append(visuals)
        narration = track("audio", "Narration")
        offsets = {c["id"]: c for c in timing["chunks"]}
        for chunk in sorted(chunks, key=lambda c: c["number"]):
            row = offsets[chunk["id"]]
            narration["segments"].append(segment(document, material(chunk["asset_id"]), row["offset"], row["duration"], volume=10**(float(settings.get("narration_db", 0))/20)))
        document["tracks"].append(narration)
        for bed in beds:
            mat = material(bed["id"])
            bed_track = track("audio", bed["kind"].title())
            cursor = 0.0
            while cursor < timing["duration"]-0.000001:
                duration = min(bed["duration"], timing["duration"]-cursor)
                if duration <= 0:
                    raise ValueError("Background audio has no duration")
                bed_track["segments"].append(segment(document, mat, cursor, duration, volume=10**(float(settings.get(bed["kind"]+"_db", -28))/20)))
                cursor += duration
            document["tracks"].append(bed_track)
        for effect in effects:
            offset = max(0, float((effect.get("metadata_json") or {}).get("offset", 0)))
            duration = min(effect["duration"], timing["duration"]-offset)
            if duration > 0:
                fx = track("audio", "SFX: " + effect["name"])
                fx["segments"].append(segment(document, material(effect["id"]), offset, duration, volume=10**(float(effect["metadata_json"].get("volume_db", -18))/20)))
                document["tracks"].append(fx)
        if options["subtitles"]:
            captions(document, chunks, staging)
        if options["waveform"]:
            wave = amap.get(options["waveform_asset_id"])
            if not wave or wave["kind"] != "video":
                raise ValueError("Choose an available green-screen video or turn off waveform")
            source = safe_path(root, wave["path"])
            validate_waveform_video(source, settings)
            color = wave_key_color(find_binary("ffmpeg", settings), source, wave["duration"])
            chroma = {"id": new_id(), "type": "chroma", "version": "v2", "color": "#"+color.removeprefix("0x")+"ff",
                      "intensity_value": 0.2, "shadow_value": 0.0, "edge_smooth_value": 0.05,
                      "spill_value": 0.0, "should_transfer_color": True}
            document["materials"]["chromas"].append(chroma)
            mat = material(wave["id"])
            wave_track = track("video", "Waveform", 16000)
            cursor = 0.0
            while cursor < timing["duration"]-0.000001:
                duration = min(wave["duration"], timing["duration"]-cursor)
                seg = segment(document, mat, cursor, duration, visual=True, layer=16000, volume=0)
                seg["extra_material_refs"].append(chroma["id"])
                wave_track["segments"].append(seg)
                cursor += duration
            document["tracks"].append(wave_track)
        if options["overlay"]:
            logo = amap.get(options["logo_asset_id"])
            if not logo or logo["kind"] != "image":
                raise ValueError("Choose an available logo image or turn off overlay")
            validate_logo(safe_path(root, logo["path"]), settings)
            logo_track = track("video", "Logo", 17000)
            logo_track["segments"].append(segment(document, material(logo["id"]), 0, timing["duration"], visual=True, layer=17000, volume=0))
            document["tracks"].append(logo_track)
        progress(85, "Writing CapCut project")
        size = sum(p.stat().st_size for p in media.iterdir())
        library = []
        stamp = time.time_ns()//1000
        for mat in materials.values():
            visual = mat['type'] in ('video', 'photo')
            library.append({'id': mat['id'], 'file_Path': mat['path'], 'type': 0,
                            'metetype': mat['type'] if visual else 'music',
                            'width': mat.get('width', 0), 'height': mat.get('height', 0),
                            'duration': mat['duration'], 'create_time': stamp//1_000_000,
                            'import_time': stamp//1_000_000, 'import_time_ms': stamp//1000,
                            'roughcut_time_range': {'start': -1 if mat['type']=='photo' else 0, 'duration': -1 if mat['type']=='photo' else mat['duration']},
                            'sub_time_range': {'start': -1, 'duration': -1},
                            'md5': '', 'extra_info': mat.get('material_name') or mat.get('name'),
                            'enter_from': 0, 'item_source': 1, 'ai_group_type': '', 'material_color_tag': ''})
        meta = {"draft_id": document["id"], "draft_name": name, "draft_fold_path": output.as_posix(),
                "draft_root_path": parent.as_posix(), "draft_json_file": (output/"draft_content.json").as_posix(),
                "draft_cover": "draft_cover.jpg", "draft_materials": [{'type': 0, 'value': library}], "draft_segment_extra_info": [],
                "draft_cloud_sync": False, "draft_is_invisible": False, "draft_new_version": "",
                "tm_draft_create": time.time_ns()//1000, "tm_draft_modified": time.time_ns()//1000,
                "tm_draft_removed": 0, "tm_duration": document["duration"], "draft_timeline_materials_size_": size}
        manifest = {"format": "storyforge-capcut", "version": 1, "project_id": project["id"], "story_version": project["story_version"],
                    "draft_id": document["id"], "draft_name": name, "folder": str(output),
                    "duration": timing["duration"], "scene_count": len(rows), "narration_count": len(chunks),
                    "tracks": [t["name"] for t in document["tracks"]], "render_options": options,
                    "alignment_note": timing.get("alignment"), "tested_schema": "CapCut International 9.5 Windows"}
        for filename, data in (("draft_content.json", document), ("draft_meta_info.json", meta), ("storyforge_export.json", manifest)):
            (staging/filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        store = {'draft_materials': [], 'draft_virtual_store': [
            {'type': 0, 'value': [{'id': '', 'display_name': '', 'creation_time': 0, 'import_time': 0, 'import_time_us': 0, 'sort_type': 0, 'sort_sub_type': 0, 'filter_type': 0, 'subdraft_filter_type': 0, 'material_color_tag': ''}]},
            {'type': 1, 'value': [{'child_id': m['id'], 'parent_id': ''} for m in library]},
            {'type': 2, 'value': []}]}
        (staging/'draft_virtual_store.json').write_text(json.dumps(store), encoding='utf-8')
        (staging/"OPEN_ME_FIRST.txt").write_text("Open CapCut Desktop and select this project on its Home screen. If it is not listed, restart CapCut.\nMedia is copied into this draft; keep the whole folder together.\nExport: H.264, 1080p, 30 fps, target 5 Mbps, AAC 160 kbps.\n", encoding="utf-8")
        first_image = next((a for a in selected if a["kind"] == "image" and safe_path(root,a["path"]).is_file()), None)
        if first_image:
            with Image.open(safe_path(root,first_image["path"])) as im:
                im.convert("RGB").resize((320,180)).save(staging/"draft_cover.jpg", quality=85)
        if cancelled():
            raise ValueError("CapCut export cancelled")
        # Exclusive destination creation also prevents overwriting another draft.
        output.mkdir(exist_ok=False)
        try:
            shutil.copytree(staging, output, dirs_exist_ok=True)
            if cancelled():
                raise ValueError("CapCut export cancelled")
        except Exception:
            if not output.resolve().is_relative_to(parent):
                raise ValueError('Unsafe CapCut output path')
            shutil.rmtree(output)
            raise
        progress(100, "CapCut project ready")
        return manifest
    finally:
        if not staging.resolve().is_relative_to(root.resolve()/'exports'):
            raise ValueError('Unsafe CapCut staging path')
        shutil.rmtree(staging)
