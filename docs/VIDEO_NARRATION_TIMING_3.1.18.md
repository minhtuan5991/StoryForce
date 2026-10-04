# Thời lượng lời kể cho scene video · v3.1.18

Khi tạo kế hoạch hình ảnh mới, mỗi scene video được dành phần lời kể ít nhất 10 giây. Trước khi có đủ âm thanh, app tính theo tốc độ đọc của dự án: 150 từ/phút tương ứng tối thiểu 25 từ cho video 10 giây. App giữ nguyên số scene, thứ tự và toàn bộ lời kể; chỉ cân đối ranh giới giữa các scene khi cần.

Lần đồng bộ đầu tiên kiểm tra lại bằng thời lượng WAV đo bởi ffprobe. Nếu video đã được gán dài hơn 10 giây, phần lời kể phải đủ độ dài thực của video. Video phát một lần ở tốc độ gốc; phần ảnh phủ thời gian còn lại. Các scene video đã đồng bộ giữ vị trí bắt đầu. Nếu âm thanh thay đổi làm phần lời kể ngắn hơn video, app yêu cầu xem lại kế hoạch hoặc âm thanh.

Nếu không đủ lời kể để đáp ứng số video đã chọn, app báo lỗi trước khi thay kế hoạch cũ. Đoạn cảm ơn cuối video không được dùng để bù thời lượng thiếu của các scene trong câu chuyện. Thời điểm từ vẫn được nội suy trong từng đoạn WAV; đây không phải căn chỉnh lời nói đến từng âm tiết.

Kế hoạch cũ và tài nguyên đang gán được giữ lại. Để áp dụng cách chia mới, tạo kế hoạch mới sau khi đã chuẩn bị âm thanh đầy đủ. Không cần tạo lại kế hoạch chỉ để điều chỉnh thời lượng các scene ảnh theo các WAV được thay thế.

## Khi các scene đầu gần như bằng không

Timeline dùng thời lượng thật của file âm thanh, không dùng thời lượng mục tiêu của dự án để kéo dài lời kể. WAV chỉ chứa 0,04–0,08 giây vẫn có thể là file WAV hợp lệ nhưng không chứa đủ lời kể. Kiểm tra và tạo/tải lại các đoạn này trong Xưởng giọng đọc, gán đúng WAV rồi bấm Đồng bộ theo âm thanh thực. Không thể khôi phục lời kể bằng cách kéo dài ảnh hoặc chia đều timeline.

## Kiểm tra

- Tốc độ đọc 90, 150 và 240 từ/phút; số scene và thứ tự từ được giữ nguyên.
- Đoạn âm thanh nhanh/chậm khác nhau; video 10 hoặc 12 giây giữ độ dài gốc.
- Lời kết không bù thiếu thời gian; kế hoạch không đủ lời kể không xóa tài nguyên cũ.
- Đồng bộ với WAV thật, lưu ranh giới mới; đồng bộ lại không di chuyển video.
