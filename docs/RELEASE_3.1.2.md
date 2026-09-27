# StoryForge 3.1.2

Sửa lỗi ChatGPT mở tab nhưng không tự nhập prompt. Bao gồm Browser Bridge 1.1.6.

- Hỗ trợ thêm các dạng ô nhập ChatGPT, gồm giao diện tiếng Việt và rich text.
- Tự chờ/kết nối lại có giới hạn khi ô nhập tải chậm hoặc kết nối tab bị ngắt trước khi gửi.
- Kiểm tra prompt đã điền đầy đủ, giữ bản nháp riêng và tránh gửi trùng.
- Các chức năng, dữ liệu dự án và cài đặt khác giữ nguyên.

## Cập nhật

1. Trong app, mở **Thiết lập → Chung → Kiểm tra bản cập nhật**. Hoặc chờ app kiểm tra khi khởi động, tối đa mỗi 6 giờ.
2. Khi tải xong, **Stop rồi Start** để cài bản 3.1.2.
3. Trong Comet, mở `chrome://extensions`, tìm **StoryForge US Browser Bridge** và bấm **Reload / Tải lại**. Kiểm tra phiên bản extension **1.1.6**, rồi tải lại tab ChatGPT.
4. Nếu cần, mở popup extension và bấm **Tiếp tục**. Giữ chế độ tự động bật.

Có thể tải bộ cài bên dưới và cài đè vào thư mục app hiện tại. Nếu extension được nạp từ thư mục riêng ngoài thư mục app, cập nhật thư mục đó bằng ZIP Browser Bridge 1.1.6 trước khi Reload.

Đã kiểm thử luồng Bridge, bảo vệ lượt gửi, và các giao diện giả lập bằng Comet. Kiểm thử giả lập không thay thế việc xác nhận trên giao diện ChatGPT thật sau khi Reload.
