## Sửa Bridge báo chờ ô nhập dù tab đã ổn định

Từ **v3.1.33**, **Browser Bridge 1.1.32** sửa bộ đếm ổn định bị đặt lại ở mỗi lần kết nối. Reload extension trong Extensions để áp dụng, giữ khóa ghép nối hiện có. Nếu tác vụ đã tạm dừng trước khi cập nhật, bấm **Tiếp tục sau khi kiểm tra tab AI** ở Bridge; giữ đúng tab và lượt tác vụ, không cần bấm Thử lại trong app. Tác vụ đã gửi chỉ tiếp tục lấy kết quả.

## Nhạc nền và tài nguyên từ v3.1.32

Ở bước Định dạng khi tạo dự án, chọn nhạc nền Google Lyria nếu muốn và chốt số ảnh/video (tối thiểu 3 ảnh, 2 video 10 giây). Gợi ý thay đổi theo thời lượng; số lượng đã tự nhập được giữ cho đến khi bấm Dùng số lượng gợi ý. Thumbnail và ảnh tham chiếu nhân vật tính riêng. Chế độ tự động chạy TTS, lập kế hoạch và tạo tài nguyên theo số lượng đã chọn; không chờ xác nhận số lượng lần nữa. Vẫn duyệt Khóa truyện, dựng bản đầu tiên và video cuối.

Reload **Browser Bridge 1.1.31**, giữ đăng nhập Gemini với công cụ **Tạo nhạc** và bật tự động tạo/tải tài nguyên ở Bridge. App ưu tiên dùng nhạc có sẵn trong `background_music` ở thư mục dữ liệu; chỉ gửi một lượt tạo khi thư viện trống. Nhạc nổi hơn trong 30 giây đầu, sau đó giảm và lặp dưới lời kể. Dịch vụ tạo nhạc lỗi không chặn video: xem Tài nguyên > Nhạc nền dùng chung để thử lại hoặc nhập WAV/MP3. Nút dọn dữ liệu dự án không xóa nhạc dùng chung. Bật/tắt khi tạo dự án không thay đổi nhạc của dự án cũ.

## TTS và thumbnail từ v3.1.29

Reload **StoryForge US Browser Bridge 1.1.30** trong Extensions sau cập nhật. Bridge vẫn dùng khóa ghép nối đã lưu; không cần ghép lại. AI Studio chọn Enzo/Friendly rồi xác minh Gemini 3.8 Flash TTS, kể cả khi bảng Run settings đang thu gọn. Tab/dialog của dự án tiếp tục được sử dụng cho các đoạn sau.

Từ **3.1.31**, phản hồi thông tin đăng YouTube có nhiều chi tiết truyện/ghi chú tham khảo vẫn được giữ đầy đủ trong giới hạn mới; giới hạn dữ liệu đăng và trích dẫn đúng truyện không đổi. Sau khi Reload Bridge, tác vụ metadata đã gửi và bị giới hạn trường cũ từ chối được đọc lại một lần trên đúng tab, không gửi thêm prompt. Lỗi Comet tạm khóa thao tác tab được chờ và thử lại trong thời hạn; nếu vẫn không mở được, kiểm tra trình duyệt rồi bấm Tiếp tục ở Bridge.

Tab AI Studio mới có thể hiện màn hình giới thiệu; Bridge xử lý nút Continue của thông báo này trước khi thiết lập. Flow được chờ tải ô nhập/cài đặt tối đa ba phút, nhận nút “Đã chỉnh sửa xong” để trở về danh sách và tải đúng video vừa tạo. Dịch vụ/tab vẫn lỗi sau giới hạn sẽ được báo ở Tài nguyên để xử lý riêng.

Gemini/Flow tiếp tục dùng ảnh nhân vật tham chiếu trong cùng phiên của dự án. Bridge nhận diện các nút tải mới “Nội dung tải lên và công cụ” và “Tải nội dung nghe nhìn lên”, chọn đúng ảnh vừa tải từ thư viện thành phần Flow, chờ ảnh trong ô nhập sẵn sàng rồi mới gửi. Tab của phiên được đưa lên khi bắt đầu tác vụ tiếp theo. Ở danh sách Flow thu gọn, menu tải được mở trên đúng video vừa tạo.

Kế hoạch thumbnail nhận schema và các câu trích dẫn gốc. Nếu AI trả về JSON sai cấu trúc hoặc đổi từ trong trích dẫn, Bridge tự yêu cầu sửa trong giới hạn thử lại. Phản hồi vẫn phải đúng với bản nháp hiện tại mới được lưu. Tác vụ cũ đang tạm dừng có thể bấm **Tiếp tục sau khi kiểm tra tab AI** để nhận lại câu trả lời đã gửi; tài nguyên TTS/ảnh/video đã bị bỏ qua được báo tại Tài nguyên và cần tạo lại riêng.

## Phân công AI từ v3.1.28

ChatGPT xử lý phân tích DNA nguồn, tác vụ đánh giá phù hợp kênh, khám phá chủ đề, kiểm định dàn ý, kiểm định giữ người xem và lập kế hoạch scene/prompt ảnh-video. Các tác vụ viết truyện và metadata đang dùng ChatGPT tiếp tục dùng như trước. Điểm **Channel fit** trong màn hình nguồn vẫn được tính bằng heuristic cục bộ từ DNA, lịch sử và lịch nội dung.

Gemini tiếp tục kiểm định truyện, giải quyết bất đồng, xác minh cuối và tạo ảnh. TTS vẫn dùng Google AI Studio; video vẫn dùng Flow. Giữ nguyên cấu trúc dữ liệu, giới hạn chỉnh sửa, điều kiện bằng chứng/thời gian và các điểm xác nhận.

Tác vụ đã gửi sang Gemini trước khi cập nhật vẫn nhận kết quả từ Gemini. Lượt chạy mới hoặc chạy lại các tác vụ đã chuyển sẽ dùng ChatGPT. Không cần ghép Bridge lại hoặc tạo lại dữ liệu đã hoàn thành.

## Nhịp truyện và video mở đầu v3.1.27

Truyện mới mở bằng hook/câu hỏi/nghịch lý trong 0–10 giây, xung đột và lựa chọn có hệ quả trong 10–30 giây. Cao trào chính và plot twist ở khoảng 45–55% thời lượng; phần sau giải thích nguyên nhân, hệ quả và kết thúc. Kết mở chỉ dùng khi phù hợp, vẫn giải quyết tình huống/lựa chọn chính. Các mốc là định hướng theo số từ và WPM, không phải số liệu khán giả thực tế hoặc bảo đảm mọi bản AI sẽ đạt.

Kế hoạch hình ảnh mới đặt các clip VIDEO 10 giây nối tiếp ngay từ 0:00: hai clip phủ 0–20 giây, ba clip phủ 0–30 giây. Chế độ chuẩn chọn 2–3 clip; chế độ tối thiểu hoặc tùy chỉnh vẫn giữ số lượng đã xác nhận. Nếu tùy chỉnh nhiều hơn ba video, ba clip đầu ở mở đầu, các clip còn lại theo kế hoạch phía sau. Không lặp hoặc cắt ngắn video; mỗi clip cần phần lời kể ít nhất bằng thời lượng gốc. Các scene ảnh phủ phần còn lại. Đồng bộ trong mỗi đoạn WAV vẫn là ước lượng theo trọng số từ, chưa phải căn chỉnh từng từ từ nhận dạng giọng nói.

Khi dự án có video mở đầu nhưng chưa có ảnh tham chiếu hợp lệ, sau xác nhận số lượng tool tạo character_reference.png cho tối đa ba nhân vật chính theo thứ tự Hồ sơ, rồi gửi cùng tham chiếu cho Gemini và Flow. Đây là ảnh chuẩn nhân vật, không nằm trong timeline hay số lượng scene đã chốt. Có thể chọn tối đa ba ảnh tham chiếu riêng để thay thế ảnh tự động. Ngoại hình các nhân vật còn lại vẫn theo Hồ sơ. Tham chiếu giúp giảm thay đổi nhân vật nhưng cần kiểm tra ảnh/video thật do các dịch vụ AI sinh ra. Nếu tham chiếu lỗi, tool tiếp tục hàng đợi và báo thiếu ở Tài nguyên; chọn ảnh tham chiếu hợp lệ trước khi tạo lại các scene bị lệch.

Truyện và kế hoạch đã tạo trước cập nhật được giữ nguyên. Muốn áp dụng bố cục mới cho truyện cũ, chủ động tạo lại Dàn ý/Bản nháp và kiểm định trước khi khóa; muốn thay kế hoạch hình ảnh, tạo kế hoạch mới và xác nhận lại số lượng. File tài nguyên cũ được giữ, nhưng việc thay kế hoạch sẽ thay các gán scene như hướng dẫn hiện có.

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

Bridge **1.1.28** chuyển phần nhập ở ChatGPT, Gemini, Flow và Google AI Studio sang **Copy → Paste** qua clipboard, giữ xuống dòng và kiểm tra nội dung trước khi gửi. Bridge copy prompt vào clipboard của máy; không dùng sự kiện dán giả hoặc tự nhập lại từng ký tự. Sau cập nhật, **Reload** tiện ích để nạp quyền **clipboardRead / clipboardWrite**. Giữ tab AI mở trong lúc Bridge chuẩn bị yêu cầu.

Nếu ChatGPT tự chuyển văn bản dán dài thành tệp, Bridge chờ tệp xử lý hoàn tất, thêm câu lệnh ngắn yêu cầu đọc tệp và trả về JSON rồi mới gửi. Không dán lại khi đang chờ tải tệp; tệp lỗi/bị gỡ, nội dung người dùng thay đổi hoặc clipboard không khớp sẽ dừng để kiểm tra. Việc tự chuyển sang tệp phụ thuộc trang AI, không phải tính năng chung của Gemini, Flow hay AI Studio. Paste không loại bỏ giới hạn dung lượng/ngữ cảnh của dịch vụ.

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

Từ **3.1.30**, **Thiết lập → Sản xuất → Ghép timeline nhanh** bật mặc định. App chỉ render các khoảng fade ngắn, ghép phần còn lại của scene đã có chuyển động rồi xuất video với cấu hình chất lượng hiện có. Giữ pan/zoom, chuyển cảnh, waveform, logo, phụ đề và thời lượng. Nếu bộ mã hóa hoặc số khung hình của một đoạn không phù hợp, app tự chuyển về cách ghép cũ. CPU H.264 và NVIDIA dùng đường nhanh; Quick Sync giữ cách ghép tương thích. Có thể tắt tùy chọn để dùng cách cũ. Chỉ áp dụng cho lượt dựng mới, không làm mất hiệu lực video đã hoàn thành. Xem phép đo tại `docs/RENDER_WORKFLOW_3.1.30.md`.

**Thiết lập → Chung → Rút gọn quy trình truyện** bật mặc định: dàn ý đã đạt được giữ lại, một hook được viết ngay trong bản nháp, kiểm định giữ người xem được gộp với đối chiếu ChatGPT. Hai kết quả vẫn được kiểm tra và lưu riêng. Nếu thiếu bằng chứng hoặc có sửa truyện sau đó, kiểm định giữ người xem chạy riêng. Giữ kiểm định truyện Gemini và xác minh cuối cả hai AI. Chế độ Tự động có kiểm duyệt vẫn chờ duyệt Khóa truyện, chốt tài nguyên và bắt đầu dựng. Tắt tùy chọn để quay lại các lượt AI đầy đủ; nút chỉnh sửa thủ công vẫn hoạt động.

Để giảm thêm thời gian tạo tài nguyên, tại **Đạo diễn hình ảnh → Chế độ kế hoạch** chọn **Ít ảnh · giữ video mở đầu**: dùng khoảng một nửa ảnh, giữ số video mở đầu của chế độ chuẩn. Bạn cần xác nhận số lượng trước khi tạo. Ảnh được giữ lâu hơn với pan/zoom, vì vậy nên xem lại nhịp hình ở các đoạn cao trào. Có thể chọn 1 hoặc 3 ý tưởng khi chỉ cần một truyện; giữ nhóm lớn nếu muốn dùng tiếp cho nhiều dự án.

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


## Thư mục dự án và dọn tài nguyên — v3.1.27

Thư mục trong **Projects** dùng tên truyện tiếng Anh. Dự án trùng tên có mã phân biệt; tên làm việc chưa có tiêu đề tiếng Anh dùng `Story Project` tạm thời. App tự chuyển thư mục mã cũ và cập nhật đường dẫn, giữ nguyên ID, media và liên kết. Đừng tự đổi tên hoặc xóa file `.storyforge-folders.json`; khi chuyển máy/data root cần sao chép toàn bộ thư mục Projects, gồm file này. Database backup chỉ chứa thông tin, không chứa media.

Trong **Tổng quan**, bấm **Xóa dữ liệu Tài Nguyên** để xem trước số file và dung lượng rồi xác nhận. App giữ **video final hiện tại**, hồ sơ, bản nháp, lịch sử ý tưởng và thông tin xuất bản. Media, cache render, gói xuất và bản sao Downloads/CapCut được xác minh thuộc dự án sẽ bị xóa vĩnh viễn. Video final đã tải xuống, file dùng chung, liên kết ổ đĩa, cache trình duyệt và file cá nhân chưa được ghi nhận được giữ lại. Bản sao lưu database không phục hồi được media đã xóa.

Phải hoàn tất/hủy tác vụ đang chạy và có video final hợp lệ trước khi dọn. File đang được app khác mở sẽ được báo để dọn lại sau. Sau khi dọn, vẫn tải final và dùng **Chọn ý tưởng khác** nếu video hiện hành đã được duyệt. Muốn dựng lại hoặc xuất CapCut, bấm **Tạo lại tài nguyên**, tạo/gán lại media còn thiếu rồi tiếp tục quy trình; app không tự tạo lại media ngay sau thao tác dọn.

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
