# Hướng dẫn StoryForge US

## 1. Bắt đầu

Mở **Start StoryForge**. Ứng dụng mở browser local ở cổng 8787. Có thể làm việc offline trong **Mock provider**. Bấm **New channel**, đặt tên, audience, ngôn ngữ và độ dài mặc định. Chọn **I know my niche** hoặc **Help me discover it**.

**Load demo workspace** tạo ba kênh mẫu có nhãn DEMO, nguồn tự viết và project mẫu. Mock là dữ liệu kiểm thử tổng hợp, không phải nội dung AI chất lượng xuất bản; không tạo số liệu YouTube giả.

## 2. Channel DNA và Discovery

Trong channel, mở **Channel DNA → Edit JSON** để sửa thể loại, trope, giọng kể, audience, avoid patterns và content mix. Mọi thay đổi tạo version. **Versions** so sánh current/saved DNA và có Accept / Test first / Reject.

Thêm và gán nguồn cho channel trong Content inbox. **Discovery → Generate hypotheses** tạo clusters và 2–5 hướng niche. Điểm số là heuristic. Tạo test plan (mặc định 5 video, có thể đổi), nhập số liệu quan sát sau khi đăng. Chỉ khi bạn bấm **Establish this DNA** thì channel được thiết lập.

## 3. Nguồn và dự án

**Add source** nhận URL, transcript, summary/notes và tags. App không tự scrape URL. Nếu chỉ có link, hãy dán summary/transcript trước khi Analyze. Có thể import TXT, MD hoặc CSV UTF-8; header CSV gồm `title,url,transcript,summary,notes,tags,language,channel_id`.

**Analyze Story DNA** phân tích motif trừu tượng. **Channel fit** so sánh heuristic với DNA, lịch sử và lịch nội dung. Có thể assign channel, giữ trong inbox hoặc tạo các adaptation riêng cho nhiều kênh.

Từ bản **3.1.10**, trong **Tư liệu nguồn**, bấm **Tiếng Việt** để xem bản dịch riêng của nguồn tiếng Anh hoặc tiếng Trung. Bản dịch chỉ để đọc; **Sửa JSON**, phân tích DNA và tạo bản chuyển thể luôn dùng nội dung gốc. Bấm **Bản gốc** để ẩn phần dịch. Bộ dịch chạy trong Comet/Chrome hỗ trợ Translator API; lần đầu có thể cần tải bộ dịch. Chỉ dịch các đoạn đang xem và lưu bản dịch trong trình duyệt để dùng lại, không tạo tác vụ AI. Nếu dịch chưa khả dụng, nội dung gốc và các thao tác vẫn dùng bình thường.

**New project** gồm chọn channel/source → chọn Auto/5/10/20/30/45/60/Custom → xác nhận. Mỗi project bắt buộc thuộc một channel. Mặc định 150 WPM; word range, số nhân vật/cảnh, subplot và twist thay đổi theo thời lượng.

## 4. Viết và kiểm định

**Continue pipeline** chạy các bước đủ điều kiện rồi dừng tại checkpoint. Có thể chạy từng bước ở tab tương ứng.

Trong Settings → General, **Manual** chạy một bước mỗi lần bấm; **Assisted** dừng thêm sau outline đã chỉnh và draft để bạn xem trước; **Auto** nối các bước đến checkpoint chọn premise hoặc duyệt Story Lock. Mặc định là Assisted. Số premise mặc định áp dụng cho pipeline và có thể đổi riêng ở tab Premises.

1. Direction → Premises → mini-test Top 3.
2. Bạn chọn một premise; premise vượt ngưỡng similarity/duration risk bị chặn.
3. Bible → Outline → Outline audit → targeted outline revision → Full draft.
4. Gemini audit → ChatGPT cross-review và independent sweep → resolver nếu cần.
5. Targeted rewrite sửa exact affected text; tối đa ba lần.
6. Gemini và ChatGPT xác minh độc lập bản hiện tại.
7. **Story lock → Approve Story Lock** khi mọi gate đạt yêu cầu.

Issue cần evidence, location, repair requirement. Bấm issue ID để xem Bible references và nhận xét ngắn của từng model. UNCERTAIN sau resolver cần human review. Không hiển thị hidden chain-of-thought.

Sửa draft tạo version mới và mở khóa. Cần kiểm định lại; TTS/scenes thay đổi được đánh dấu STALE. Các chunk có text giống hệt có thể tái dùng audio sau khi rebuild chunking. Thời gian cảnh/phụ đề cần sync lại.

## 5. Browser Bridge

1. Trong Start Menu mở **Install or Reload Browser Bridge**, hoặc tìm thư mục `browser-extension` trong bản source/portable (bản nội bộ cũng có tại `_internal/browser-extension`).
2. Mở `edge://extensions` / `chrome://extensions`, bật Developer mode, Load unpacked.
3. Settings → Browser Bridge → Generate pairing key; paste vào popup extension và Pair.
4. Settings → General → đổi provider mode sang Browser Bridge.
5. Đăng nhập vào các provider bằng browser thông thường.
6. Chạy một workflow step. Job sẽ waiting_user. Trong extension: chọn job, Open tab, Fill, kiểm tra prompt, Send/Run, Wait/Capture.

Nếu selector không còn đúng: dùng Copy prompt, mở provider, paste result JSON trong Activity & jobs. TTS và hình/video tải về thủ công rồi import Assets. Chọn giọng ở AI Studio và dùng nút Copy voice profile/Sample context; bridge chỉ điền phần narration vào ô text để không đọc phần context.

Không bypass đăng nhập, CAPTCHA, quota hay paywall. Đóng popup trong lúc Wait có thể mất thông báo; job vẫn tồn tại và có thể Capture lại. Trang AI thực có thể yêu cầu bạn mở đúng chế độ sinh ảnh, speech hay video trước khi Fill.

## 6. TTS, hình ảnh và tài nguyên

Sau Story Lock: **TTS studio → Build semantic chunks**. Chunker không cắt giữa câu, ưu tiên đoạn, kết thúc thoại, đổi thời gian/địa điểm. Mục tiêu khoảng 3 phút, hard max 4 phút. Một câu đơn lẻ dài quá giới hạn cần sửa thủ công.

**Visual director** tạo scene plan gắn với version, chủ yếu ảnh và một số cảnh video. Copy prompt/queue bridge, tải media rồi import. Asset naming:

```text
tts_001.wav
scene_001.png
scene_002.mp4
scene_002.png     # image fallback cho video ngắn
music_001.wav
ambient_001.wav
sfx_001.wav
```

Assets hỗ trợ drag/drop hoặc browse, bulk import, hash duplicate detection, preview và map thủ công. SFX có offset/volume. Tối đa hai background tracks music/ambient được mix trong bản này. Chọn filename rõ ràng để auto-map; nội dung giống hệt một asset cũ sẽ được nhận là duplicate, dùng Map để gán lại.

## 7. Timeline, render và QA

**Timeline → Sync to real audio** dùng ffprobe đọc WAV thực. Phụ đề SRT/VTT được chia theo câu và phân bổ trong chunk theo số từ. Đây không phải forced alignment; kiểm tra lại phụ đề khi giọng đọc có nhiều khoảng nghỉ.

**Render & QA → Preflight → Render first cut**. Thiếu narration, file không hợp lệ hoặc thiếu hình sẽ chặn mặc định. Có thể bật placeholder fallback trong Settings; báo cáo khi đó NEEDS REVIEW. Video ngắn dùng ảnh fallback cho phần còn lại.

Render gồm ảnh pan/zoom, crossfade, video, narration chuẩn hóa 48 kHz stereo, music/ambient ducking, SFX và subtitle track. Subtitles được mux dạng bật/tắt trong MP4 và xuất file riêng; chưa burn-in chữ vào hình.

Kiểm tra cuối gồm duration, resolution, FPS, audio, subtitle, scene coverage, thumbnail prompt và khoảng lặng narration. Video thử được đánh dấu synthetic. Luôn xem video và tick xác nhận review trước khi xuất bản.

## 8. Publish, analytics, backup

Upload YouTube thủ công. Lưu URL, ngày đăng, title, description, thumbnail concept, tags và final duration ở Publish. Nhập snapshot analytics theo ngày; cùng project/ngày cập nhật snapshot, không cộng dồn các snapshot cũ. Sample size và evidence level luôn hiển thị.

Publish cung cấp project ZIP, ZIP gồm media và CapCut handoff. Handoff gồm folder/media/timeline, không phải file project native CapCut. Settings → Backup & storage hỗ trợ database backup/restore và đổi data root. Restore áp dụng ở lần khởi động sau, tự backup database hiện tại. Media không nằm trong database backup.

Đổi data root: copy sang folder trống, giữ nguyên bản cũ, rồi restart ngay. Stop StoryForge dùng helper trong Start Menu. Logs có file riêng và xuất diagnostics ZIP.
