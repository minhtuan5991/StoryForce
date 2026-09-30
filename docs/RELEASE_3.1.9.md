# StoryForge 3.1.9

Bao gồm các cải tiến của bản 3.1.8: chọn số ảnh/video theo dự án (tiêu chuẩn, giảm khoảng 50%, hoặc tự chọn); tên scene_001; tăng tốc GPU và cache scene; H.264 1080p/30fps, VBR mục tiêu 5 Mbps khi dùng GPU và AAC 160 kbps. Các thiết lập kích thước/FPS đã lưu được giữ nguyên.

- **Sóng nhạc:** lấy mẫu ba thời điểm của file và nhận màu nền xanh thực tế, thay cho màu xanh thuần cố định. Giữ nguyên kích thước, vị trí, tốc độ hoạt ảnh; chỉ lớp sóng nhạc lặp và nằm dưới logo. File không có nền xanh rõ ràng sẽ báo lỗi thay vì phủ kín video.
- **Dựng & kiểm tra:** ghép theo nhóm tối đa sáu clip rồi ghép các nhóm, giữ đúng mốc khung hình, chuyển cảnh và thời lượng video. Bước cuối chỉ mở một video nền đã ghép để thêm sóng nhạc/logo/phụ đề.
- Không ngắt render đang tiến triển vì đã chạy đủ bốn giờ. FFmpeg được theo dõi bằng số khung hình/thời gian video; dừng và báo rõ nếu không tiến triển trong 15 phút. Nhật ký vẫn lưu chi tiết lỗi. Bản video hoàn chỉnh trước đó được giữ lại khi lần dựng mới thất bại.
- Nhóm chuyển cảnh dùng CPU với preset ultrafast để tránh lỗi đổi màu của một số driver Intel Quick Sync; dựng scene và mã hóa cuối vẫn hỗ trợ GPU. File ghép tạm được dọn sau khi kiểm tra kỹ thuật thành công; cache scene được giữ để dựng lại nhanh.
- Không thay đổi tài nguyên đã gán hay các nội dung truyện. Video cũ có nền xanh hoặc file MP4 chưa hoàn tất cần bấm **Dựng lại video** sau khi cập nhật; thay đổi này không sửa trực tiếp file xuất cũ.

Kiểm thử gồm nền xanh đậm, vòng lặp hoạt ảnh, lớp logo trên sóng nhạc, video giữ vị trí/thời lượng, chuyển cảnh qua ranh giới nhóm, 48 scene, phụ đề, CPU/GPU fallback, tác vụ tiến triển lâu hơn khoảng watchdog và tác vụ ngừng tiến triển.

## Cập nhật

Vào **Thiết lập → Chung → Kiểm tra bản cập nhật**. Khi tải xong, dùng **StoryForge Stop** rồi **StoryForge Start** để cài bản mới. Hoặc tải và chạy `StoryForge-US-3.1.9-Setup.exe`. Chờ tác vụ render hoàn thành trước khi dừng app. Dữ liệu dự án được giữ nguyên.

Browser Bridge vẫn là **1.1.10**; không cần cài lại extension nếu đang dùng bản này. Bấm **F5** sau khi cập nhật, rồi **Dựng lại video** cho các video cần sửa nền xanh/lỗi ghép.
