# StoryForge 3.1.5

Thêm bước chờ ChatGPT/Gemini tải ổn định trước khi tự động điền và gửi prompt. Bao gồm Browser Bridge **1.1.10**.

- Chờ trang báo tải xong, rồi chờ thêm ít nhất **5 giây**.
- Kiểm tra ô nhập có thể chỉnh sửa và ổn định ít nhất **2 giây** trước khi điền prompt. Trong lúc chờ, không focus, sửa nội dung hoặc bấm Gửi.
- Khi trang tải lại hoặc ô nhập được tạo lại, bắt đầu lại khoảng chờ tương ứng.
- Nếu tab không phản hồi, chờ lại có giới hạn và tạm dừng khi hết thời gian; không tự gửi prompt trong lúc kiểm tra trang.
- Giữ nguyên kiểm tra prompt đầy đủ, chống gửi trùng, thu câu trả lời, dữ liệu dự án và các cài đặt khác.

## Cập nhật

1. Vào **Thiết lập → Chung → Kiểm tra bản cập nhật**, tải **3.1.5**, rồi **Stop → Start** để áp dụng. Hoặc cài đè bằng bộ cài bên dưới.
2. Trong Comet, mở `chrome://extensions`, tìm **StoryForge US Browser Bridge**, bấm **Reload / Tải lại**, kiểm tra phiên bản **1.1.10**.
3. Nếu extension được nạp từ thư mục riêng ngoài app, cập nhật thư mục đó bằng ZIP Browser Bridge 1.1.10 rồi Reload.

Khoảng chờ giúp tránh thao tác quá sớm khi trang đang khởi tạo; không đảm bảo khắc phục mọi nguyên nhân khiến trình duyệt bị đơ.

## Kiểm thử

37 kiểm thử luồng Bridge, 19 kiểm thử giao diện giả lập trên Comet và 13 kiểm thử backend/cập nhật đều đạt. Các ca mới kiểm tra trang tải chậm, tải lại, ô nhập được tạo lại, tab không phản hồi, khởi động lại worker và hủy/tắt tự động trong lúc chờ. Kiểm thử không gửi prompt lên tài khoản AI thật.
