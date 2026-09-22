# Implementation scope and practical limits

Implemented as a runnable local application, with real persistence and FFmpeg output; the UI is not a static mockup.

## Covered workflows

- Multi-channel management, manual/versioned Channel DNA, discovery hypotheses/test plans and explicit establishment.
- Global source inbox/library, text/MD/CSV import, structured Story DNA and channel-fit heuristics.
- Duration-aware projects, content direction, premise diversity/scoring, Top 3 mini-tests and human selection.
- Story Bible, scene outline, outline audit/revision, narration editor.
- Gemini issue reports, per-claim ChatGPT verdicts and independent new issues, one-round disagreement resolver, human resolution, targeted replacement and independent final gates.
- Story version history and production invalidation; semantic TTS chunks and context; visual prompts and media workflows.
- Drag/drop upload, hash duplicates, auto/manual mapping, preview, ffprobe validation, exact chunk duration timeline, SRT/VTT, local MP4 render, technical QA.
- Persistent jobs, restart/resume, provider prompts and hashes, diagnostics, database backup/staged restore, channel/project/CapCut exports.
- Manual dated analytics, cautious observational summaries, calendar, within/across-channel novelty guards.
- Browser extension architecture, actual user-controlled fill/send/capture, explicit manual fallbacks, packaged Windows launcher and installer.

## Manual or limited in this release

1. Provider pages were not tested against authenticated live accounts in the build session. Selector maps are versioned but may require updates; copy/paste is the reliable fallback. No login/CAPTCHA/quota bypass exists.
2. Mock output is a deterministic synthetic test fixture. For long requested durations it repeats narrative fixture paragraphs; it is intentionally unsuitable for publication. It does not synthesize real narration or generate AI visuals.
3. TTS voice/sample-context fields are copied separately; the Bridge fills narration only. Generated media is downloaded and attached manually. Media bridge jobs can be completed with `{"manual_media_required":true}` after attaching results.
4. Local channel-fit, novelty and Auto-duration recommendations are transparent heuristics. There is no paid embedding service, semantic vector index or real YouTube demand model. Discovery/creative analysis in Browser mode depends on provider output.
5. Subtitle timing is sentence-weighted using real chunk durations, not word-level forced alignment. MP4 captions are selectable, not burned into frames.
6. Matching TTS text can reuse audio after edits. Visual-plan regeneration currently rebuilds all scene records; individual visual asset mapping is manual. Diff displays show side-by-side versions, not a token-highlighted diff.
7. Render progress is at stage/scene granularity. Cancel is observed between FFmpeg stages; the current subprocess can finish first. Resuming a render rebuilds that render job. Large 45–60 minute productions have not been benchmarked on multiple Windows hardware configurations.
8. Audio mixing uses up to two background tracks and up to 30 SFX. SFX offset/volume are adjustable; no waveform editor or native CapCut project generation is included.
9. Analytics are entered manually; no YouTube upload or account API is implemented. Suggestions do not automatically change DNA. Performance summaries currently emphasize content mix, retention and CTR; rich causal attribution is not claimed.
10. Source/job/project list APIs are paginated; some channel detail screens show the newest 100 associated records. A local pagination smoke test covers 20 channels, 1,000 sources and 500 projects. Full media-heavy library benchmarking across hardware has not been completed.
11. Database backups exclude media. Project exports include media optionally; a full general-purpose project-archive import UI is not included. Database restore plus the exported media folders can restore a workspace.
12. Data-root changes require an immediate restart and retain the original folder. The app targets a single local user. Generated installer/executable are unsigned. This build is not a claim that every optional/advanced detail in the master specification has been exhaustively validated.

## Verification evidence

See [VERIFICATION.md](VERIFICATION.md) for the executed test/build results and known unverified environments. A copy and machine-readable reports accompany the release artifacts. The smoke video contains labeled synthetic tones and original geometric images to test media handling without misrepresenting narration generation.
