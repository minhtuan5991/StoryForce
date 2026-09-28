# StoryForge 3.1.3

Sửa lỗi ChatGPT đã trả lời xong nhưng StoryForge vẫn chờ lấy kết quả. Bao gồm Browser Bridge **1.1.8**.

- Nhận diện cấu trúc câu trả lời mới của ChatGPT; đọc đủ nội dung và phân biệt đúng câu trả lời với prompt, phần suy nghĩ và các nút thao tác.
- Khi Markdown làm mất ký tự escape của JSON, lấy nội dung gốc từ nút Sao chép của đúng câu trả lời. Không tự sửa hoặc viết lại nội dung truyện.
- Tự kết nối lại khi thao tác đọc tab bị treo hoặc mất kết nối, trong giới hạn chờ hiện có. Không gửi lại prompt chỉ vì lỗi kết nối lúc thu kết quả.
- Tự tiếp tục một lượt thu kết quả đã tạm dừng từ bản cũ; vẫn chỉ đóng tab riêng của tác vụ sau khi backend đã nhận kết quả.
- Ghi rõ nguồn nhận kết quả tự động/thủ công trong nhật ký để kiểm tra chính xác.
- Các tính năng, dữ liệu dự án và cài đặt khác giữ nguyên.

## Cập nhật

1. Mở **Thiết lập → Chung → Kiểm tra bản cập nhật**, tải bản **3.1.3**, rồi **Stop → Start** để áp dụng. Hoặc tải bộ cài bên dưới và cài đè vào thư mục app hiện tại.
2. Trong Comet, mở `chrome://extensions`, tìm **StoryForge US Browser Bridge**, bấm **Reload / Tải lại** và kiểm tra phiên bản **1.1.8**.
3. Giữ tab ChatGPT đang chứa câu trả lời. Nếu tác vụ vẫn đang tạm dừng, mở popup Bridge và bấm **Tiếp tục** để lấy câu trả lời đã có.

Nếu extension được nạp từ thư mục riêng ngoài thư mục app, giải nén ZIP Browser Bridge 1.1.8 vào thư mục đó trước khi Reload.

## Kiểm thử

- 34 kiểm thử luồng Bridge: thu kết quả, JSON gốc, mất kết nối, giới hạn chờ, khởi động lại worker, hủy và chống gửi trùng.
- 15 kiểm thử giao diện giả lập trên Comet, gồm cấu trúc ChatGPT quan sát được ngày 28/09/2026.
- 13 kiểm thử backend và cập nhật.
- Bộ thu mới đọc được câu trả lời dài hơn 44.000 ký tự từ bản HTML lưu trên máy khi chẩn đoán. Dữ liệu chẩn đoán riêng tư không nằm trong bản phát hành. Kiểm thử này chưa thay thế xác nhận luồng tự động trên tab thật sau khi Reload.
