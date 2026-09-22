# Architecture

The desktop product is a local React application served by FastAPI, opened by a lightweight Python launcher. PyInstaller bundles the interpreter and backend; Inno Setup packages the executable and shortcuts. No cloud service or paid API is required.

## Components

- `backend/api.py`: typed REST inputs, loopback/CSRF boundary, channel/source/project CRUD, media import, analytics, settings, exports and restore staging.
- `backend/models.py`: explicit relational SQLAlchemy tables. JSON columns contain bounded structured artifacts, profiles and provenance. Foreign keys, indexes and WAL support multi-project work.
- `backend/database.py`: schema migration registry, SQLite online backup, interrupted-job recovery.
- `backend/workflow.py`: persistent jobs, provider contracts, premise gates, cross-review/resolver, exact-version verification, story locking, chunking, sync and rendering.
- `backend/intelligence.py`: duration budgets, local token/motif novelty heuristics, channel fit and semantic sentence-boundary scoring.
- `backend/providers.py`: `LLMProvider`, `MockProvider`, `BrowserBridgeProvider`.
- `backend/media.py`: local-only ffprobe inputs, real-duration timeline, sentence-weighted captions, normalized audio concatenation, H.264/AAC render, slow image motion, crossfades, video-to-image fallback, sidechain ducking and technical QA.
- `frontend/src`: hash routes, reusable controls, application screens, dark design tokens. No CDN, remote fonts or telemetry.
- `browser-extension`: user-driven MV3 adapters with manual continuation.

## State and provenance

SQLite is authoritative; UI navigation survives reload through the URL. Jobs have `queued`, `running`, `waiting_user`, `completed`, `failed`, `cancelled`. Restart converts interrupted execution to `waiting_user`; resume restarts that bounded step, without replaying completed pipeline stages.

Each AI artifact stores provider, timestamp, raw/parsed JSON, template hash, input hash, output hash and story version. Browser results are accepted only if the pending draft hash still matches. Pydantic verifies critical Story DNA, audit issue and verification contracts. Other artifacts have explicit required-field checks.

The user selects a qualified premise. Gemini audit claims must have evidence; ChatGPT must review each claim and provide an independent sweep. Disputed/new issues are rechecked once, then uncertain issues require human review. Targeted rewrites replace exact affected passages. Three rewrite cycles maximum. Both final verifications are tied to a fingerprint of the current draft, Bible, outline and issue state.

Story edits create a new version, release the lock and mark changed TTS/scenes stale. Matching TTS text retains attached audio; scene timing is invalidated. Rebuilding TTS reuses exact-text matches. Scene plan regeneration currently rebuilds the plan; see limitations.

## Data layout

```text
StoryForge US Data/
  storyforge.db
  logs/{app,browser_bridge,render,ffmpeg,audit}.log
  prompts/                 # user overrides; packaged defaults remain intact
  backups/                 # online database snapshots
  exports/
  projects/<id>/
    audio/ images/ videos/ music/ ambient/ sfx/
    subtitles/{captions.srt,captions.vtt}
    timeline.json
    render/v<story-version>/
      final_video.mp4 final_audio.wav master_narration.wav
      captions.srt captions.vtt timeline.csv
      thumbnail_prompt.txt render_report.json
```

Data-root changes copy current project folders and back up SQLite into an empty target, retain originals, and update `storyforge.config.json` beside the app. Restart immediately to switch roots. Database restore validates integrity/schema and stages replacement for next startup; the old database is backed up first. Project archives include JSON, narration, Bible/outline/audits, prompts and optional media. ZIP extraction guards reject traversal and symlinks.

## Security boundaries

Host allowlist, origin validation and a per-process CSRF token protect local UI mutations. Extension routes require a separate revocable pairing token. No API secrets, cookies or provider sessions are stored. Media paths stay beneath the data root. FFmpeg uses argument arrays, network protocols disabled for imported assets, bounded probing time, and finite render jobs. Extension controls are available only from the extension UI and known provider hosts.

The loopback API is intended for one trusted Windows user. It is not a multi-user service or an Internet-facing API. Database backups contain the local bridge pairing key; re-pair after sharing or restoring a backup.

## Schema migrations

Migration 1 creates all named tables from SQLAlchemy metadata inside the `schema_migrations` transaction. Add subsequent numbered migrations in `Database.migrate`; never silently edit existing schemas. Snapshot the database before destructive future migrations. See `docs/SCHEMA.md` for tables and relationships.
