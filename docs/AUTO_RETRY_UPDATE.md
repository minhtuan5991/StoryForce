# Browser Bridge 1.1.5: tự gửi yêu cầu mới sau lỗi

- Khi không có nút gửi sau 5 lần kiểm tra, hoặc câu trả lời vẫn không phải JSON sau các lần chờ, Bridge chờ thêm 30 giây rồi tự chạy lại tác vụ, mở tab mới và gửi yêu cầu mới.
- Tối đa 3 lần tự thử lại cho mỗi tác vụ. Hết giới hạn thì tạm dừng để kiểm tra thủ công; nút Thử lại trong app bắt đầu lượt thử mới.
- Tab gặp lỗi được giữ lại để xem lại. Tab của lượt hoàn thành vẫn được đóng sau khi lưu kết quả thành công.
- Mỗi lượt chỉ gửi một lần. Trạng thái chờ lưu qua lần khởi động lại extension. Hủy tác vụ hoặc tắt Tự động sẽ dừng tự thử lại.
- Lỗi đăng nhập, mất kết nối, gửi không rõ đã thành công chưa và lỗi dữ liệu khác vẫn cần kiểm tra thủ công.
- Sau khi cập nhật app, tải lại extension StoryForge US Browser Bridge trong Comet và xác nhận phiên bản 1.1.5. Giữ chế độ Tự động bật. Tác vụ đang tạm dừng vì hai lỗi trên được tự tiếp tục.

Chính sách này thay thế hướng dẫn “không gửi lại prompt khi JSON lỗi” của bản 1.1.4 theo yêu cầu mới của người dùng. Không thay đổi các cài đặt khác.
