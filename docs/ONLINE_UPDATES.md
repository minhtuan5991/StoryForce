# Cập nhật online từ GitHub

Repository chính thức: https://github.com/minhtuan5991/StoryForce

## Máy sử dụng app

- Trong **Thiết lập → Chung → Cập nhật ứng dụng**, bấm **Kiểm tra bản cập nhật** để kiểm tra ngay, bỏ qua thời gian chờ 6 giờ. Trạng thái kiểm tra/tải hiển thị ở đây. Khi sẵn sàng, Stop rồi Start để cài hoặc bấm **Tải bộ cài đã sẵn sàng** để cài thủ công.
- Bản 3.1.1 được bổ sung nút này nhưng giữ nguyên số phiên bản theo yêu cầu. Nếu đã cài 3.1.1 trước đó, tải lại Setup từ GitHub và cài đè một lần để nhận giao diện mới; bộ cập nhật chỉ tự tải phiên bản có số cao hơn.

- Cài bản 3.1.0 hoặc mới hơn một lần. Các bản 3.0.0 chưa có bộ cập nhật.
- Bản đã cài bằng Setup tự kiểm tra GitHub khi mở app, tối đa một lần mỗi 6 giờ. App vẫn hoạt động nếu mất mạng.
- Bản mới được tải ở nền vào `StoryForge US Data/updates`, không gửi nội dung dự án, media hoặc tài khoản AI lên GitHub.
- Sau khi tải và xác minh SHA256, bản mới được cài khi **Stop rồi Start lại app**. Không tự dừng tác vụ đang chạy.
- Trước khi cài, app sao lưu SQLite vào `backups/pre-update-*.db`; file media và cấu hình vẫn giữ nguyên.
- Nếu cài thất bại, app không lặp cài mãi. Xem `updates/install-result.json` và `updates/installer.log`, hoặc tải Setup mới nhất từ GitHub Releases để cài lại.
- Bản portable chạy trực tiếp từ mã nguồn không tự cài đè. Dùng bộ cài Setup để bật cập nhật online.
- Khi bản cập nhật thay đổi Browser Bridge, mở trang tiện ích của Comet/Chrome và bấm **Reload** cho StoryForge Bridge. Extension dạng Load unpacked cần bước này.

## Phát hành bản tiếp theo

1. Tăng phiên bản `X.Y.Z` trong `backend/config.py`, `installer/StoryForge.iss` và `frontend/package.json`/lockfile.
2. Chạy kiểm thử và build Windows. Tên bộ cài bắt buộc: `StoryForge-US-X.Y.Z-Setup.exe`.
3. Commit và push mã nguồn. Tạo GitHub Release **stable** với tag `vX.Y.Z`, đính kèm bộ cài tương ứng. Có thể dùng `scripts/publish_github_release.ps1`.
4. Giữ bản phát hành ở Draft trong khi tải bộ cài; chỉ Publish khi tải xong. Bộ cập nhật bỏ qua Draft/Prerelease.
5. GitHub cung cấp SHA256 của asset; app kiểm tra digest và kích thước trước khi cài. Không phát hành lại nội dung khác dưới cùng phiên bản; hãy tăng phiên bản.

Chỉ mã nguồn ứng dụng và bộ cài được phát hành. Không đưa thư mục dữ liệu, `.env`, khóa bí mật, cookie, log riêng hoặc dự án người dùng lên repository công khai.
