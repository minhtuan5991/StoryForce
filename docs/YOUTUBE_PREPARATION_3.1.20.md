# StoryForge 3.1.20 — chuẩn bị nội dung YouTube và tạo tài nguyên

Bản cập nhật local đi kèm Browser Bridge 1.1.24. Giữ nguyên dữ liệu, cài đặt render, xuất project CapCut và bước duyệt video cuối. Không đăng GitHub trong lần cập nhật này.

## Viết và kiểm định

- Mỗi ý tưởng mới có đề xuất tiêu đề, thumbnail, câu hỏi tò mò và lời hứa nội dung. Điểm tiềm năng là đánh giá của AI trên thang 100, không phải tỷ lệ giữ người xem thực tế.
- Trước khi viết bản nháp, app tạo ba phương án mở đầu và chọn phương án được đề xuất. Người dùng có thể chọn phương án khác trước khi khóa truyện. Đây là so sánh phương án viết; không phải thử nghiệm A/B với khán giả YouTube.
- Kiểm tra nhịp truyện ở 0–10, 10–30, 30–60, 60–90 giây, 1–3 phút, 3–7 phút và các khoảng ba phút tiếp theo. Mốc thời gian lúc viết được ước tính theo số từ/WPM. Các khoảng vượt thời lượng truyện được ghi Không áp dụng.
- AI phải chỉ ra trích dẫn từ đúng bản nháp và đúng khoảng thời gian, cùng lý do và cách sửa. Phát hiện đoạn quay lại giới thiệu sau mở đầu, kéo dài mà thiếu tiến triển, hoặc nội dung không thực hiện lời hứa của tiêu đề/thumbnail. Yêu cầu tùy theo định hướng, không ép mọi thể loại thành truyện kinh dị.
- Sửa nhịp truyện bằng thay thế đoạn cụ thể, tối đa ba lượt trong pipeline. Sửa nội dung làm kết quả kiểm định cũ hết hiệu lực; phải kiểm định lại bản hiện tại.
- Tách trạng thái chất lượng truyện, khả năng giữ người xem và sự khớp với tiêu đề/thumbnail. Dự án cũ thiếu kết quả mới được ghi Chưa đánh giá, không bị tự chuyển thành trượt hay bị chặn sản xuất đang có.

Khi các kiểm định cần thiết của bản hiện tại đạt, app **tự khóa truyện và tiếp tục chia đoạn giọng đọc**, kể cả khi cài đặt tự khóa cũ đang tắt. Không cần bấm duyệt khóa truyện. Các lỗi cần xử lý và nhận xét yêu cầu con người vẫn phải được giải quyết. **Duyệt video cuối trước khi xuất bản vẫn giữ nguyên.**

## TTS và hàng đợi hình ảnh

1. Chọn chế độ Browser Bridge, ghép nối và bật tự động tạo/tải tài nguyên trong tiện ích. Sau khi cập nhật, **Reload Browser Bridge 1.1.24** trên trang Extensions; tải lại trang StoryForge.
2. Sau khi truyện tự khóa và chia đoạn, Bridge tạo giọng đọc bằng Enzo / Friendly trong một tab AI Studio. TTS không phải chờ xác nhận số lượng ảnh/video.
3. Trong Đạo diễn hình ảnh, chọn mức tài nguyên hoặc số lượng tùy chỉnh. Bấm Tạo kế hoạch; xem popup và xác nhận số ảnh, số video. Checkbox tạo/tải tự động được bật mặc định, có thể tắt để chỉ tạo kế hoạch.
4. Nếu TTS đang chạy, kế hoạch được **xếp hàng**. Bạn có thể thay đổi và xác nhận kế hoạch mới; kế hoạch chờ mới nhất thay kế hoạch chờ trước đó. TTS đang chạy vẫn tiếp tục.
5. Khi mọi đoạn TTS đã hoàn thành hoặc bị bỏ qua do lỗi, app tạo kế hoạch hình ảnh đang chờ. Nếu đã xác nhận tạo tự động, Bridge tạo thumbnail trước rồi ảnh/video theo thứ tự. Video Flow vẫn dùng cài đặt 10 giây, 720p, 16:9, một đầu ra.
6. Nếu chỉ tạo kế hoạch, bạn vẫn phải xác nhận số lượng hiện tại trước khi bấm tự động tạo tài nguyên. Thay đổi truyện hoặc kế hoạch làm xác nhận cũ hết hiệu lực; app yêu cầu xác nhận lại.

Tệp tải về vẫn ở Downloads/thư mục tên dự án, đặt tên `tts_001.wav`, `scene_001.png` hoặc `scene_001.mp4`. File tải xong và được kiểm tra mới gán vào đúng scene; không dùng WAV xem trước bị cắt ngắn.

## Khi trình duyệt hoặc tab AI bị lỗi

- Bridge có giới hạn chờ: khoảng ba phút cho mở/thiết lập trang, 30 phút chờ kết quả, và 2,5 phút cho một lần tải. Lỗi kỹ thuật không giữ cả hàng đợi vô thời hạn.
- App kiểm tra liên lạc với Bridge. Nếu item đã được một Bridge nhận xử lý nhưng mất heartbeat quá ba phút, app bỏ qua item đó. App vừa khởi động có thời gian kết nối lại; item chưa có Bridge nhận xử lý không tự bị đánh dấu lỗi.
- Lỗi làm **bỏ qua đúng item**, ghi tên tệp, scene/đoạn TTS và nguyên nhân trong Tài nguyên, rồi chuyển item tiếp theo. Không gửi lại prompt của item đã gửi khi chưa rõ trạng thái; không nhận file đến muộn của item đã bỏ qua.
- Nếu toàn bộ trình duyệt đã đóng hoặc đứng, cần mở lại trình duyệt/Bridge để tạo được item tiếp theo. App vẫn ghi nhận item thiếu; không thể điều khiển một trình duyệt đang ngừng hoạt động.
- Vào **Tài nguyên → Tài nguyên còn thiếu**, tạo lại thủ công trên AI Studio/Gemini/Flow, rồi tải và gán file. Danh sách thiếu tự hết khi có tài nguyên hợp lệ. Bấm Dừng để hủy cả lượt tự động hiện tại và kế hoạch đang chờ.

## Số liệu kênh và lời nhắc không bắt buộc

Thông tin kênh và định hướng được lưu để dùng lại; không cần gửi lại mỗi lần tạo truyện. Sau khi đăng YouTube, có thể bổ sung kết quả trong Phân tích. **Không nhập số liệu vẫn viết truyện, tạo tài nguyên, dựng và xuất bản bình thường.**

- Lưu ngày đăng, tiêu đề/thumbnail thực sự đã dùng, thời lượng video, tuổi quan sát và nguồn truy cập; nhập chỉ những số liệu đã có.
- Views/impressions là số lượt; CTR và retention là phần trăm; thời gian xem tổng tính bằng phút; thời gian xem trung bình tính bằng giây. Retention có thể vượt 100% do xem lại.
- Để trống số liệu chưa biết hoặc không áp dụng. `0` chỉ dùng khi đã đo được bằng không. Không nhập retention ở mốc dài hơn video.
- Khi đã lưu ngày đăng và URL YouTube, app hiển thị lời nhắc sau 7 và 28 ngày trên bảng kênh/Phân tích khi mở app. Có thể bỏ qua từng lời nhắc hoặc tắt Nhắc bổ sung kết quả trong Xuất bản. Đây là lời nhắc trong app, không gửi email hay tự lấy dữ liệu tài khoản YouTube.
- So sánh trung vị các video cùng kênh có độ dài gần nhau, tuổi quan sát gần nhau và cùng nguồn truy cập. Lưu nhiều snapshot của một video không được tính thành nhiều video và không cộng dồn lượt xem.
- Phân loại tương đối cần ít nhất năm video so sánh có đủ impressions/views. Học cơ chế nội dung cần tối thiểu mười quan sát phù hợp và ba video thử cùng cơ chế. Mẫu ít hiển thị chưa đủ dữ liệu; không tự sửa DNA kênh.
- Những cơ chế có kết quả tốt được đưa vào gợi ý cho ý tưởng tiếp theo. App yêu cầu thay cách triển khai, nhân vật, bối cảnh và kết quả để tránh lặp truyện. Dữ liệu quan sát không chứng minh một yếu tố gây ra thành công.
