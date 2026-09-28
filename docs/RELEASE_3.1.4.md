# StoryForge 3.1.4

Sửa phần tự động lấy câu trả lời ChatGPT. Bao gồm Browser Bridge **1.1.9** và toàn bộ sửa lỗi của 3.1.3.

- Đọc cấu trúc câu trả lời mới của ChatGPT và lấy JSON gốc khi Markdown làm mất ký tự escape.
- Chờ nút thao tác của câu trả lời hoàn chỉnh trước khi nhận JSON hoặc thử lại. Không nhầm phần suy nghĩ/nội dung đang tạo với câu trả lời cuối.
- Kết nối lại thao tác đọc tab có giới hạn; khôi phục listener sau khi Reload extension. Không gửi lại prompt chỉ vì mất kết nối trong lúc lấy kết quả.
- Giữ nguyên các tính năng, dữ liệu dự án và cài đặt khác.

## Cập nhật

1. Mở **Thiết lập → Chung → Kiểm tra bản cập nhật**, tải **3.1.4**, rồi **Stop → Start** để áp dụng. Hoặc cài đè bằng bộ cài bên dưới.
2. Trong Comet, mở `chrome://extensions`, tìm **StoryForge US Browser Bridge**, bấm **Reload / Tải lại**, kiểm tra phiên bản **1.1.9**.
3. Giữ tab ChatGPT có câu trả lời. Nếu tác vụ đã tạm dừng, bấm **Tiếp tục** trong popup Bridge để đọc kết quả đã có.

Extension nạp từ thư mục riêng ngoài app cần được cập nhật bằng ZIP Browser Bridge 1.1.9 rồi Reload.

## Kiểm tra

34 kiểm thử luồng Bridge và 13 kiểm thử backend/cập nhật đạt. 17 ca giao diện giả lập trên Comet đạt; một ca gặp điều hướng ngoài dự kiến của trình duyệt trong lần chạy chung và đạt khi chạy lại riêng. Đã kiểm tra trên tab ChatGPT thật: đọc đúng câu trả lời hoàn tất và lấy được 44.774 ký tự JSON gốc hợp lệ. Chỉ đọc lại câu trả lời cũ, không gửi prompt hoặc ghi lại kết quả vào tác vụ. Không đưa nội dung chẩn đoán riêng tư vào bản phát hành. Chưa xác nhận trọn vẹn một tác vụ tự động mới trên tài khoản thật.
