from __future__ import annotations

import json
import os
import sys
from pathlib import Path

VERSION = "3.1.21"
APP_ROOT = Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parents[1]
RESOURCE_ROOT = Path(getattr(sys, "_MEIPASS", APP_ROOT))
CONFIG_FILE = APP_ROOT / "storyforge.config.json"


def default_data_root() -> Path:
    if os.environ.get("STORYFORGE_DATA_ROOT"):
        return Path(os.environ["STORYFORGE_DATA_ROOT"]).expanduser().resolve()
    if CONFIG_FILE.exists():
        configured = json.loads(CONFIG_FILE.read_text(encoding="utf-8")).get("data_root")
        if configured:
            return Path(configured).expanduser().resolve()
    return APP_ROOT.parent / "StoryForge US Data"


DEFAULT_SETTINGS = {
    "provider_mode": "mock", "default_wpm": 150, "default_duration": 10,
    "default_premise_count": 10, "visual_video_ratio": 0.15,
    "ffmpeg_path": "", "ffprobe_path": "", "browser": "edge",
    "render_width": 1920, "render_height": 1080, "render_fps": 30,
    "render_encoder": "auto",
    "music_db": -28, "ambient_db": -32, "narration_db": 0,
    "max_audit_cycles": 3, "browser_timeout": 180, "silence_threshold": 3,
    "auto_select_premise": False, "auto_lock": False,
    "pipeline_mode": "assisted", "voice_name": "Kore", "transition_seconds": 0.4,
    "allow_visual_fallback": False,
}


def safe_path(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Path is outside the workspace")
    return path


def initialize_folders(root: Path) -> None:
    for folder in ("logs", "projects", "exports", "backups", "prompts"):
        (root / folder).mkdir(parents=True, exist_ok=True)
