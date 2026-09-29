# StoryForge 3.1.6

- Mỗi scene nhận ảnh hoặc video đã gán, bất kể tên file hay loại hình dự kiến trong kế hoạch. Tên chuẩn chỉ giúp tự gán khi nhập.
- Khi dựng, đồng bộ timeline theo thời lượng âm thanh thực. Video ngắn được lặp để phủ scene và chuyển cảnh, không bắt buộc PNG dự phòng. Nếu đã gán ảnh dự phòng, vẫn dùng ảnh đó cho phần còn lại.
- Tài nguyên có checkbox, chọn tất cả, xóa các mục đã chọn hoặc xóa toàn bộ, kèm xác nhận. Xóa liên kết và bản sao nhập riêng; giữ file gốc, file dùng chung và video đã dựng. Chặn xóa khi tác vụ đang chạy.
- Dựng & kiểm tra có **Thêm phụ đề**, **Sóng nhạc** (thay phụ đề), **Lớp phủ**. Logo chọn từ ảnh trong Tài nguyên, nằm ở góc trên bên phải và trên cùng các lớp.
- Tùy chọn lưu riêng từng dự án. Mặc định vẫn thêm phụ đề như trước. Có thể tắt cả phụ đề lẫn sóng nhạc. File SRT/VTT riêng vẫn được tạo.
- Bấm **Dựng lại video** sau khi đổi tài nguyên hoặc tùy chọn. Bản dựng cũ được giữ cho đến khi bản mới hoàn tất.

Browser Bridge giữ nguyên 1.1.10. Không thay đổi prompt hoặc các bước phát triển/kiểm định truyện.

## Cập nhật

Vào **Thiết lập → Chung → Kiểm tra bản cập nhật**, tải bản mới rồi **Stop → Start**. Hoặc tải bộ cài bên dưới và cài đè vào thư mục app hiện tại. Sau khi mở app, tải lại trang bằng **F5**.

Nếu Browser Bridge đã là **1.1.10** thì không cần đổi extension. Với bản cũ hơn, cập nhật bằng ZIP bên dưới và bấm Reload trong trang quản lý extension.

## Kiểm thử

33 kiểm thử backend/media, 4 kiểm thử thành phần giao diện và 2 luồng kiểm thử trên Comet đã đạt, bao gồm dựng video bằng FFmpeg thật với video ngắn, phụ đề, sóng âm và logo.
