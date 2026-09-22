# Xuất bản YouTube và dọn dữ liệu dự án

## Thông tin đăng YouTube

1. Hoàn thiện và khóa truyện. Mở **Bàn giao → Xuất bản**.
2. Bấm **Tạo bằng ChatGPT**. Bridge gửi yêu cầu tới ChatGPT theo quy trình hiện có. Có thể theo dõi ở **Hoạt động & tác vụ**. Nếu đang có tác vụ khác, chờ hoặc hoàn tất tác vụ đó trước.
3. Kiểm tra tiêu đề, mô tả, tag, hashtag và các lưu ý. Ngôn ngữ theo kênh; lựa chọn xem tiếng Việt không thay đổi ngôn ngữ đầu ra.
4. Bấm **Tải TXT ChatGPT** để lấy bản đề xuất. App cũng lưu TXT trong `projects/<mã dự án>/publish/` và đưa bản mới nhất vào gói xuất dự án.
5. Nếu muốn dùng kết quả trong biểu mẫu, bấm **Dùng cho biểu mẫu xuất bản**, xác nhận, chỉnh lại nếu cần rồi bấm **Lưu thông tin**. URL video, ngày đăng và ý tưởng thumbnail giữ nguyên.
6. **Xuất biểu mẫu hiện tại ra TXT** tải chính nội dung đang điền, kể cả các chỉnh sửa chưa lưu.

Nếu truyện, lời đọc, kế hoạch hình ảnh hoặc thông tin kênh thay đổi, app báo thông tin YouTube đã cũ. Bấm **Tạo lại bằng ChatGPT**. Không tự ghi đè nội dung bạn đã nhập và không tự đăng video.

Prompt ưu tiên tiêu đề/mô tả sát nội dung, từ khóa tự nhiên, tag liên quan; không nhồi từ khóa, bịa dữ kiện hay hứa hẹn thứ hạng. Giới hạn kỹ thuật được kiểm tra trước khi chấp nhận kết quả. Kiểm tra thủ công video và thumbnail cuối cùng, quyền sử dụng media, đối tượng khán giả và khai báo nội dung AI khi cần. Đây là bản gợi ý, không phải chứng nhận chính sách hoặc kiếm tiền.

Nguồn chính thức đã đối chiếu ngày 22/09/2026:
- https://support.google.com/youtube/answer/146402
- https://support.google.com/youtube/answer/141805
- https://support.google.com/youtube/answer/2801973
- https://support.google.com/youtube/answer/14328491
- https://developers.google.com/youtube/v3/docs/videos

## Xóa dự án để giảm dung lượng

Popup xóa dự án có tùy chọn **Xóa cả media riêng và file được tạo của dự án trên ổ đĩa**. Mặc định tùy chọn này tắt để giữ hành vi cũ.

Khi bật, app liệt kê số file, dung lượng dự kiến và danh sách file trước khi xác nhận. Phạm vi gồm bản sao media đã nhập, WAV, ảnh, clip, thumbnail, các lần dựng video, phụ đề và TXT **bên trong thư mục riêng của các dự án đã chọn**. Xóa là vĩnh viễn; xuất bản sao cần giữ trước khi xác nhận.

App giữ nguyên:
- File gốc bạn nhập từ Downloads hoặc thư mục khác.
- Các bản xuất trong `exports` hoặc nơi khác ngoài thư mục dự án.
- File được dự án khác tham chiếu và thư mục/file liên kết.
- Cài đặt, kênh, nguồn, dự án khác và bản sao lưu chung.

Tác vụ liên quan đang chạy/chờ kết quả sẽ chặn xóa. Nếu file thay đổi sau khi xem popup, cần kiểm tra lại. File bị ứng dụng khác khóa có thể chưa xóa được; app báo đường dẫn còn lại và dung lượng thực tế đã giải phóng.

**Đóng app hoặc rời trang dự án không xóa media hay bản dựng**, để có thể tiếp tục công việc. Bản cập nhật này không tự dọn dữ liệu thật; việc dọn chỉ xảy ra khi bạn bật tùy chọn và xác nhận xóa dự án.
