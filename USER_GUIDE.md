## Luồng mới v3.1.26

**Dùng Hồ sơ truyện có sẵn:** Tạo dự án → Nguồn cảm hứng → Đã có Hồ sơ truyện → chọn thời lượng và tạo dự án. Ở Hồ sơ truyện bấm Nhập hồ sơ truyện, dán JSON hoặc chọn file .json. Có thể tải mẫu JSON và Kiểm tra JSON để xem trước. Hồ sơ cần summary, mảng characters có tên riêng và mảng world_rules; các trường khác được giữ nguyên. Bấm Lưu hồ sơ truyện, rồi Tiếp tục quy trình. Dàn ý và Bản nháp sử dụng đúng hồ sơ đã lưu; Định hướng và Ý tưởng truyện được bỏ qua. Muốn dùng hồ sơ khác sau khi đã tạo Dàn ý, hãy tạo dự án mới.

**Tự động có kiểm duyệt:** Chọn chế độ này trong Thiết lập → Chung. Tool tạo và thử nghiệm Ý tưởng 1, tự chọn nó, phát triển truyện rồi dừng ở Khóa truyện. Xem truyện và kết quả kiểm định, bấm duyệt Khóa truyện để bắt đầu chuẩn bị/tạo TTS. Trong lúc TTS chạy, chốt số lượng ảnh/video ở Đạo diễn hình ảnh; yêu cầu hình ảnh có thể xếp hàng sau TTS. Khi đủ tài nguyên và đã đồng bộ dòng thời gian, tool dừng ở Dựng bản đầu tiên để bạn kiểm tra cài đặt và bắt đầu dựng. Sau dựng vẫn cần xem và xác nhận video final.

**Ý tưởng 1:** Khi có nguồn, đây là biến thể giữ hook, cơ chế sợ/bí ẩn, nhịp khám phá và lời hứa cảm xúc của nguồn, nhưng phải thay đổi rõ nhân vật, bối cảnh cụ thể, cơ chế, trình tự, cao trào và kết thúc. Vị trí số 1 không phụ thuộc tổng điểm các ý tưởng khác. Tool kiểm tra các trường bắt buộc và ngưỡng điểm ước lượng; nếu chưa đạt thì tạo lại riêng số 1 tối đa hai lần. Lỗi chưa giải quyết được sẽ được báo để kiểm tra, không âm thầm chọn số 2. Các điểm này là tiêu chí AI ước lượng, không phải số liệu YouTube hay bảo đảm hiệu quả. Kênh khác thể loại kinh dị giữ đúng thể loại; dự án không có nguồn dùng Ý tưởng gốc ưu tiên theo DNA kênh.

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

- Bản local **3.1.24 / Bridge 1.1.27** lưu riêng chat Gemini, hộp thoại AI Studio và project Flow theo mã dự án. Khi scene lỗi, Bridge giữ đường dẫn phiên, chờ kết quả cũ ổn định rồi chạy scene tiếp theo. Nếu không khôi phục được phiên đã lưu, tài nguyên được báo thiếu để bạn tạo thủ công; không gửi trùng prompt đã gửi. AI Studio kiểm tra lại model **Gemini 3.8 Flash TTS / Enzo / Friendly**; hộp thoại chưa lưu có thể phải tạo lại sau khi tải lại trang.
- Trong **Đạo diễn hình ảnh → Ảnh nhân vật tham chiếu**, có thể chọn tối đa 3 ảnh đã nhập của dự án. Để trống để tự dùng ảnh scene đầu tiên hoàn thành. Bridge đính kèm cùng ảnh tham chiếu vào Gemini và Flow; có thể thay lựa chọn trong lúc TTS chạy, nhưng cần kết thúc hoặc dừng hàng đợi hình ảnh/video trước khi thay. Các nút mở dịch vụ sẽ mở đúng phiên đã lưu của dự án. Ảnh tham chiếu và mô tả nhân vật hỗ trợ sự đồng nhất; vẫn cần kiểm tra hình ảnh đầu ra.
- Trong **Dựng & kiểm tra**, bấm **final_video.mp4** để lưu trực tiếp vào thư mục dự án trong **Downloads**, cùng thư mục tài nguyên đã tải. App hiện đường dẫn khi lưu xong; các lần tải sau thêm `(1)`, `(2)` để giữ file cũ. Phần xem video và tải các file âm thanh/phụ đề khác giữ nguyên.
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


## Metadata YouTube theo nội dung truyện — v3.1.25

Ở bước **Xuất bản**, bấm **Tạo bằng ChatGPT** (hoặc **Tạo lại bằng ChatGPT** cho metadata đã có). Tool đọc bản thảo, Hồ sơ truyện, dàn ý và kênh hiện tại; không thay đổi truyện.

Kết quả gồm 3 chiến lược: A — sự bất thường cụ thể, B — bối cảnh/tìm kiếm, C — ngôi thứ nhất/tò mò. Mỗi tiêu đề có trích dẫn hỗ trợ và điểm biên tập 0–100. Điểm chất lượng càng cao càng tốt; điểm rủi ro càng thấp càng tốt. Đây là giả thuyết để thử nghiệm, không phải dự đoán CTR, giữ người xem hoặc lượt xem. Tiêu đề không tự thêm hậu tố thể loại.

**Dữ liệu cho chiến lược metadata (không bắt buộc)** cho phép lưu tỷ lệ Đề xuất/Duyệt xem/Tìm kiếm và tư liệu từ khóa theo kênh để các dự án sau dùng lại. Để trống số liệu chưa có; 0 là số liệu đo được bằng 0. Tư liệu quan sát cần nguồn thực tế hoặc mục Analytics. Tool không tự xác minh nhu cầu tìm kiếm từ tư liệu do người dùng nhập. Thiếu dữ liệu vẫn tạo được metadata theo ngữ nghĩa câu chuyện.

Nhập **Chữ thực tế trên thumbnail** nếu ảnh tải lên/tạo bằng AI có chữ. Chỉ áp dụng cho dự án, ảnh đang chọn và phiên bản truyện này. Tool không đọc chữ từ ảnh hoặc suy đoán chữ từ prompt. Khi chưa xác nhận ảnh thực tế, phần trùng chữ chỉ là phép so sánh từ. Sau khi kiểm tra ảnh ở **Đạo diễn hình ảnh**, metadata có thể đánh giá sự bổ trợ của tiêu đề với ý tưởng ảnh đã xác nhận; điểm này vẫn là ước lượng biên tập, được hiển thị riêng với tỷ lệ từ trùng nhau.

Thông báo truyện hư cấu mặc định bật và có thể tùy chỉnh theo kênh. Tắt đoạn thông báo không cho phép metadata gọi truyện hư cấu là sự kiện có thật.

Bấm **Chọn tiêu đề A/B/C**, sau đó **Dùng cho biểu mẫu xuất bản** và xác nhận để áp dụng. Các cài đặt xuất bản khác giữ nguyên. **Tải TXT ChatGPT** gồm trường sẵn sàng sao chép, cả 3 chiến lược và ghi chú. Hashtags được trình bày riêng để sao chép khi cần. Các mô tả cũ vẫn xem/xuất được; tạo lại để dùng cấu trúc mới. Dữ liệu truyện/kênh/thumbnail thay đổi sẽ yêu cầu tạo lại metadata.

YouTube có [thử nghiệm tiêu đề/thumbnail](https://support.google.com/youtube/answer/16391400) theo điều kiện tài khoản và video. StoryForge tạo phương án để bạn thử trong YouTube Studio; không tự chạy thử nghiệm hay xuất bản video.

## Ba phương án thumbnail theo truyện — v3.1.25

Trong **Đạo diễn hình ảnh**, phần **Ý tưởng thumbnail theo nội dung truyện** đọc truyện đã khóa, Hồ sơ truyện và dàn ý để tạo A — chi tiết bất thường cụ thể, B — tình huống của nhân vật, C — bối cảnh/không khí. B hoặc C có thể dùng bằng chứng khác nếu phù hợp hơn. Mỗi phương án có trích dẫn, bố cục, prompt, giải thích kết hợp với tiêu đề và điểm ý tưởng 0–100. Đây không phải kiểm định ảnh đã tạo hay dự đoán CTR.

Mặc định, hàng đợi tài nguyên tạo **một thumbnail** của phương án đã chọn/được đề xuất. Nếu chưa có ý tưởng hiện hành, ChatGPT tạo ba ý tưởng trước rồi hàng đợi tiếp tục với số scene đã xác nhận. TTS vẫn tạo theo luồng hiện có; tạo scene ảnh/video vẫn cần xác nhận số lượng. Thay đổi kế hoạch trong khi chờ ý tưởng sẽ yêu cầu xác nhận lại, không tự gửi prompt của kế hoạch cũ.

**Phong cách thumbnail của kênh (không bắt buộc)** cho phép chọn không có chữ, chữ ngắn 1–4 từ hoặc để nội dung quyết định. Mặc định giữ cách dùng 2–3 font và hai màu nhấn tương phản; có thể đổi sang một font đậm và màu theo ánh sáng/bối cảnh. Lưu lựa chọn trước khi tạo lại ý tưởng. Tư liệu nghiên cứu là tùy chọn: nhập nguồn thực tế, loại bằng chứng và ngày quan sát. Lượt xem công khai không chứng minh riêng thumbnail đã tạo ra kết quả.

Chọn **Tạo ảnh thumbnail đã chọn** hoặc **Tạo ảnh A/B/C**. **Tạo cả ba ảnh thumbnail** yêu cầu xác nhận dùng ba lượt tạo; Bridge làm lần lượt trong cùng cuộc trò chuyện Gemini của dự án. Các file `thumbnail_A.png`, `thumbnail_B.png`, `thumbnail_C.png` được tải vào thư mục Downloads của dự án, lưu bản riêng trong app và không tự đổi tiêu đề. Chỉ ảnh thuộc phương án đang chọn được gán làm thumbnail; chọn **Dùng ảnh B/C** để đổi. Ảnh cũ được giữ lại. Lỗi từng phương án được báo riêng trong **Tài nguyên**, kể cả khi đã có một thumbnail khác.

Bấm **Kiểm tra ảnh A/B/C** để xem ảnh gốc và bản nhỏ 320 × 180. Tool tự kiểm tra file, tỷ lệ 16:9 và tối thiểu 1280 × 720 cho so sánh thumbnail. Người dùng kiểm tra nội dung, chi tiết bất thường, khả năng nhìn trên điện thoại, chữ/nhãn và mức tiết lộ truyện; nhập đúng chữ thực tế nếu có. Có thể lưu kết quả chưa đạt để tạo lại ảnh. Tool chưa tự đọc chữ hoặc xác minh nội dung hình ảnh. Kết quả kiểm tra gắn với đúng file và kế hoạch, không chuyển sang ảnh khác.

**Xuất ý tưởng thumbnail và kế hoạch thử nghiệm** tải JSON gồm các phương án, nguồn nghiên cứu và kiểm tra ảnh. Thử nghiệm A/B/C thực hiện trong YouTube Studio khi tài khoản/video đủ điều kiện; đánh giá theo thời gian xem và có thể không có kết quả phân biệt rõ. Đề xuất trong app chỉ là lựa chọn biên tập ban đầu. Thumbnail thủ công vẫn có trong phần mở rộng bên dưới.
