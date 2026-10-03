# Changelog

## 3.1.17 — 2026-10-03 (local only)

- Add Delete channel on channel cards and in the channel studio. Preview all owned projects before confirming deletion, preserve library sources, and optionally remove private project media using the existing shared-file protections. Active work and stale confirmations block deletion.
- After approving the current final video, choose another candidate premise to create a separate project with the same source, content direction, duration and candidate evaluations. Keep the finished story, assets and video unchanged; repeated clicks open the existing new project.
- Preserve the selected production mode and existing quality gates. Include Vietnamese controls and help. Install locally; not published to GitHub.

## 3.1.16 — 2026-10-03 (local only)

- Ignore Gemini's internal offscreen Quill clipboard when finding the prompt editor. Capture its full-resolution PNG download from the provider's sandbox message instead of saving a preview or leaving the file outside the project folder.
- Read Flow's selected model from its visible caption even when its accessible label is generic. Verify Omni 1.1 Flash, Video / Ingredients, 16:9, 720p, 10 seconds and x1 before Send.
- Preserve the media resume stage while the app is offline. Recover an exact completed download when its ID was not saved, and retry an interrupted/missing download of the existing result without regenerating it.
- Remember the Flow project URL during setup and reopen a closed unsent tab only after checking its backend claim. Already-sent jobs never reopen generation or send again.
- Validate actual downloads and imports using two Enzo/Friendly TTS clips plus a confirmed visual batch of one thumbnail, one scene image and two videos. Include Browser Bridge 1.1.14. Preserve other features/settings; not published to GitHub.

## 3.1.15 — 2026-10-03 (local only)

- Fix AI Studio's Enzo voice picker staying open and Friendly style being repeatedly selected because its accessible name remains Style. Verify the selected voice and close the actual picker before filling narration.
- Remember the exact prompt prepared by Bridge for each media tab across worker/extension restarts. Replace only that original prompt when moving to the next scene; preserve user edits.
- Reconnect the content listener before downloading an existing output after extension reload. Explicitly resuming an interrupted download retrieves the existing result without generating again; keep completed and in-progress downloads intact.
- Explain Comet's per-file Save As preference and the Downloads setting needed for unattended downloads. Include Browser Bridge 1.1.13. Preserve all other features/settings; not published to GitHub.

## 3.1.14 — 2026-10-03 (local only)

- Recover unescaped quoted dialogue and literal line breaks inside otherwise complete AI JSON strings without changing evidence, issues, severity or references. Continue rejecting missing separators, incomplete structure and ambiguous quoting; keep existing schema and draft/attempt checks.
- Use the same reader for manual paste and Bridge results. Bridge 1.1.12 prefers the provider's raw Copy source and asks the app for read-only syntax recovery only when normal JSON parsing fails. Valid JSON takes the existing fast path; successful recovery never resends the prompt.
- Clarify JSON escaping in the Gemini story audit prompt. Preserve all other features/settings and render optimizations. Local installer and extension only; not published to GitHub.

## 3.1.13 — 2026-10-03 (local only)

- Reuse validated narration, audio mixes, composed timelines and lossless keyed waveform cycles. Rebuild only stages affected by source, timing, format or audio-gain changes; keep previous completed outputs intact.
- Use a pinned, separately bundled FFmpeg compatibility renderer when it restores working NVIDIA encoding on the installed driver. Preserve explicit FFmpeg paths and CPU mode, and retain hardware/CPU fallback.
- Accelerate waveform/logo composition with CUDA where available, encode scene groups with NVENC, and join compatible cuts by packet copy. Retain bounded transition graphs, original video anchors/durations, image motion, captions and exact logo/waveform canvas.
- Add cache invalidation/recovery, GPU fallback and real pixel/timing regression coverage, plus stage timings in render diagnostics. Successful attempts prune only obsolete, marked cache entries.
- Keep all other features/settings and Browser Bridge 1.1.11 unchanged. Installer built locally; not published to GitHub.

## 3.1.12 — 2026-10-03 (local only)

- Add sequential resource generation/download through Browser Bridge 1.1.11, with one reusable AI Studio, Gemini and Flow tab. Wait for page load and stable controls before filling or submitting.
- Start missing narration immediately with AI Studio Create new dialog, Enzo and Friendly. Download tts_001.wav, etc. into Downloads/<project title> and attach each completed file to its exact chunk.
- Require explicit confirmation of the current image/video plan counts before creating any visual resource. Create the thumbnail first, then scene_001.png/mp4, etc. in order. Verify Flow Video / Ingredients / 16:9 / Omni 1.1 Flash / 720p / 10 seconds / x1, without silently selecting another model.
- Add the Bridge downloads permission, track completed download IDs and use saveAs:false to avoid per-file pickers. Keep existing resources by default; allow regeneration and stopping a batch. Recovery never resubmits an uncertain generation.
- Preserve manual workflows, native CapCut export, rendering and other settings. No GitHub publication in this update.

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
