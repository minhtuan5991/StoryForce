# StoryForge US 3.1.17 — cập nhật tại máy

## Xóa kênh

Nút **Xóa kênh** nằm trên thẻ kênh và trong trang chi tiết kênh.
Popup hiển thị các dự án thuộc kênh trước khi xác nhận. Xóa kênh sẽ xóa
các dự án này cùng truyện, phiên bản, bảng gán tài nguyên, lịch sử tác vụ,
lịch nội dung và bộ nhớ ý tưởng của kênh. Tư liệu nguồn được giữ trong
thư viện và bỏ liên kết với kênh đã xóa.

Mặc định giữ các file media trên ổ đĩa. Có thể tích **Xóa cả media riêng
và file được tạo của dự án trên ổ đĩa** để dọn file thuộc thư mục riêng
của các dự án bị xóa. File gốc bên ngoài, file dùng chung, thư mục liên kết
và bản xuất ở vị trí khác vẫn được giữ. App chặn xóa khi công việc liên
quan còn chạy hoặc nội dung thay đổi sau khi xem popup.

## Làm video từ ý tưởng khác

1. Hoàn thành **Dựng & kiểm tra**, xem và tích xác nhận video final.
2. Tải `final_video.mp4` để giữ bản thành phẩm.
3. Quay lại **Ý tưởng truyện**, bấm **Tạo dự án mới** ở ý tưởng khác.

App mở dự án mới với đúng ý tưởng đã chọn, cùng kênh, nguồn, định hướng,
thời lượng và tốc độ đọc của dự án cũ. Các ý tưởng và kết quả đánh giá
được sao chép để tiếp tục tham khảo. Dự án mới bắt đầu từ Hồ sơ truyện,
theo chế độ thủ công/hỗ trợ/tự động đang dùng.

Dự án cũ và video final giữ nguyên. Có thể quay lại dự án cũ để chọn
nhiều ý tưởng khác. Chọn lại cùng một ý tưởng sẽ mở dự án đã tạo từ
ý tưởng đó, tránh tạo bản trùng khi bấm lặp lại. Ý tưởng bị chặn bởi
kiểm tra chất lượng vẫn không được chọn.

App kiểm tra bản dựng hiện tại, file video còn tồn tại, các đầu vào
dựng chưa thay đổi và xác nhận xem video. Không cần cập nhật cấu trúc
cơ sở dữ liệu. Bản cập nhật này chưa được đưa lên GitHub.

## Kiểm tra

- 180 bài kiểm tra backend; 19 bài kiểm tra frontend.
- Build TypeScript/Vite thành công.
- Kiểm tra giao diện bằng Edge trên dữ liệu thử riêng: xem/hủy/xác nhận
  xóa kênh, giữ nguồn thư viện, tạo dự án từ ý tưởng khác, không tạo trùng,
  giữ nguyên video và nội dung cũ, popup Tiếng Việt.
