# Changelog

## 3.1.11 — 2026-10-02 (local only)

- Replace the CSV/media CapCut handoff with native CapCut Desktop project export, tested with CapCut International 9.5 on Windows.
- Copy assigned media into a new, independent draft. Re-probe narration/video durations and use the existing video anchors, image coverage and ending thumbnail without rendering the complete video in StoryForge.
- Create editable scene/narration tracks, background audio/SFX, selected subtitles, native-size green-screen waveform loops with sampled chroma key, and the topmost transparent PNG logo.
- Show export progress and the resulting project folder. Preserve existing project/archive exports, settings, workflows and Browser Bridge 1.1.10.

## 3.1.10 — 2026-10-02

- Add an optional Vietnamese reading pane in Source material, supporting English and Chinese transcripts. Keep the original JSON editor, source fields, analysis prompts and adaptation workflows unchanged.
- Translate visible chunks on the device with one background queue; cache display translations separately by source language and reuse them across reloads. No workflow jobs or translated source data are saved to the backend.
- Retain all settings, render behavior and Browser Bridge 1.1.10.

## 3.1.9 — 2026-09-30

- Sample the uploaded waveform video's actual green background instead of assuming pure #00FF00. Preserve its native canvas, speed, loop and position below the logo.
- Compose scenes in groups of at most six inputs, preserving frame-aligned video positions and transitions between groups. Apply captions/waveform/logo once to the assembled video.
- Replace fixed render deadlines with a progress watchdog: keep advancing renders running, stop after 15 minutes without frame/time advancement, and retain useful failure details and the previous completed video.
- Keep GPU final encoding and scene cache; use a fast CPU intermediate to avoid Quick Sync chroma changes during concat/xfade. Remove completed temporary join files after technical QA.

## 3.1.8 — 2026-09-30 (local only)

- Add per-project standard, half-count minimum and custom image/video budgets; validate AI counts before replacing the plan and prioritize main story beats.
- Display visual scenes as scene_001, scene_002, etc., retaining existing IDs and assets.
- Probe hardware encoding, use NVENC/Quick Sync when available and fall back to CPU. Encode final H.264 at 5 Mbps target with hardware, quality-based VBR with CPU, AAC 160 kbps.
- Prepare up to two scenes concurrently and reuse validated scene cache on rerenders while preserving fixed video timing and all existing overlays.

## 3.1.7 — 2026-09-29

- Preserve video starts and native duration; resize only image scene timing. Use frame-aligned cuts around videos, with transitions retained between images.
- Fill remaining audio after the final video with the assigned project/ending thumbnail. Report conflicting timing instead of trimming, looping or shifting video.
- Apply transparent full-canvas PNG overlays at 0,0 without resizing/repositioning, validating format and output dimensions.
- Use a selected green-screen asset for waveform: remove green, loop to output duration at original size/position, discard overlay audio and composite below the logo.
- Keep other features and Browser Bridge 1.1.10 unchanged.

## 3.1.6 — 2026-09-29

- Render assigned images/videos regardless of filename or planned visual type. Loop short videos when no fallback image is assigned and sync narration timing before every render.
- Add asset selection and confirmed single/bulk removal, preserving source files, shared imports and completed renders.
- Add per-project subtitles, moving audio waveform and topmost channel-logo overlay options. Defaults preserve subtitle behavior; waveform replaces subtitles.
- Retain Browser Bridge 1.1.10 and existing story workflows.

## 3.1.5 — 2026-09-28

- Browser Bridge 1.1.10 waits at least five seconds after the provider tab finishes loading, then observes an editable composer stable for at least two seconds before filling a prompt.
- Loading/reloading resets the settling period. The wait survives worker restarts and respects cancellation, disabling automation, and the existing preparation deadline.
- Readiness probes do not focus or modify the editor and time out on frozen tabs. Existing prompt verification, single-send protection, and response collection are preserved.
- Reload Browser Bridge after installing the update.

## 3.1.4 — 2026-09-28

- Browser Bridge 1.1.9 waits for the current ChatGPT response's completion controls before parsing or retrying, even when the Stop selector changes. Explicit thinking units are excluded from capture.
- Reinjection restores a disconnected same-version content listener after Reload, preserving the per-tab sent-job guard.
- Includes all ChatGPT answer collection fixes from 3.1.3. Other workflows and settings remain unchanged.

## 3.1.3 — 2026-09-28

- Browser Bridge 1.1.8 recognizes ChatGPT's current search-unit and assistant Markdown renderer, including response identity across virtualized turns.
- Recover original JSON escapes through the matching response's Copy action when rendered Markdown is not valid JSON; restore clipboard methods immediately afterward without reading the user's clipboard.
- Bound stalled tab reads and reconnect within the existing collection deadline, without sending the prompt again.
- Resume one legacy collection pause after upgrading the renderer; accepted results still close only their dedicated, unchanged provider tab.
- Log whether a result arrived from automatic collection or a manual action to make future diagnostics verifiable.
- Existing workflows and settings are unchanged. Reload Browser Bridge after installation.

## 3.1.2 — 2026-09-28

- Browser Bridge 1.1.7 recognizes additional ChatGPT composers, including Vietnamese inputs and rich text editors without the previous element ID.
- Continue collecting slow replies within a bounded 15-minute window instead of stopping after three minutes; recover an already-sent legacy timeout by polling only.
- Read all blocks of the latest assistant message and use message identity when rendered message counts stay unchanged.
- Bounded recovery reconnects pre-send tasks after delayed editor loading or a closed message channel, preserving user drafts and single-send authorization.
- Verify the filled prompt before sending; keep existing project settings and workflows.
- Reload the unpacked Browser Bridge extension after installing this update.

## 3.0.0 — 2026-09-17

- First local Windows implementation from the StoryForge US master specification.
- FastAPI/SQLite backend with durable jobs, versioned artifacts and offline fixture provider.
- Channel/source/project workflow, duration profiles, premise mini-tests and human checkpoints.
- Cross-model audit claims, independent cross-review, disagreement resolution, targeted repairs and exact-version dual verification.
- Semantic TTS, visual plans, file validation/mapping, actual-audio sync, captions and FFmpeg render/QA.
- Manual analytics snapshots, observational learning, calendar and global novelty guards.
- Chrome/Edge MV3 Browser Bridge with explicit UI controls and copy/paste fallback.
- Windows launcher, installer scripts, portable release, demo database and automated tests.
- Manual/Assisted/Auto execution semantics, saved premise defaults, responsive navigation and verification invalidation when story context changes.
