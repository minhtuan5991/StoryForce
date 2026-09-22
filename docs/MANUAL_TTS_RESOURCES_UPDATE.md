# Xác nhận tài nguyên TTS làm thủ công

Trong **Hoạt động & tác vụ**, tác vụ **Ngữ cảnh TTS** đang chờ có nút **Đã tải đủ tài nguyên**.

1. Tải các file âm thanh, ảnh và video vào **Tài nguyên**, gắn đúng đoạn TTS và cảnh.
2. Bấm **Đã tải đủ tài nguyên**. App kiểm tra file tồn tại, âm thanh có thời lượng, phiên bản còn phù hợp và các cảnh đã có tài nguyên. Chế độ ảnh giữ chỗ không thay thế file còn thiếu trong kiểm tra này.
3. Nếu thiếu, popup liệt kê file và có nút **Mở Tài nguyên** để bổ sung.
4. Nếu đủ, tác vụ TTS chuyển sang Hoàn thành; app bắt đầu **Đồng bộ** và mở trang **Dòng thời gian**. File đã tải lên được giữ nguyên, không gọi lại Google AI Studio.

Việc này chưa tự dựng video. Sau đồng bộ, kiểm tra thời lượng các cảnh, bổ sung ảnh dự phòng cho video ngắn nếu cần, rồi sang **Dựng & kiểm tra**.

Không cần cập nhật extension cho thay đổi này.
