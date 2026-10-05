# Hướng dẫn StoryForge US

Từ **3.1.14**, app có thể xử lý dấu ngoặc kép chưa escape trong lời thoại trích dẫn của JSON kiểm định, giữ nguyên nội dung và mức độ từng lỗi. Dán lại toàn bộ câu trả lời vào tác vụ đang chờ; không cần tạo lại kiểm định nếu bản nháp chưa đổi. Để Bridge tự lấy kết quả theo cách này, cài app mới và Reload extension **1.1.12** tại trang Extensions của trình duyệt. JSON bị cắt dở, thiếu dấu phân cách hoặc trường bắt buộc vẫn bị từ chối để tránh mất dữ liệu.

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

Trong Settings → General, **Manual** chạy một bước mỗi lần bấm; **Assisted** dừng thêm sau outline đã chỉnh và draft để bạn xem trước; **Auto** nối các bước đến checkpoint chọn ý tưởng hoặc xác nhận số lượng ảnh/video. Mặc định là Assisted. Số premise mặc định áp dụng cho pipeline và có thể đổi riêng ở tab Premises.

1. Direction → Premises → mini-test Top 3.
2. Bạn chọn một premise; premise vượt ngưỡng similarity/duration risk bị chặn.
3. Bible → Outline → Outline audit → targeted outline revision → ba phương án mở đầu → Full draft.
4. Gemini audit → ChatGPT cross-review và independent sweep → resolver nếu cần.
5. Targeted rewrite sửa exact affected text; tối đa ba lần.
6. Kiểm tra nhịp giữ người xem và sự khớp giữa truyện với tiêu đề/thumbnail; sửa đoạn cụ thể nếu cần. Gemini và ChatGPT xác minh độc lập bản hiện tại. Dự án cũ chưa có kiểm tra mới được ghi là Chưa đánh giá.
7. Khi kiểm định bản hiện tại đạt đầy đủ, app **tự khóa truyện** và chia đoạn TTS. Ở chế độ Browser Bridge, giọng đọc được tạo ngay; bạn chọn và xác nhận số lượng ảnh/video trong lúc chờ. Xem [hướng dẫn bản 3.1.20](docs/YOUTUBE_PREPARATION_3.1.20.md) về kiểm định giữ người xem, hàng đợi và báo cáo tài nguyên còn thiếu.

Issue cần evidence, location, repair requirement. Bấm issue ID để xem Bible references và nhận xét ngắn của từng model. UNCERTAIN sau resolver cần human review. Không hiển thị hidden chain-of-thought.

Sửa draft tạo version mới và mở khóa. Cần kiểm định lại; TTS/scenes thay đổi được đánh dấu STALE. Các chunk có text giống hệt có thể tái dùng audio sau khi rebuild chunking. Thời gian cảnh/phụ đề cần sync lại.

## 5. Browser Bridge

1. Trong Start Menu mở **Install or Reload Browser Bridge**, hoặc tìm thư mục `browser-extension` trong bản source/portable (bản nội bộ cũng có tại `_internal/browser-extension`).
2. Mở `edge://extensions` / `chrome://extensions`, bật Developer mode, Load unpacked.
3. Settings → Browser Bridge → Generate pairing key; paste vào popup extension và Pair.
4. Settings → General → đổi provider mode sang Browser Bridge.
5. Đăng nhập vào các provider bằng browser thông thường.
6. Chạy một workflow step. Job sẽ waiting_user. Trong extension: chọn job, Open tab, Fill, kiểm tra prompt, Send/Run, Wait/Capture.

Nếu selector không còn đúng: dùng Copy prompt, mở provider, paste result JSON trong Activity & jobs. Các nút tạo/import tài nguyên thủ công vẫn dùng được. Từ bản 3.1.12, dùng Bridge 1.1.11 để tự tạo, tải và gán tài nguyên theo hướng dẫn bên dưới. Khi cập nhật Bridge, Reload tiện ích trong trang Extensions; chấp thuận quyền tải xuống nếu trình duyệt yêu cầu.

Không bypass đăng nhập, CAPTCHA, quota hay paywall. Đóng popup trong lúc Wait có thể mất thông báo; job vẫn tồn tại và có thể Capture lại. Trang AI thực có thể yêu cầu bạn mở đúng chế độ sinh ảnh, speech hay video trước khi Fill.

## 6. TTS, hình ảnh và tài nguyên

### Tự động tạo và tải tài nguyên (3.1.12)

- Mở app và Bridge đã ghép nối, bật chế độ tự động của Bridge và đăng nhập AI Studio, Gemini, Flow bằng trình duyệt thông thường. Bridge cần quyền **Downloads / Tải xuống**; bản Bridge cũ chưa tự tải media.
- Trong Comet, mở **Settings → Downloads** và tắt **Ask where to save each file before downloading** (Hỏi nơi lưu từng file). Khi bật tùy chọn này, Comet có thể vẫn hiện Save As dù Bridge yêu cầu tải tự động. Thiết lập này áp dụng cho các lượt tải của trình duyệt.
- Nếu đã hủy hộp thoại lưu, tắt tùy chọn trên rồi bấm **Tiếp tục tải tài nguyên** trong popup Bridge. Bridge tải lại kết quả có sẵn; không tạo lại âm thanh/ảnh/video.
- Trong **Xưởng giọng đọc**, sau khi đã khóa truyện và chia đoạn, bấm **Tạo và tải giọng đọc**. Không cần xác nhận số lượng âm thanh. Bridge chờ AI Studio tải xong, mở Create new dialog, chọn **Enzo / Friendly**, tạo từng đoạn và tải `tts_001.wav`, `tts_002.wav`... Dùng lại một tab, chỉ thay phần lời kể do Bridge nhập.
- Trong **Đạo diễn hình ảnh**, chọn số lượng ảnh/video và tạo kế hoạch cảnh trước. Bấm **Xem và xác nhận số ảnh/video**, xem số lượng cuối cùng rồi bấm **Xác nhận số lượng và tạo tài nguyên**. Chưa xác nhận thì không tạo cả thumbnail lẫn scene. Sau xác nhận, Bridge tạo thumbnail trước, tiếp tục các scene theo thứ tự, dùng một tab Gemini và một tab Flow.
- Cài đặt Flow: **Video / Thành phần / 16:9 / Omni 1.1 Flash / 720p / 10 giây / x1**. Flow trừ tín dụng theo mức đang hiển thị trên trang. Nếu không tìm được model/cài đặt hoặc xuất hiện CAPTCHA/đăng nhập, Bridge tạm dừng để bạn xử lý.
- File tải vào **Downloads / tên dự án**, với tên `thumbnail.png`, `scene_001.png`, `scene_002.mp4`... Sau khi trình duyệt báo tải hoàn tất, app kiểm tra file và tự gán đúng đoạn/cảnh; mới chuyển sang mục tiếp theo. App lưu một bản media riêng trong dữ liệu dự án để dùng cho timeline và CapCut.
- Mặc định bỏ qua file đã gán còn hợp lệ. Muốn làm lại, chọn **Tạo lại cả tài nguyên đã gán** trước khi bắt đầu. File trùng tên trong Downloads được thêm số `(1)`, `(2)` để giữ bản trước.
- Có thể **Dừng tự động tạo tài nguyên** để ngừng hàng đợi. Những file đã hoàn tất vẫn được giữ. Khi tạm dừng do kết nối/giao diện, kiểm tra tab rồi dùng **Tiếp tục** trong popup Bridge. Yêu cầu đã gửi không được gửi lại để tránh tạo trùng/tốn tín dụng. Không đóng app hoặc các tab đang tạo tài nguyên.

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

**Render & QA → Preflight → Render first cut**. Thiếu narration, file không hợp lệ hoặc thiếu hình sẽ chặn mặc định. Có thể bật placeholder fallback trong Settings; báo cáo khi đó NEEDS REVIEW. Scene video giữ vị trí bắt đầu và độ dài thực; scene ảnh điều chỉnh theo âm thanh và thumbnail cuối phủ phần thời gian còn thiếu.

Render gồm ảnh pan/zoom, crossfade, video, narration chuẩn hóa 48 kHz stereo, music/ambient ducking và SFX. Khi chọn **Thêm phụ đề**, chữ hiển thị trực tiếp trên hình, kèm subtitle track trong MP4 và file phụ đề riêng. **Sóng nhạc** thay phụ đề bằng video nền xanh đã tách nền và lặp đúng tốc độ. Logo PNG nằm trên cùng; kích thước và vị trí lớp phủ giữ nguyên.

Từ **3.1.13**, chế độ render tự động kiểm tra bộ mã hóa thật trên máy, dùng bản FFmpeg tương thích kèm theo nếu giúp NVIDIA hoạt động, và chuyển về CPU khi cần. Nền xanh được xử lý một lần; máy hỗ trợ CUDA dùng GPU ghép sóng nhạc và logo. Không cần đổi driver hoặc thay các thiết lập hiện có. Đường dẫn FFmpeg tự cấu hình và lựa chọn CPU vẫn được giữ nguyên.

App lưu cache cho scene, timeline, narration, âm thanh đã trộn và một chu kỳ sóng nhạc. Dựng lại sau khi đổi logo/phụ đề sẽ tái sử dụng phần còn phù hợp; thay tài nguyên, timing hoặc âm lượng sẽ làm lại đúng phần bị ảnh hưởng. Cache nằm trong thư mục dữ liệu dự án, cần thêm dung lượng đĩa. Sau lần dựng thành công, app dọn các cache cũ do phiên bản này tạo và không còn dùng; tài nguyên gốc và video đã hoàn thành được giữ lại. Báo cáo render ghi thời gian từng bước và số mục tái sử dụng. Xem kết quả đo và giới hạn ở `docs/RENDER_PERFORMANCE_3.1.13.md`.

Kiểm tra cuối gồm duration, resolution, FPS, audio, subtitle, scene coverage, thumbnail prompt và khoảng lặng narration. Video thử được đánh dấu synthetic. Luôn xem video và tick xác nhận review trước khi xuất bản.

## 8. Publish, analytics, backup

Từ **3.1.22**, Kiểm định giữ người xem nhận nội dung gốc của từng khoảng thời gian để tránh gán nhầm trích dẫn. App đối chiếu bằng số từ/WPM, chấp nhận câu qua ranh giới với dung sai tối đa 15 giây. Khác biệt xuống dòng và dấu ngoặc kép khi sao chép được nhận diện, nhưng app vẫn lưu trích dẫn đúng từ bản gốc; không nhận từ bị đổi, bỏ hoặc đảo thứ tự. Nếu trích dẫn sai mốc hoặc khác nội dung gốc, Browser Bridge **1.1.26** tự yêu cầu đánh giá lại trong giới hạn ba lần thử của tác vụ. App vẫn không nhận kết quả đạt nếu bằng chứng sai hoặc các kiểm định cần thiết chưa hoàn tất. Sau khi cập nhật, Reload tiện ích để áp dụng cơ chế này.

Upload YouTube thủ công. Lưu URL, ngày đăng, title, description, thumbnail concept, tags và final duration ở Publish. Nhập snapshot analytics theo ngày; cùng project/ngày cập nhật snapshot, không cộng dồn các snapshot cũ. Sample size và evidence level luôn hiển thị.

Publish cung cấp project ZIP, ZIP gồm media và **Xuất project CapCut**. Chọn Xuất project CapCut, kiểm tra thư mục dự án (CapCut Settings → Draft location), rồi bấm xuất. Tool sao chép tài nguyên đã gán vào một project mới, sắp xếp scene và âm thanh theo timeline, thêm phụ đề/sóng nhạc/logo theo tùy chọn hiện tại. Mở project này trong CapCut Home (khởi động lại CapCut nếu chưa thấy), rồi bấm Export. Đã kiểm tra trên CapCut International 9.5 Windows. Project dùng bản sao media riêng, vì vậy cần giữ toàn bộ thư mục project; mỗi lần xuất tạo bản mới, không ghi đè project đã chỉnh sửa. Không cần dựng video trước trong StoryForge. Settings → Backup & storage hỗ trợ database backup/restore và đổi data root. Restore áp dụng ở lần khởi động sau, tự backup database hiện tại. Media không nằm trong database backup.

Đổi data root: copy sang folder trống, giữ nguyên bản cũ, rồi restart ngay. Stop StoryForge dùng helper trong Start Menu. Logs có file riêng và xuất diagnostics ZIP.
