# Changelog

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
