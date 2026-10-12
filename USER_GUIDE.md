## Giọng đọc và xác nhận dự án từ v3.1.46

Trong **Tổng quan kênh**, nhập **Speaker** đúng tên giọng hiện có trong Google AI Studio và **Style** mô tả ngắn sắc thái, cảm xúc, nhịp đọc rồi bấm **Lưu giọng đọc của kênh**. Thiết lập áp dụng cho dự án mới; giọng của dự án đã chốt không đổi khi sửa mặc định kênh. Khi tạo dự án mới, giữ **Dùng giọng đọc mặc định của kênh** hoặc bỏ chọn để nhập giọng riêng. Các thiết lập kênh khác giữ nguyên.

**Extend và Customize** chờ tại **Tổng quan**: kiểm tra thời lượng, số scene ảnh/video và giọng đọc, đánh dấu xác nhận rồi bấm **Xác nhận và tiếp tục quy trình**. Extend đi thẳng đến tạo Hồ sơ truyện từ ý tưởng đã chọn. Customize cần nhập và lưu Hồ sơ truyện trước khi tạo Dàn ý. Không chạy lại Định hướng hay sinh thêm ý tưởng. Video Flow vẫn tạo thủ công; số lượng video là số clip cần nhập, không phải yêu cầu app tự tạo.

Reload **Browser Bridge 1.1.42** sau khi cài. Bridge kiểm tra Speaker, mở **Style**, Paste vào **Describe the voice style…**, đóng/mở lại để kiểm tra trước khi Paste lời kể và Run. Nếu chưa có giọng đúng tên, app báo lỗi thay vì đổi giọng. Khi chưa tạo được đoạn TTS nào, hủy tác vụ đang chạy và dùng **Chỉnh giọng đọc trước khi tạo TTS** ở Tổng quan để sửa rồi tiếp tục. Nếu đã có TTS, giọng được giữ để tránh trộn giọng giữa các đoạn. Nên dùng Style ngắn; không đưa nội dung truyện vào Style.

Ý tưởng được giữ chỗ trong lúc dự án Extend tồn tại. Xóa Extend chưa dựng video thành công trả lại ý tưởng; đã dựng video thành công thì ý tưởng vẫn là đã dùng kể cả xóa dự án, đổi bản nháp hoặc dọn tài nguyên. Các bản ghi dự án đã xóa từ phiên bản cũ không có bằng chứng hoàn thành được giữ nguyên để tránh dùng lại truyện đã sản xuất; trường hợp đã xác nhận xóa khi chưa dựng có thể khôi phục riêng từ bản sao lưu.

## Bản sắc và DNA riêng cho từng kênh từ v3.1.45

The Midnight Log tiếp tục dùng DNA, prompt và cài đặt hiện tại. Heart & Hurdles có chỉ dẫn riêng cho drama gia đình: tình huống tưởng phi lý được giải thích bằng động cơ con người hợp lý; xung đột và lời giải cần được gieo trước. The Veiled Signal có chỉ dẫn riêng cho bí ẩn khoa học viễn tưởng: khoa học thật làm nền, các tổ chức che giấu/âm mưu là hư cấu; tách rõ dữ kiện, giả thuyết và phát minh trong truyện. Hook xuất hiện ngay đầu, vấn đề và stakes rõ trong 30 giây; cao trào/twist chính ở khoảng 45–55% rồi giải thích và kết thúc.

Để tạo bản sắc cho một kênh mới hoặc điều chỉnh hai kênh trên:

1. Mở kênh → **DNA kênh**. Với DNA chưa có tiêu chí, bấm **Thêm tiêu chí sáng tác** rồi **Sửa JSON**.
2. Chỉnh `creative_brief`: `genre_mode` (`family_drama`, `speculative_mystery` hoặc `custom`), `audience_promise`, `narrative_voice`, `conflict_engine`, `hook_style`, `twist_style`, `ending_style`, `fiction_boundary` và danh sách `avoid`. Tiếp tục giữ các trường DNA hiện có; bấm **Lưu thay đổi**.
3. Bấm **Nghiên cứu DNA kênh**. Browser Bridge dùng ChatGPT theo cơ chế gửi/nhận đang bật. App lần lượt nhận ba phần: bản sắc và hook, chỉ dẫn viết, chỉ dẫn kiểm định và hình ảnh/YouTube. Có thể theo dõi tại **Hoạt động & tác vụ**. Nếu một phần lỗi, sửa lỗi hoặc dùng **Tiếp tục nghiên cứu còn thiếu**; các phần đã nhận vẫn được giữ.
4. Xem kết quả, nguồn tham khảo/giới hạn và so sánh với bộ đang dùng. Bấm **Áp dụng chỉ dẫn** khi hài lòng. Kết quả nghiên cứu không tự áp dụng. Chọn phiên bản cũ để xem; chỉ khôi phục khi DNA hiện tại khớp DNA của phiên bản đó.

Nếu ChatGPT không tra cứu web, kết quả ghi rõ chỉ biên soạn từ DNA. Link tham khảo không phải bằng chứng cho các sự kiện hư cấu hoặc cam kết hiệu quả YouTube. Cần kiểm chứng dữ kiện khoa học trước khi dùng như sự thật.

**Chỉ các dự án tạo sau khi Áp dụng dùng bộ chỉ dẫn mới.** Dự án đang làm và các dự án cũ giữ nguyên. Mỗi dự án mới lưu cả DNA và chỉ dẫn sáng tác; thay DNA kênh sau đó không làm đổi giọng kể giữa chừng. Dự án Extend mới dùng bản sắc đang áp dụng của cùng kênh. Hồ sơ truyện người dùng nhập vẫn là căn cứ chính, bộ chỉ dẫn không tự thay nhân vật hay kết thúc của hồ sơ.

Nếu sửa DNA sau khi nghiên cứu, app giữ bộ đã duyệt đang dùng và đánh dấu kết quả cũ; cần nghiên cứu lại để áp dụng bản sắc mới. Kênh chưa có bộ chỉ dẫn được Áp dụng vẫn dùng prompt chung. Để giữ nguyên The Midnight Log, không chủ động Áp dụng một bộ mới cho kênh này. Các thông số TTS, số ảnh/video, Flow thủ công, nhạc nền và thao tác dựng giữ nguyên.

## Hộp thư nội dung và Thư viện nguồn từ v3.1.41

**Hộp thư nội dung** nhận mọi nguồn mới hoặc tệp TXT/MD/CSV được nhập. Đây là nơi xử lý nguồn chưa phân tích hoặc chưa được duyệt. Bấm **Phân tích** để tạo Story DNA: khi thành công, app tự chuyển nguồn vào **Thư viện nguồn**. Nếu phân tích lỗi, nguồn vẫn trong hộp thư để xử lý tiếp.

**Thư viện nguồn** chứa nguồn đã phân tích hoặc được bạn duyệt để sử dụng. Có thể bấm **Duyệt vào thư viện** mà không phải chạy phân tích ngay. Để xử lý lại, bấm **Chuyển về hộp thư**. Hai thao tác này có trên từng nguồn, trên các nguồn được chọn cùng lúc và trong trang chi tiết. Nội dung, DNA, kênh, dự án liên quan và dòng “Đã dùng trong x Hồ sơ” vẫn được giữ.

Tìm kiếm và phân trang chỉ áp dụng cho mục đang mở; chuyển mục sẽ bỏ lựa chọn nguồn của danh sách trước. Số trên thanh bên Hộp thư nội dung là số nguồn đang chờ. Khi nhập nguồn từ trang Thư viện nguồn, nguồn mới vẫn nằm trong Hộp thư nội dung. Việc tạo dự án vẫn chọn được mọi nguồn như trước.

Khi nâng cấp, app sao lưu dữ liệu rồi xếp các nguồn cũ đã phân tích hoặc đã được dùng trong dự án vào thư viện. Việc phân loại chỉ thực hiện một lần: nếu sau đó chuyển nguồn về hộp thư, lần mở app tiếp theo vẫn giữ lựa chọn đó. **Xóa nguồn** là thao tác xóa dữ liệu; để chỉ đổi nơi lưu, dùng nút chuyển nguồn.

## Ý tưởng và loại dự án từ v3.1.40

Sau khi kiểm tra kỹ thuật đạt và bạn duyệt video cuối, **Chọn ý tưởng khác** mở lại danh sách ý tưởng của dự án gốc. Ý tưởng đã dùng được làm mờ, không thể tạo lại; nếu dự án tương ứng còn tồn tại, bạn có thể mở dự án đó. Ý tưởng chưa dùng có nút **Tạo dự án mới**. Không cần giữ các file tài nguyên cũ để dùng ý tưởng; cập nhật app hay xóa tài nguyên không khóa quyền này. Dự án chưa được duyệt hoàn thành hoặc đang có tác vụ vẫn phải hoàn tất bước đó trước.

- **Full Step - Tên truyện**: quy trình đầy đủ, tạo từ nguồn cảm hứng hoặc ý tưởng gốc.
- **Extend - Tên truyện**: chọn ý tưởng chưa dùng từ dự án đã hoàn thành. Giữ cùng kênh, nguồn cảm hứng, thời lượng và số ảnh/video/nhạc đã chọn; chỉ sao chép ý tưởng đó và bắt đầu ở Hồ sơ truyện. Không sao chép tài nguyên, bản nháp, phiên AI hoặc trạng thái duyệt cũ.
- **Customize - Tên truyện**: nhập Hồ sơ truyện có sẵn, bỏ qua Định hướng và Ý tưởng. Khi nhập hồ sơ có tên truyện, tên dự án được đổi theo tên đó và giữ tiền tố Customize.

App tự thêm nhãn cho dự án hiện có một lần và sao lưu database trước khi chuyển đổi. Các liên kết tài nguyên được cập nhật theo tên thư mục mới; mã dự án và video cuối giữ nguyên. Nhãn chỉ phân biệt dự án, không được đưa vào tên truyện trong prompt hay tiêu đề đăng YouTube.

Trong **Hộp thư nội dung** và **Thư viện nguồn**, dòng nhỏ dưới tên nguồn báo **Đã dùng trong x Hồ sơ** hoặc **Chưa được dùng**. Số lượng là các dự án hiện có liên kết với nguồn trên toàn bộ workspace, gồm dự án Extend và dự án đã xóa tài nguyên. Nếu xóa hẳn dự án, số lượng giảm tương ứng; không tính số ý tưởng được AI đề xuất trong một dự án.

## Video Flow thủ công từ v3.1.44

**Video Flow tạo thủ công từ v3.1.44:** App chỉ tự động tạo ảnh, ba thumbnail và âm thanh. Số video đã chọn vẫn được dùng khi lập kế hoạch; clip Flow không nằm trong hàng đợi tự động. Mở **Đạo diễn hình ảnh → Tạo video Flow thủ công**, tải ảnh tham chiếu, mở cùng một dự án Flow và sao chép prompt của từng scene. Tự tạo/tải clip, lưu đúng tên `scene_001.mp4`, `scene_002.mp4`… hiển thị tại đó rồi nhập tại **Tài nguyên** để tự gắn vào đúng scene. Có thể gắn bằng tay nếu file có tên khác. Các clip đã có được giữ nguyên; cần đủ tài nguyên trước khi dựng. Chế độ Có hỗ trợ vẫn chờ bạn bấm dựng video.

Khi mở bản mới, các tác vụ Flow còn chờ được chuyển sang thủ công; prompt, ảnh tham chiếu và đường dẫn dự án Flow vẫn được giữ. Hàng đợi tự động tiếp tục tạo các ảnh còn lại. Quy tắc này áp dụng cho tất cả chế độ quy trình.

## Âm thanh theo truyện và nhạc dài trong v3.1.44

Reload **Browser Bridge 1.1.41** sau khi cài. Trong **Tài Nguyên > Nhạc nền dùng chung**, bấm **Tạo nhạc Lyria dài mới** để tạo một bản huyền bí khoảng 2–3 phút. Bridge mở [Google AI Studio Music — Lyria 3 Pro Preview](https://aistudio.google.com/new_music?model=lyria-3-pro-preview), bấm vùng **Describe the music you want to generate…**, dán prompt vào **Describe your music…** ở chế độ **Text** rồi bấm **Generate** một lần. Không dùng Gemini để tạo nhạc. Chế độ không lời và thời lượng được yêu cầu trong prompt; Bridge xác minh đúng model và chỉ nhận file âm thanh hoàn chỉnh từ nút **Download** của **Music player**, không lấy nhạc mẫu hoặc gói phát âm thanh. Tài khoản cần dùng được model này trong AI Studio; app không tự chọn API key hay thay đổi thanh toán.

App giữ nhạc hiện có trong lúc chờ và khi lượt mới lỗi, chỉ đổi sang bản mới sau khi tải đủ file (ít nhất 90 giây với lượt nhạc dài mới). Một bản dài dùng chung cho các video; các dự án tiếp theo ưu tiên dùng lại. App giữ đến ba phút, hòa phần cuối với phần đầu để lặp liền mạch; nhập WAV/MP3 thủ công vẫn được. Phiên nhạc được tách khỏi phiên TTS trong AI Studio. Khi nâng cấp, tác vụ nhạc chưa gửi trên Gemini được chuyển sang AI Studio; tác vụ đã gửi không được gửi lại.

Bạn có thể chép nhiều file WAV/MP3/M4A/AAC/FLAC/OGG/OPUS vào **H:\Tool\StoryForge US Data\background_music** (hoặc thư mục dữ liệu đang cấu hình). Mở **Tài Nguyên > Nhạc nền dùng chung**, bấm **Làm mới danh sách nhạc**, chọn tên file, nghe thử rồi bấm **Dùng bản nhạc đã chọn**. Mỗi dự án lưu một lựa chọn riêng, không bị đổi tự động khi có bản nhạc mới. File chép vào thư mục được dùng nguyên bản, không bị cắt/chỉnh mức hoặc xóa khi dọn tài nguyên dự án.

Nhạc nền luôn có gain **0 dB**: giữ mức có trong file gốc, không giảm theo lời kể hoặc mức Music (dB) cũ. Mức Music (dB) cũ được lưu lại nhưng ô này chỉ hiển thị 0 dB và không còn điều chỉnh nhạc. Bản ghép cuối vẫn giới hạn đỉnh quá mức; giọng đọc giữ cài đặt riêng. Video final đã có cần dựng lại để đổi bản nhạc hoặc áp dụng mức mới.

Trong **Tài Nguyên > Hiệu ứng âm thanh theo truyện**, hiệu ứng mặc định bật theo tùy chọn nhạc nền của dự án, có thể bật/tắt riêng. Thư viện `shared_sound_effects` chứa các hiệu ứng gốc được tạo cục bộ và dùng lại, không thêm tác vụ AI từng cảnh. Khi dựng, app thêm lớp nền căng thẳng nhẹ trong 30 giây đầu và các điểm nhấn ở những tình tiết có trong lời kể. Tiếng radio/gõ cửa chỉ dùng khi lời kể mô tả tiếng đó; điểm nhấn nhạc dùng cho tình tiết bất ngờ/hé lộ. Bảng thời điểm dùng thời lượng TTS thực, hoặc ghi rõ ước tính khi chưa có TTS. Nhạc nền không bị giảm hoặc tắt khi có giọng đọc.

Hiệu ứng được chuẩn bị khi hoàn thành tài nguyên hoặc khi dựng; nút **Chuẩn bị hiệu ứng dùng chung** cho phép nghe trước. Video final đã dựng cần dựng lại để nhận hiệu ứng/cách lặp mới. Nhạc đã có vẫn được giữ; chỉ cần tạo nhạc dài mới một lần khi muốn nâng cấp. Chế độ Có hỗ trợ vẫn cần bạn bấm dựng thủ công.

## Nhạc nền giữ mức ổn định từ v3.1.42

App tự đo âm lượng file nhạc và giọng đọc để cân mức nhạc nghe rõ cùng lời kể. Nhạc nền giữ một mức xuyên suốt video, cả lúc có giọng đọc và lúc nghỉ; không tự tắt hoặc giảm theo lời kể. File Lyria đã có cũng dùng cách trộn mới, không cần tạo lại nhạc.

Trong **Thiết lập > Sản xuất**, mục **Music (dB)** mặc định **-28** là mức cân bằng thông thường. Mức này đã được tăng độ hiện diện so với bản trước, với mục tiêu thấp hơn giọng đọc trung bình khoảng 9 dB. Muốn rõ hơn có thể tăng lên **-25**; muốn nhẹ hơn giảm xuống **-31**. Mức nhạc được chọn một lần, có giới hạn biên độ đỉnh để tránh lấn lời kể hoặc vỡ tiếng. Hệ thống lưu kết quả đo âm lượng và dùng lại scene/chuyển cảnh khi dựng lại.

Video đã xuất giữ âm thanh cũ. Sau khi cài bản mới, mở **Dựng & kiểm tra** và bấm dựng lại để áp dụng. Trong **Có hỗ trợ**, app vẫn chờ bạn bấm dựng thủ công. Nếu file nhạc không có âm thanh, phần kiểm tra cuối sẽ nhắc thay bản nhạc.

## Flow và tự khóa truyện Có hỗ trợ trong v3.1.42

Từ v3.1.44, Flow được dùng thủ công: tải ảnh tham chiếu tại **Đạo diễn hình ảnh**, tự chọn ảnh qua **Tải nội dung…**, bấm **Thêm vào câu lệnh** nếu Flow hiển thị khung xem trước, rồi dán prompt và tạo video. Scene tiếp theo dùng cùng bộ ảnh và cùng dự án Flow. Các bản trước v3.1.44 dùng Bridge để thực hiện các thao tác này.

Trong **Có hỗ trợ**, sau kiểm duyệt, xử lý bất đồng, các vòng sửa và hai kiểm định cuối cho đúng bản nháp, app tự khóa truyện và tiếp tục sản xuất dù vẫn còn bất đồng hoặc cảnh báo. Báo cáo **Kiểm định truyện / Khóa truyện** giữ nguyên các cảnh báo và kết quả AI, kèm ghi nhận tự khóa. App vẫn dừng nếu tác vụ lỗi, kết quả thiếu hoặc kiểm định chưa theo bản nháp hiện tại. Tài nguyên được chuẩn bị theo cài đặt đã chọn; **Dựng bản đầu tiên** vẫn cần bạn bấm thủ công.

## Nhận thumbnail và mở nút dựng từ v3.1.38

Các file `thumbnail_A.png`, `thumbnail_B.png`, `thumbnail_C.png` nhập thủ công được nhận trong Tình trạng tài nguyên, không cần gắn mã kế hoạch. Kế hoạch thumbnail cũ không chặn dựng khi giọng đọc và scene đã đủ. Nếu thiếu thumbnail để đăng YouTube, app chỉ nhắc bổ sung; ảnh thumbnail được chọn làm ảnh kết thúc video vẫn phải còn trên máy. Logo và video sóng nhạc đã bật cũng phải hợp lệ.

Chế độ **Có hỗ trợ** vẫn cần bấm **Dựng bản đầu tiên** thủ công. Cập nhật này giữ nguyên các file, lựa chọn dựng và yêu cầu tạo đủ ba thumbnail có hình và chữ.

## Thumbnail và dựng video từ v3.1.37

Cả ba thumbnail A/B/C đều có hình ảnh và câu chữ ngắn riêng. Câu chữ, font, màu sắc và hiệu ứng được chọn theo cốt truyện; chữ cần rõ trên màn hình nhỏ và không tiết lộ kết thúc. Kế hoạch thumbnail cũ có phương án không chữ cần được tạo lại, các file và scene cũ vẫn được giữ.

Không còn bước tích xác nhận tài nguyên. Khi đủ tài nguyên hợp lệ, mở **Dựng & kiểm tra** và bấm **Dựng bản đầu tiên**. Trong chế độ **Có hỗ trợ**, app tự chuẩn bị tài nguyên rồi dừng trước khi dựng; app không tự bấm dựng. Việc kiểm tra video cuối sau khi dựng vẫn giữ nguyên.

## Ảnh tham chiếu video Flow từ v3.1.36

Đây là cơ chế tự động của các bản v3.1.36–v3.1.43. Từ v3.1.44, người dùng tự tải ảnh tham chiếu vào Flow, chọn đúng ảnh và bấm **Thêm vào câu lệnh** nếu xuất hiện khung xem trước. Sau khi đủ ảnh nằm trong ô prompt, dán prompt scene từ app và bấm tạo video.

Scene tiếp theo dùng lại ảnh đã tải trong cùng dự án Flow. Clip đã tạo được giữ; nhập file vào **Tài nguyên** với tên `scene_NNN.mp4` đúng số scene, hoặc gắn bằng tay. Bridge không tự tạo hay tải clip Flow trong v3.1.44.

Nếu bạn đổi ảnh đang chọn hoặc thêm ảnh khác vào ô nhập Flow, kiểm tra bộ ảnh trước khi tạo clip để giữ nhân vật đồng nhất.

## Tệp trả lời ChatGPT và tên hồ sơ từ v3.1.35

Reload Browser Bridge **1.1.34** trong Extensions sau cập nhật. Khi ChatGPT trả kết quả dưới dạng thẻ JSON/TXT hoặc khung mã riêng, Bridge mở đúng tệp của lượt trả lời mới và đọc toàn bộ bản xuất; không cần sao chép từng phần đang hiển thị. App vẫn kiểm tra cấu trúc và bằng chứng của tác vụ. Tệp chưa đọc được sẽ tạm dừng để mở lại thẻ rồi Tiếp tục ở Bridge, không tự gửi lại prompt. Nếu có nhiều tệp JSON, chọn/nhập đúng tệp thủ công ở Hoạt động & tác vụ.

Hồ sơ truyện nhập nên có trường `title` chứa tên truyện. App tự đổi tên dự án và thư mục theo tên đó, giữ ID, kênh và nguồn. Với hồ sơ cũ không có trường tên, chỉ dùng tiêu đề rõ ràng ở đầu tóm tắt; nếu không xác định được thì giữ tên đang có.

## Sửa Bridge báo chờ ô nhập dù tab đã ổn định

## Chế độ Có hỗ trợ từ v3.1.34

Bấm **Tiếp tục quy trình** để chạy hoặc đưa dự án vào hàng đợi. Chọn ý tưởng như trước; dự án nhập Hồ sơ truyện bỏ qua Định hướng và Ý tưởng. Sau dàn ý và bản nháp, tool tự kiểm định, sửa và khóa truyện khi đạt, rồi tự tạo TTS.

Nếu đã chốt số ảnh/video lúc tạo dự án, tool dùng ngay số lượng đó, tạo đủ ba thumbnail A/B/C và tài nguyên scene sau TTS. Nhạc nền dùng theo lựa chọn của dự án: ưu tiên file mystery phù hợp trong thư viện, chỉ yêu cầu Lyria tạo khi chưa có. Giữ cơ chế bỏ qua tài nguyên lỗi và báo thiếu ở **Tài Nguyên**.

Khi hàng đợi tài nguyên kết thúc, app tiếp tục dự án khác đã được yêu cầu chạy. Dự án chưa được yêu cầu và dự án đã hoàn thành không tự chạy lại. Tại **Tài Nguyên**, xem/nghe file, bổ sung các mục thiếu, tích **Tôi đã kiểm tra tài nguyên và xác nhận sử dụng để dựng video**, rồi bấm **Xác nhận tài nguyên và mở bước dựng video**. Chỉ sau xác nhận mới có thể dựng. Thay file hoặc ánh xạ tài nguyên sẽ yêu cầu duyệt lại; cài đặt hiệu ứng dựng vẫn chỉnh được. Vẫn phải xem và duyệt video cuối như trước.

Từ **v3.1.33**, **Browser Bridge 1.1.32** sửa bộ đếm ổn định bị đặt lại ở mỗi lần kết nối. Reload extension trong Extensions để áp dụng, giữ khóa ghép nối hiện có. Nếu tác vụ đã tạm dừng trước khi cập nhật, bấm **Tiếp tục sau khi kiểm tra tab AI** ở Bridge; giữ đúng tab và lượt tác vụ, không cần bấm Thử lại trong app. Tác vụ đã gửi chỉ tiếp tục lấy kết quả.

## Nhạc nền và tài nguyên từ v3.1.32

Ở bước Định dạng khi tạo dự án, chọn nhạc nền Google Lyria nếu muốn và chốt số ảnh/video (tối thiểu 3 ảnh, 2 video 10 giây). Gợi ý thay đổi theo thời lượng; số lượng đã tự nhập được giữ cho đến khi bấm Dùng số lượng gợi ý. Thumbnail và ảnh tham chiếu nhân vật tính riêng. Chế độ tự động chạy TTS, lập kế hoạch và tạo tài nguyên theo số lượng đã chọn; không chờ xác nhận số lượng lần nữa. Vẫn duyệt Khóa truyện, dựng bản đầu tiên và video cuối.

Reload **Browser Bridge 1.1.41**, giữ đăng nhập Google AI Studio với **Lyria 3 Pro Preview** và bật tự động tạo/tải tài nguyên ở Bridge. App ưu tiên dùng nhạc có sẵn trong `background_music` ở thư mục dữ liệu; chỉ gửi một lượt tạo khi thư viện trống. Từ v3.1.43, nhạc lặp ở mức nguồn gốc (0 dB), còn lớp hiệu ứng riêng nhấn 30 giây đầu và các tình tiết trong truyện. Dịch vụ tạo nhạc lỗi không chặn video: xem Tài nguyên > Nhạc nền dùng chung để thử lại hoặc nhập WAV/MP3. Nút dọn dữ liệu dự án không xóa nhạc dùng chung. Bật/tắt khi tạo dự án không thay đổi nhạc của dự án cũ.

## TTS và thumbnail từ v3.1.29

Reload **StoryForge US Browser Bridge 1.1.30** trong Extensions sau cập nhật. Bridge vẫn dùng khóa ghép nối đã lưu; không cần ghép lại. AI Studio chọn Enzo/Friendly rồi xác minh Gemini 3.8 Flash TTS, kể cả khi bảng Run settings đang thu gọn. Tab/dialog của dự án tiếp tục được sử dụng cho các đoạn sau.

Từ **3.1.31**, phản hồi thông tin đăng YouTube có nhiều chi tiết truyện/ghi chú tham khảo vẫn được giữ đầy đủ trong giới hạn mới; giới hạn dữ liệu đăng và trích dẫn đúng truyện không đổi. Sau khi Reload Bridge, tác vụ metadata đã gửi và bị giới hạn trường cũ từ chối được đọc lại một lần trên đúng tab, không gửi thêm prompt. Lỗi Comet tạm khóa thao tác tab được chờ và thử lại trong thời hạn; nếu vẫn không mở được, kiểm tra trình duyệt rồi bấm Tiếp tục ở Bridge.

Tab AI Studio mới có thể hiện màn hình giới thiệu; Bridge xử lý nút Continue của thông báo này trước khi thiết lập. Dịch vụ/tab vẫn lỗi sau giới hạn sẽ được báo ở Tài nguyên để xử lý riêng. Flow do người dùng thao tác và nhập clip thủ công từ v3.1.44.

Gemini tiếp tục tự dùng ảnh nhân vật tham chiếu trong cùng phiên của dự án. Với Flow, tải cùng các ảnh tham chiếu từ app và tự thêm vào cùng dự án Flow khi tạo clip. Tab Gemini của phiên được đưa lên khi bắt đầu tác vụ ảnh tiếp theo.

Kế hoạch thumbnail nhận schema và các câu trích dẫn gốc. Nếu AI trả về JSON sai cấu trúc hoặc đổi từ trong trích dẫn, Bridge tự yêu cầu sửa trong giới hạn thử lại. Phản hồi vẫn phải đúng với bản nháp hiện tại mới được lưu. Tác vụ cũ đang tạm dừng có thể bấm **Tiếp tục sau khi kiểm tra tab AI** để nhận lại câu trả lời đã gửi; tài nguyên TTS/ảnh/video đã bị bỏ qua được báo tại Tài nguyên và cần tạo lại riêng.

## Phân công AI từ v3.1.28

ChatGPT xử lý phân tích DNA nguồn, tác vụ đánh giá phù hợp kênh, khám phá chủ đề, kiểm định dàn ý, kiểm định giữ người xem và lập kế hoạch scene/prompt ảnh-video. Các tác vụ viết truyện và metadata đang dùng ChatGPT tiếp tục dùng như trước. Điểm **Channel fit** trong màn hình nguồn vẫn được tính bằng heuristic cục bộ từ DNA, lịch sử và lịch nội dung.

Gemini tiếp tục kiểm định truyện, giải quyết bất đồng, xác minh cuối và tạo ảnh. TTS vẫn dùng Google AI Studio; video vẫn dùng Flow. Giữ nguyên cấu trúc dữ liệu, giới hạn chỉnh sửa, điều kiện bằng chứng/thời gian và các điểm xác nhận.

Tác vụ đã gửi sang Gemini trước khi cập nhật vẫn nhận kết quả từ Gemini. Lượt chạy mới hoặc chạy lại các tác vụ đã chuyển sẽ dùng ChatGPT. Không cần ghép Bridge lại hoặc tạo lại dữ liệu đã hoàn thành.

## Nhịp truyện và video mở đầu v3.1.27

Truyện mới mở bằng hook/câu hỏi/nghịch lý trong 0–10 giây, xung đột và lựa chọn có hệ quả trong 10–30 giây. Cao trào chính và plot twist ở khoảng 45–55% thời lượng; phần sau giải thích nguyên nhân, hệ quả và kết thúc. Kết mở chỉ dùng khi phù hợp, vẫn giải quyết tình huống/lựa chọn chính. Các mốc là định hướng theo số từ và WPM, không phải số liệu khán giả thực tế hoặc bảo đảm mọi bản AI sẽ đạt.

Kế hoạch hình ảnh mới đặt các clip VIDEO 10 giây nối tiếp ngay từ 0:00: hai clip phủ 0–20 giây, ba clip phủ 0–30 giây. Chế độ chuẩn chọn 2–3 clip; chế độ tối thiểu hoặc tùy chỉnh vẫn giữ số lượng đã xác nhận. Nếu tùy chỉnh nhiều hơn ba video, ba clip đầu ở mở đầu, các clip còn lại theo kế hoạch phía sau. Không lặp hoặc cắt ngắn video; mỗi clip cần phần lời kể ít nhất bằng thời lượng gốc. Các scene ảnh phủ phần còn lại. Đồng bộ trong mỗi đoạn WAV vẫn là ước lượng theo trọng số từ, chưa phải căn chỉnh từng từ từ nhận dạng giọng nói.

Khi dự án có video mở đầu nhưng chưa có ảnh tham chiếu hợp lệ, sau xác nhận số lượng tool tạo character_reference.png cho tối đa ba nhân vật chính theo thứ tự Hồ sơ, rồi tự gửi cùng tham chiếu cho Gemini. Tải các ảnh đó trong **Tạo video Flow thủ công** và tự thêm vào Flow. Đây là ảnh chuẩn nhân vật, không nằm trong timeline hay số lượng scene đã chốt. Có thể chọn tối đa ba ảnh tham chiếu riêng để thay thế ảnh tự động. Ngoại hình các nhân vật còn lại vẫn theo Hồ sơ. Tham chiếu giúp giảm thay đổi nhân vật nhưng cần kiểm tra ảnh/video thật do các dịch vụ AI sinh ra. Nếu tham chiếu lỗi, tool tiếp tục hàng đợi và báo thiếu ở Tài nguyên; chọn ảnh tham chiếu hợp lệ trước khi tạo lại các scene bị lệch.

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

Trong bản **3.1.44 / Bridge 1.1.41**, ChatGPT/Gemini chỉ cần trang tải xong ít nhất **1 giây** và cùng ô nhập khả dụng, không đổi ít nhất **0,5 giây**. Hai kiểm tra chạy đồng thời, kiểm tra lại mỗi 0,5 giây lúc chuẩn bị prompt; áp dụng cả Gemini tạo ảnh. Nếu trang/ô nhập tải lại, bị khóa hoặc AI vẫn đang trả lời, Bridge tiếp tục chờ. File prompt dài và ảnh tham chiếu vẫn phải xử lý xong trước khi gửi. TTS và Lyria giữ các mốc chờ hiện có; Flow do người dùng thao tác thủ công. Sau cập nhật cần **Reload Browser Bridge** để nạp bản mới.

Khi câu trả lời văn bản đã hoàn tất và app từ chối JSON/cấu trúc/độ dài/trích dẫn, Bridge gửi **Hãy viết lại câu trả lời chuẩn Json** hoặc **Viết lại câu trả lời theo đúng yêu cầu** vào đúng chat đó, kèm lỗi cụ thể. App đọc tin nhắn và tệp JSON/TXT trước khi yêu cầu sửa. Luồng phục hồi: **lần đầu → sửa một lần trong chat cũ → thử một lần trong chat mới với cùng AI → tạm dừng nếu vẫn lỗi**. Yêu cầu mới dùng đầy đủ prompt gốc; Bridge chỉ đóng tab do chính nó tạo, không đóng tab đã chuyển sang chat khác. Không tự đổi ChatGPT/Gemini. Kết quả kiểm duyệt không đạt hoặc còn bất đồng vẫn được lưu nếu hợp lệ; cổng chất lượng không bị nới lỏng. Lỗi tải tệp, mạng, đăng nhập hoặc quota cần xử lý riêng. **Tiếp tục** chỉ đọc lại lượt đã gửi; muốn bắt đầu lại sau khi đã hết hạn mức, kiểm tra lỗi rồi bấm **Thử lại** ở Hoạt động & tác vụ.

Nếu ChatGPT tự chuyển văn bản dán dài thành tệp, Bridge chờ tệp xử lý hoàn tất, thêm câu lệnh ngắn yêu cầu đọc tệp và trả về JSON rồi mới gửi. Không dán lại khi đang chờ tải tệp; tệp lỗi/bị gỡ, nội dung người dùng thay đổi hoặc clipboard không khớp sẽ dừng để kiểm tra. Việc tự chuyển sang tệp phụ thuộc trang AI, không phải tính năng chung của Gemini, Flow hay AI Studio. Paste không loại bỏ giới hạn dung lượng/ngữ cảnh của dịch vụ.

Không bypass đăng nhập, CAPTCHA, quota hay paywall. Đóng popup trong lúc Wait có thể mất thông báo; job vẫn tồn tại và có thể Capture lại. Trang AI thực có thể yêu cầu bạn mở đúng chế độ sinh ảnh, speech hay video trước khi Fill.

## 6. TTS, hình ảnh và tài nguyên

### Tự động tạo và tải tài nguyên (3.1.12)

- Bản local **3.1.24 / Bridge 1.1.27** lưu riêng chat Gemini, hộp thoại AI Studio và project Flow theo mã dự án. Khi scene lỗi, Bridge giữ đường dẫn phiên, chờ kết quả cũ ổn định rồi chạy scene tiếp theo. Nếu không khôi phục được phiên đã lưu, tài nguyên được báo thiếu để bạn tạo thủ công; không gửi trùng prompt đã gửi. AI Studio kiểm tra lại model **Gemini 3.8 Flash TTS / Enzo / Friendly**; hộp thoại chưa lưu có thể phải tạo lại sau khi tải lại trang.
- Trong **Đạo diễn hình ảnh → Ảnh nhân vật tham chiếu**, có thể chọn tối đa 3 ảnh đã nhập của dự án. Để trống để dùng ảnh chuẩn nhân vật tự tạo hoặc ảnh scene đầu tiên hoàn thành. Bridge tự đính kèm các ảnh này vào Gemini; với Flow, dùng các nút tải ảnh tham chiếu để tự thêm vào cùng dự án Flow. Có thể thay lựa chọn trong lúc TTS chạy, nhưng cần kết thúc hoặc dừng hàng đợi hình ảnh trước khi thay. Các nút mở dịch vụ sẽ mở đúng phiên đã lưu của dự án. Ảnh tham chiếu và mô tả nhân vật hỗ trợ sự đồng nhất; vẫn cần kiểm tra hình ảnh đầu ra.
- Trong **Dựng & kiểm tra**, bấm **final_video.mp4** để lưu trực tiếp vào thư mục dự án trong **Downloads**, cùng thư mục tài nguyên đã tải. App hiện đường dẫn khi lưu xong; các lần tải sau thêm `(1)`, `(2)` để giữ file cũ. Phần xem video và tải các file âm thanh/phụ đề khác giữ nguyên.
- Mở app và Bridge đã ghép nối, bật chế độ tự động của Bridge và đăng nhập AI Studio, Gemini bằng trình duyệt thông thường. Bridge cần quyền **Downloads / Tải xuống**. Đăng nhập Flow khi muốn tự tạo clip; Flow không nằm trong hàng đợi tự động từ v3.1.44.
- Trong Comet, mở **Settings → Downloads** và tắt **Ask where to save each file before downloading** (Hỏi nơi lưu từng file). Khi bật tùy chọn này, Comet có thể vẫn hiện Save As dù Bridge yêu cầu tải tự động. Thiết lập này áp dụng cho các lượt tải của trình duyệt.
- Nếu đã hủy hộp thoại lưu, tắt tùy chọn trên rồi bấm **Tiếp tục tải tài nguyên** trong popup Bridge. Bridge tải lại kết quả có sẵn; không tạo lại âm thanh/ảnh/video.
- Trong **Xưởng giọng đọc**, sau khi đã khóa truyện và chia đoạn, bấm **Tạo và tải giọng đọc**. Không cần xác nhận số lượng âm thanh. Bridge chờ AI Studio tải xong, mở Create new dialog, chọn **Enzo / Friendly**, tạo từng đoạn và tải `tts_001.wav`, `tts_002.wav`... Dùng lại một tab, chỉ thay phần lời kể do Bridge nhập.
- Trong **Đạo diễn hình ảnh**, chọn số lượng ảnh/video và tạo kế hoạch cảnh trước. Nếu chưa chốt số lượng từ khi tạo dự án, bấm **Xem và xác nhận số ảnh/video** rồi **Xác nhận số lượng và tạo tài nguyên**. Sau xác nhận, Bridge tạo ba thumbnail trước, tiếp tục các scene ảnh theo thứ tự trong cùng tab Gemini. Số video vẫn dùng trong kế hoạch, nhưng clip được tạo thủ công trong Flow.
- Trong Flow, chọn chế độ tạo video từ ảnh tham chiếu, khung **16:9**, clip **10 giây** theo kế hoạch. Chọn model/chất lượng phù hợp với tài khoản và mức tín dụng đang hiển thị trên trang; các thao tác này do người dùng thực hiện.
- File tự động tải vào **Downloads / tên dự án**, với tên `thumbnail_A.png`, `thumbnail_B.png`, `thumbnail_C.png`, `scene_001.png`... Sau khi trình duyệt báo tải hoàn tất, app kiểm tra file và tự gán đúng đoạn/cảnh; mới chuyển sang mục tiếp theo. Video tải thủ công cần nhập tại **Tài nguyên**: tên `scene_NNN.mp4` theo số scene sẽ tự gán, tên khác có thể gắn bằng tay. App lưu một bản media riêng trong dữ liệu dự án để dùng cho timeline và CapCut.
- Mặc định bỏ qua file ảnh/âm thanh đã gán còn hợp lệ. Muốn làm lại, chọn **Tạo lại cả tài nguyên đã gán** trước khi bắt đầu; tùy chọn này không tự tạo lại clip Flow. File trùng tên trong Downloads được thêm số `(1)`, `(2)` để giữ bản trước.
- Có thể **Dừng tự động tạo tài nguyên** để ngừng hàng đợi. Những file đã hoàn tất vẫn được giữ. Khi tạm dừng do kết nối/giao diện, kiểm tra tab rồi dùng **Tiếp tục** trong popup Bridge. Yêu cầu đã gửi không được gửi lại để tránh tạo trùng/tốn tín dụng. Không đóng app hoặc các tab đang tạo tài nguyên.

Sau Story Lock: **TTS studio → Build semantic chunks**. Chunker không cắt giữa câu, ưu tiên đoạn, kết thúc thoại, đổi thời gian/địa điểm. Mục tiêu khoảng 3 phút, hard max 4 phút. Một câu đơn lẻ dài quá giới hạn cần sửa thủ công.

**Visual director** tạo scene plan gắn với version, chủ yếu ảnh và một số cảnh video. Ảnh có thể gửi qua Bridge; clip Flow tạo thủ công bằng prompt và ảnh tham chiếu trong app rồi nhập vào Tài nguyên. Asset naming:

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
