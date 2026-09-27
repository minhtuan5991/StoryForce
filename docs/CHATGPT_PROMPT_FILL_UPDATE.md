# Browser Bridge 1.1.7 — Sửa tự nhập prompt và lấy kết quả ChatGPT

Bản sửa dành cho tình huống ChatGPT đã đăng nhập, ô “Hỏi ChatGPT” hiện trống nhưng tác vụ không tự nhập prompt, hoặc AI đã trả lời nhưng app vẫn chờ. Ứng dụng 3.1.2 chứa Browser Bridge 1.1.7 để các máy đang dùng 3.1.1 nhận được cập nhật online.

- Nhận diện thêm ô nhập ChatGPT khi ID/placeholder thay đổi, gồm textarea và các dạng trình soạn thảo rich text. Không chọn ô ẩn, chỉ đọc hoặc đoán giữa nhiều ô không rõ mục đích.
- Chờ ô nhập sẵn sàng; kết nối lại khi trang thay ô soạn thảo hoặc ngắt kết nối trước khi gửi. Giới hạn 8 lần chờ lại và thời gian chờ của tác vụ.
- Kiểm tra toàn bộ nội dung sau khi điền. Bản nháp riêng của người dùng được giữ nguyên, kể cả khi xuất hiện sau lúc trang tải.
- Tiếp tục đọc phản hồi tối đa 15 phút mặc định, tối đa 30 phút nếu thiết lập chờ lớn hơn. Không tự gửi lại vì tác vụ hết thời gian chờ thu kết quả. Đọc đủ các khối của phản hồi mới và nhận diện theo ID khi số lượng phần tử trang không tăng.
- Tác vụ cũ đã gửi và tạm dừng vì giới hạn 3 phút được tiếp tục lấy kết quả một lần sau nâng cấp nếu backend xác nhận lượt gửi. Giữ nguyên tab chứa câu trả lời.
- Tác vụ cũ đang tạm dừng vì không tìm thấy ô nhập/mất kết nối được tiếp tục một lần nếu backend xác nhận chưa cấp lượt gửi. Tác vụ đã gửi hoặc chưa rõ gửi thành công không được tự gửi trùng.
- Các cơ chế thử lại lỗi JSON/nút gửi, Gemini, media và thiết lập hiện có giữ nguyên.

## Áp dụng trên Comet

1. Nếu nhận bản ZIP, giải nén và chép nội dung vào đúng thư mục `browser-extension` mà tiện ích StoryForge đang sử dụng. Có thể xem đường dẫn trong trang quản lý tiện ích khi bật chế độ nhà phát triển.
2. Mở `chrome://extensions` trong Comet, tìm **StoryForge US Browser Bridge**, bấm **Tải lại / Reload**. Xác nhận phiên bản **1.1.7**. Giữ tiện ích hiện có để giữ khóa ghép nối.
3. Giữ tab đang chứa câu trả lời. Trong popup StoryForge Bridge, giữ **Tự động gửi và nhận kết quả** bật. Nếu vẫn tạm dừng, bấm **Tiếp tục** trong popup extension.
4. Nếu extension được nạp từ một thư mục khác với thư mục app, cần cập nhật bản sao đó trước khi Tải lại. Không cần cài lại toàn bộ app cho bản sửa này.

## Kiểm chứng

- 27 kiểm thử trạng thái tự động: chờ ô nhập, mất kết nối, khởi động lại, hủy/tắt, giới hạn thử lại, thu kết quả chậm và chống gửi trùng.
- 13 kiểm thử giao diện tổng hợp chạy bằng Comet trong các phiên thử nghiệm riêng: ô tiếng Việt, rich text, nhiều dòng, tải chậm, thay ô nhập, bản nháp, ô ẩn/chỉ đọc, gửi/nhận, phản hồi nhiều khối và Gemini.
- 13 kiểm thử backend/bộ cập nhật: quyền gửi một lần, hủy, giới hạn, tính nhất quán của thử lại và xác minh gói cập nhật.

Kiểm thử sử dụng dữ liệu và trang giả lập; chưa xác minh trên tab ChatGPT đăng nhập thật của người dùng. Mã nguồn, gói ZIP và các bản sao extension đã cập nhật cần được Comet tải lại trước khi có hiệu lực.
