# Cập nhật tự động và duyệt khóa truyện

- Trang Hoạt động & tác vụ có nút **Về Tổng quan**. Khi mở từ dự án, nút trở về đúng dự án đó.
- Browser Bridge 1.1.4 kiểm tra nút gửi tối đa 5 lần, trong giới hạn thời gian chờ của tác vụ. Chỉ gửi khi nội dung vẫn khớp, tab không có câu trả lời mới và nút gửi sẵn sàng.
- Khi câu trả lời chưa phải JSON, extension tiếp tục đọc kết quả tối đa 5 lần (cách nhau ít nhất 5 giây), trong thời gian chờ. Không gửi lại prompt. Nếu AI trả về văn bản sai định dạng hoàn toàn, cần sửa/lấy lại kết quả trên tab AI rồi tiếp tục trong extension.
- Nhận diện thêm nút Gemini **Ngừng tạo câu trả lời**, tránh lấy nội dung khi AI vẫn đang tạo.
- Sau khi backend chấp nhận và lưu kết quả, extension đóng tab riêng do tác vụ tự động tạo. Tab có lỗi được giữ lại. Tab đã chuyển sang cuộc trò chuyện khác không bị đóng.
- Có thể **Duyệt khóa truyện** khi còn cảnh báo: đọc popup rồi chọn **Xác nhận khóa truyện dù còn cảnh báo**. Quyết định và cảnh báo được lưu theo phiên bản; kết quả kiểm định AI không bị sửa thành đạt. Cần có bản nháp và hoàn thành/hủy tác vụ đang hoạt động trước khi khóa.
- Nếu bản nháp hoặc kiểm định thay đổi trong lúc popup mở, app yêu cầu mở lại cảnh báo để xác nhận dữ liệu mới.

## Áp dụng

Mở lại StoryForge và tải lại trang app. Trong Comet, mở trang Extensions, tìm **StoryForge US Browser Bridge**, bấm Reload và kiểm tra phiên bản **1.1.4**. Nếu extension cũ đang tạm dừng, bấm tiếp tục trong popup extension. Không dùng nút Thử lại tác vụ để thay thế việc tiếp tục lấy một câu trả lời đã gửi.

Không tự động khóa dự án hiện tại: người dùng xác nhận trực tiếp trong popup mới.
