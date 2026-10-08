## v3.1.27 — Thư mục theo tên truyện, dọn tài nguyên và nhịp mở đầu

- Đặt tên thư mục Projects theo tên truyện tiếng Anh, giữ ID và liên kết dự án. Tự chuyển thư mục cũ cùng đường dẫn media/báo cáo; khôi phục tên thư mục dự án đã xóa từ bản sao lưu khi có. Không sao chép hoặc mã hóa lại video. Tên trùng được thêm mã phân biệt; tên làm việc chưa có tiêu đề tiếng Anh dùng `Story Project` tạm thời.
- Thêm **Xóa dữ liệu Tài Nguyên** ở Tổng quan: xem trước số file/dung lượng, xác nhận rồi dọn media, cache render, gói xuất và bản sao Downloads/CapCut đã được xác minh thuộc dự án. Giữ video final hiện tại, hồ sơ truyện, bản nháp, lịch sử ý tưởng và thông tin xuất bản. File dùng chung, liên kết ổ đĩa và bản gốc chưa được ghi nhận được giữ lại.
- Chặn dọn hoặc đổi tên khi dự án đang chạy. Báo file bị khóa để dọn lại; phục hồi đường dẫn khi quá trình đổi thư mục hoặc chuyển final bị gián đoạn. Sau khi dọn, vẫn tải final và chọn ý tưởng khác được; cần bấm **Tạo lại tài nguyên** trước khi dựng/xuất CapCut tiếp.

- Bổ sung Bridge **1.1.28**: nhập bằng Copy/Paste thật qua clipboard ở ChatGPT, Gemini, Flow và Google AI Studio. Kiểm tra đủ nội dung, giữ bản nháp của người dùng, thay đúng prompt scene trước và không gửi lặp. Nếu ChatGPT chuyển văn bản dán thành tệp, chờ xử lý xong và thêm câu lệnh ngắn trước khi gửi; tệp lỗi/bị gỡ hoặc clipboard thay đổi thì dừng để kiểm tra. Cần Reload Bridge để áp dụng quyền clipboard mới.
- Đưa hook/câu hỏi/nghịch lý vào 0–10 giây và xung đột/hệ quả vào 10–30 giây, kịch tính hóa vừa phải bằng hành động và lựa chọn có cơ sở. Đặt cao trào chính và plot twist khoảng 45–55%; phần sau giải thích nguyên nhân, hệ quả và kết thúc, có thể kết mở hợp lý.
- Đồng bộ hướng dẫn ở Ý tưởng, Hồ sơ, Dàn ý, mở đầu, Bản nháp và kiểm định giữ người xem. Kiểm định nhận đoạn giữa/cuối từ đúng bản nháp, dùng thời gian ước lượng từ số từ/WPM. Không tự viết lại truyện cũ hoặc bảo đảm hiệu quả giữ chân người xem.
- Kế hoạch hình ảnh mới dành 2–3 video ở chế độ chuẩn, đặt các clip 10 giây liên tiếp ngay từ 0:00. Giữ chính xác số lượng tùy chỉnh; video bổ sung nằm phía sau. Ảnh phủ phần còn lại, gồm cao trào và kết thúc. Đồng bộ âm thanh thật giữ các clip mở đầu nối tiếp và xử lý ranh giới từ không trùng chính xác 10 giây.
- Tạo một ảnh tham chiếu nhân vật chính trước các clip khi chưa có tham chiếu hợp lệ; dùng chung cho Gemini/Flow và giữ ngoài timeline. Tiếp tục dùng cùng chat/project và khuôn mặt, ngoại hình, trang phục chuẩn. Tham chiếu lỗi được báo ở Tài nguyên, không nhận nhầm file hay tự gửi lặp lại.
- Giữ nguyên tài nguyên/timeline đã tạo, cài đặt render và các điểm xác nhận; dọn media chỉ thực hiện khi người dùng xác nhận thao tác mới.

## v3.1.26 — Nhập Hồ sơ truyện và ưu tiên Ý tưởng 1 (local)

- Thêm “Đã có Hồ sơ truyện” khi tạo dự án. Khóa hai bước Định hướng/Ý tưởng, nhập JSON bằng nội dung dán hoặc file, kiểm tra và lưu hồ sơ rồi tiếp tục từ Dàn ý.
- Kiểm tra summary, characters có tên và world_rules; giữ trường bổ sung, không ghi đè hồ sơ cũ khi nhập lỗi. Lưu từng bản nhập và dấu SHA256. Hồ sơ đã chạy Dàn ý không được thay thế âm thầm bằng lần nhập khác.
- Ý tưởng 1 cố định là biến thể bám sát DNA nguồn; nếu không có nguồn thì là ý tưởng gốc theo kênh. Trích source_core, mô tả phần giữ/chuyển đổi, tách độ bám sát DNA khỏi rủi ro sao chép cách thể hiện. Tạo lại riêng Ý tưởng 1 tối đa hai lần khi các tiêu chí chưa đạt; giữ nguyên các ý tưởng còn lại.
- Chế độ Tự động có kiểm duyệt luôn chọn Ý tưởng 1 sau thử nghiệm, kể cả khi ý tưởng khác có tổng điểm cao hơn. Dừng để người dùng duyệt Khóa truyện, chốt số lượng ảnh/video và bắt đầu dựng bản đầu tiên. Sau duyệt Khóa truyện, TTS chạy độc lập trong lúc chờ chốt hình ảnh. Vẫn cần xem và xác nhận video cuối.
- Giữ luồng Thủ công/Có hỗ trợ và các tính năng tài nguyên, Bridge, render, thumbnail, metadata hiện có. Cập nhật local; chưa đẩy GitHub.

# Changelog

## 3.1.25 — 2026-10-07 (local only)

- Replace generic SEO metadata with story packaging: extract concrete anchors and anomalies from the Bible, outline and current draft; generate three title strategies with exact supporting quotes and an optional genre suffix.
- Add a primary semantic keyword cluster, usually 4–8 tags and 2–3 hashtags, natural spoiler-light descriptions and configurable channel fiction disclosure. Preserve platform limits and reject positive true-event claims for fiction.
- Store optional channel traffic percentages and attributed keyword evidence; reuse them across projects. Keep missing data unknown and distinguish story/editorial inference from creator-supplied research.
- Show editorial scores, recommendation notes and thumbnail word-overlap risk without claiming CTR or retention predictions. Let the user choose a variant before applying metadata to the publishing form; extend TXT exports while retaining legacy fields.
- Add three story-grounded thumbnail concepts: a concrete anomaly, human stakes and setting/atmosphere, with evidence-based alternatives when needed. Default to one selected image; optionally generate A/B/C sequentially in the existing Gemini project conversation.
- Make thumbnail overlay text optional or a short 1–4-word headline. Reuse optional channel treatment, retain the existing 2–3-font/two-accent preferences and store attributed research observations without claiming causal performance.
- Show actual 320 × 180 image previews and file/dimension checks separately from editorial concept scores. Bind creator image reviews to the exact asset and plan; use confirmed visual concepts for semantic title/image pairing without substituting lexical overlap for quality.
- Export thumbnail concepts, evidence and image reviews for manual YouTube Studio testing. Preserve earlier thumbnails and report missing A/B/C variants independently; keep the existing narration queue, scene count confirmation and rendering behavior.
- Preserve story content, render settings, resource automation and Bridge 1.1.27. Existing metadata can be regenerated with the new contract. No GitHub publication.

## 3.1.24 — 2026-10-06 (local only)

- Keep project-scoped Gemini chats, AI Studio dialogs and Flow projects through failed scenes and browser restarts; restore recorded pages and narration settings without resending a failed prompt. Save session URLs and owned prompt evidence locally; report missing resources when a session cannot be recovered.
- Attach consistent character references to Gemini/Flow scene prompts. Default to the first verified scene image, allow up to three optional image references and preserve a fixed reference snapshot for each request. Scope Gemini downloads to the submitted scene prompt and wait for old results and reference uploads to settle.
- Save final_video.mp4 directly to the project's Downloads folder, reuse its existing media folder and avoid overwriting previous downloads. Preserve playback and other output downloads. Include Browser Bridge 1.1.27.
- Preserve idea usage after deleting a derived project; block reuse of deleted used ideas and protect the shared original pool from individual/bulk project deletion.
- Mark projects developed from a selected idea, link back to the original pool and open an existing derived project from a used idea. Backfill history for existing projects without changing their stories/settings.

- Mark selected and previously used ideas in the original pool and prevent selecting them again.
- Create a separate project containing only the chosen idea, preserving its channel, source and content direction; start directly at Story Bible.
- Skip premise regeneration once an idea is selected, including pipeline continuation; supersede legacy paused generation when branching from an approved finished project.
- Preserve the finished project, video and all other features/settings. Not published to GitHub.

## 3.1.23 — 2026-10-05 (local only)

- Give AI thumbnails a story-grounded curiosity headline, one clear visual clue, 2–3 complementary typefaces and two contrasting text/accent colors. Adapt atmosphere to the channel and content direction, preserve the published title and avoid revealing the ending or inventing a viewer promise.
- Make scene-image prompts photographic and grounded in the scene's actual light, weather, materials and character continuity. Apply the same image direction when copying a prompt, queueing one image or running automatic media generation, including existing visual plans.
- Preserve scene counts, word ranges, audio/video timing, Flow prompts, attached resources, local thumbnail composition and all other features/settings. Include Browser Bridge 1.1.26. Not published to GitHub.

## 3.1.22 — 2026-10-05

- Complete the retention fix after testing a real Gemini reassessment. Accept only display-format differences in whitespace, double-quote delimiters and straight/curly apostrophes; retain the exact original source passage and its word/WPM timing in the saved audit.
- Keep changed words, contractions, order, ellipses and misplaced evidence rejected. Let the existing bounded corrective retry handle an evidence quotation that genuinely differs from the current draft, including pending legacy pauses.
- Include Browser Bridge 1.1.26. Preserve all other features, settings and project data.

## 3.1.21 — 2026-10-05

- Match retention evidence against the same word/WPM clock used for narration estimates. Include exact text for every time zone, support quotations crossing a boundary or repeated in the draft, and bound adjacent context to 15 seconds independently of word length.
- Send only the current draft, selected packaging and relevant channel context for retention assessments. Exclude old drafts and source transcripts; require Gemini to assess the supplied passage for each time zone.
- Report the rejected zone, measured quote times and quote excerpt. Automatically request a corrected retention assessment after a verified current rejection, within the existing three-retry budget and ownership/attempt guards. Keep independent quality checks and reject false passes.
- Include Browser Bridge 1.1.25, which resumes an existing legacy retention pause by reading its already-sent answer before requesting any correction. Preserve other features and settings.

## 3.1.20 — 2026-10-05 (local only)

- Add genre-aware title/thumbnail promises, three opening variants, timed retention evidence and targeted repairs. Keep story integrity, retention readiness and packaging alignment separate; prior projects without these assessments remain usable.
- Store optional observed YouTube metrics, actual packaging versions and units. Add dismissible in-app 7/28-day reminders, comparable channel medians and conservative pattern learning without requiring metrics or changing channel DNA.
- Automatically lock a story when its current required verifications pass and start narration production in Browser Bridge mode. Preserve final video viewing approval and unresolved human review requirements.
- Allow visual count review and replacement plans during automatic TTS. Persist the latest approved plan, run it after narration, and require explicit image/video count confirmation before generating visual resources.
- Skip an owned media item on browser/setup/generation/download failure; continue the batch, reject late results and show missing filenames/reasons in Assets. Detect lost Bridge heartbeats and keep unclaimed queues waiting. Preserve complete-WAV checks and reusable provider tabs.
- Include Browser Bridge 1.1.24, schema migration preserving existing rows/settings, Vietnamese controls and versioned local installer/source/portable archives. Not published to GitHub.

## 3.1.19 — 2026-10-04 (local only)

- Download AI Studio's complete WAV through its Download button and capture the assembled file instead of an individual streaming preview packet. Wait for a stable visible total-time counter and check it against the downloaded file when available.
- Capture AI Studio's observed sandbox download even when its WAV Blob has no MIME type. Preserve all bytes, and keep any large base64 download data out of extension storage by passing a page-owned blob URL.
- Keep compact, cached identities for prior AI Studio audio and identify new results by their authorized job and unchanged editor. Full base64 WAVs remain in the provider page so the next narration scene cannot overflow Bridge storage.
- Reject implausibly short narration or a WAV whose duration disagrees with AI Studio before assigning it or advancing the queue. Continue retries downloading the existing result without another Run; a new narration batch regenerates invalid existing clips and keeps valid assignments.
- Match the content-script version to the installed Bridge so provider tabs receive the updated adapter after extension reload. Include Browser Bridge 1.1.23. Preserve other features and settings; not published to GitHub.

## 3.1.18 — 2026-10-04 (local only)

- Leave Flow's owned clip editor with Xong / Done and wait for the project grid before downloading. Do not wait for a VIDEO element in its canvas player or mistake the editor timeline for a running generation.
- Persist the selected result across worker/content reloads, scope Download / More options to that result, and defer capture while the editor is closing. Resume existing results without sending another generation request.
- Reserve at least 10 seconds of corresponding narration for each new video scene. Rebalance contiguous word ranges using WPM initially and measured audio at the first sync, including the native duration of an assigned video. Images absorb the remaining time; reject insufficient narration without trimming/looping video or moving synced video starts. Exclude the separate outro from the story's video budget.
- Include Browser Bridge 1.1.15. Preserve other features and settings; not published to GitHub.

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
