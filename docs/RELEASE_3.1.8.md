# StoryForge 3.1.8 — bản cục bộ

Các thay đổi của bản cục bộ 3.1.8 được tích hợp trong bản phát hành 3.1.9 trên GitHub.

- Trong **Đạo diễn hình ảnh**, chọn **Tiêu chuẩn**, **Tối thiểu · giảm khoảng 50% ảnh/video**, hoặc **Tự chọn số lượng**. Chế độ tối thiểu giảm một nửa số ảnh và số video so với tiêu chuẩn, làm tròn lên. Tối thiểu 1 ảnh; có thể chọn 0 video. Tổng tối đa 200 tài nguyên. Số lượng được đưa vào prompt, kiểm tra trước khi lưu kết quả và lưu riêng cho dự án.
- AI tập trung vào diễn biến chính, quyết định, cao trào và hé lộ; ảnh giữ lâu hơn để phủ lời đọc. Video scene giữ mốc bắt đầu và thời lượng gốc, không lặp. Việc đổi chế độ chỉ áp dụng khi bấm **Tạo kế hoạch hình ảnh**; kế hoạch mới thay liên kết scene, còn file đã tải lên được giữ lại.
- Tên scene hiển thị theo `scene_001`, `scene_002`… Các scene cũ cũng hiển thị theo tên này; ID và file tài nguyên cũ được giữ nguyên.
- Render tự kiểm tra NVENC/Intel Quick Sync và chọn bộ mã hóa hoạt động được. Driver không tương thích hoặc GPU gặp lỗi thì dùng CPU. Có lựa chọn **Chỉ dùng CPU** trong **Thiết lập → Sản xuất**.
- Giữ mặc định 1920×1080, 30fps, H.264. GPU dùng VBR mục tiêu 5 Mbps, tối đa 7,5 Mbps; CPU dùng CRF 20, giới hạn đỉnh 7,5 Mbps. AAC 160 kbps. Độ phân giải/FPS người dùng đã đặt được giữ nguyên.
- Tối đa 2 scene được dựng cùng lúc; dùng lại scene đã dựng nếu nguồn, thời lượng, hiệu ứng và kích thước không đổi. Thay logo/sóng nhạc/phụ đề không buộc dựng lại các scene. Cache nằm trong thư mục render riêng của dự án và được đưa vào tùy chọn dọn dữ liệu dự án.
- Giữ nguyên thumbnail cuối video, phụ đề, Sóng nhạc nền xanh dưới logo và lớp PNG nguyên kích thước/vị trí.

## Kết quả mẫu trên máy hiện tại

Mẫu 20 giây, 1080p/30fps, 8 scene (ảnh/video xen kẽ), có chuyển cảnh giữa ảnh, không phụ đề/lớp phủ:

| Cách dựng | Thời gian |
|---|---:|
| 3.1.7 | 16,61 giây |
| 3.1.8 lần đầu (Intel Quick Sync) | 13,61 giây |
| 3.1.8 dựng lại (dùng cache) | 6,36 giây |

SSIM so với video 3.1.7: 0,981785. Mẫu này xác nhận cải thiện tốc độ và độ tương đồng hình ảnh trên một trường hợp; không phải mức tăng tốc bảo đảm cho mọi máy hoặc mọi video. Tất cả kiểm tra thời lượng, FPS, kích thước và âm thanh của mẫu đều đạt.

Bấm F5 sau khi cập nhật app. Video đã dựng cần **Dựng lại video** để áp dụng bộ mã hóa mới. Căn thời điểm lời nói vẫn theo mốc scene/âm thanh đã đồng bộ; không bổ sung căn âm vị tự động.
