# Changelog

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
