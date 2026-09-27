# Browser Bridge 1.1.6 — Sửa tự nhập prompt ChatGPT

Bản sửa dành cho tình huống ChatGPT đã đăng nhập, ô “Hỏi ChatGPT” hiện trống nhưng tác vụ không tự nhập prompt. Ứng dụng 3.1.2 chứa Browser Bridge 1.1.6; tăng phiên bản ứng dụng để các máy đang dùng 3.1.1 nhận được cập nhật online.

- Nhận diện thêm ô nhập ChatGPT khi ID/placeholder thay đổi, gồm textarea và các dạng trình soạn thảo rich text. Không chọn ô ẩn, chỉ đọc hoặc đoán giữa nhiều ô không rõ mục đích.
- Chờ ô nhập sẵn sàng; kết nối lại khi trang thay ô soạn thảo hoặc ngắt kết nối trước khi gửi. Giới hạn 8 lần chờ lại và thời gian chờ của tác vụ.
- Kiểm tra toàn bộ nội dung sau khi điền. Bản nháp riêng của người dùng được giữ nguyên, kể cả khi xuất hiện sau lúc trang tải.
- Tác vụ cũ đang tạm dừng vì không tìm thấy ô nhập/mất kết nối được tiếp tục một lần nếu backend xác nhận chưa cấp lượt gửi. Tác vụ đã gửi hoặc chưa rõ gửi thành công không được tự gửi trùng.
- Các cơ chế thử lại lỗi JSON/nút gửi, Gemini, media và thiết lập hiện có giữ nguyên.

## Áp dụng trên Comet

1. Nếu nhận bản ZIP, giải nén và chép nội dung vào đúng thư mục `browser-extension` mà tiện ích StoryForge đang sử dụng. Có thể xem đường dẫn trong trang quản lý tiện ích khi bật chế độ nhà phát triển.
2. Mở `chrome://extensions` trong Comet, tìm **StoryForge US Browser Bridge**, bấm **Tải lại / Reload**. Xác nhận phiên bản **1.1.6**. Giữ tiện ích hiện có để giữ khóa ghép nối.
3. Tải lại tab ChatGPT. Trong popup StoryForge Bridge, giữ **Tự động gửi và nhận kết quả** bật. Nếu vẫn tạm dừng, bấm **Tiếp tục** trong popup extension.
4. Nếu extension được nạp từ một thư mục khác với thư mục app, cần cập nhật bản sao đó trước khi Tải lại. Không cần cài lại toàn bộ app cho bản sửa này.

## Kiểm chứng

- 23 kiểm thử trạng thái tự động: chờ ô nhập, mất kết nối, khởi động lại, hủy/tắt, giới hạn thử lại và chống gửi trùng.
- 11 kiểm thử giao diện tổng hợp chạy bằng Comet trong các phiên thử nghiệm riêng: ô tiếng Việt, rich text, nhiều dòng, tải chậm, thay ô nhập, bản nháp, ô ẩn/chỉ đọc, gửi/nhận và Gemini.
- 6 kiểm thử backend: quyền gửi một lần, hủy, giới hạn và tính nhất quán của thử lại.

Kiểm thử sử dụng dữ liệu và trang giả lập; chưa xác minh trên tab ChatGPT đăng nhập thật của người dùng. Mã nguồn, gói ZIP và các bản sao extension đã cập nhật cần được Comet tải lại trước khi có hiệu lực.
