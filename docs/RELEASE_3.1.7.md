# StoryForge 3.1.7

- Video giữ mốc bắt đầu đã đồng bộ và thời lượng video thực. Phát một lần với tốc độ gốc; không lặp, kéo giãn hoặc nối ảnh dự phòng vào clip. Chỉ các scene ảnh giữa những mốc video được co giãn theo âm thanh.
- Chuyển cảnh chỉ áp dụng giữa hai scene ảnh. Mốc clip được căn theo lưới khung hình xuất để tránh sai số cộng dồn; sai số lượng tử tối đa một khung hình.
- Nếu video cuối kết thúc trước âm thanh, dùng thumbnail đã chọn trong **Dựng & kiểm tra → Thumbnail cuối video**, hoặc thumbnail đã tạo của dự án. Nếu chưa có thumbnail, app yêu cầu gán ảnh trước khi dựng. Không tự thay bằng ảnh ngẫu nhiên.
- Nếu video chồng thời gian, dài hơn âm thanh còn lại hoặc có khoảng trống không có scene ảnh, app báo rõ để sửa mốc; không âm thầm cắt hay dời video.
- **Lớp phủ** nhận PNG nền trong suốt có kích thước bằng khung video xuất. Đặt toàn bộ PNG ở tọa độ 0,0; không scale, crop hay dời logo trong ảnh.
- **Sóng nhạc** dùng video nền xanh chọn từ Tài nguyên: tách màu xanh, lặp đủ thời lượng video, giữ nguyên kích thước và tọa độ 0,0. Lớp này nằm dưới logo; không lấy âm thanh từ video nền xanh. Video phải có kích thước bằng khung hình xuất.
- Các lựa chọn phụ đề, xóa tài nguyên và Browser Bridge giữ nguyên.

Bấm **Dựng lại video** sau khi thay đổi lựa chọn. Việc giữ mốc scene không thay thế căn chỉnh âm vị; các mốc chia theo số từ vẫn là ước tính theo lời đọc.

## Cập nhật

Vào **Thiết lập → Chung → Kiểm tra bản cập nhật** hoặc tải và chạy `StoryForge-US-3.1.7-Setup.exe`. Dữ liệu dự án được giữ nguyên. Browser Bridge vẫn là 1.1.10; không cần cài lại extension nếu đang dùng phiên bản này.
