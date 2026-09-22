# Cập nhật logo và icon StoryForge

Bản này sử dụng nguyên hình trong `assets/storyforge.ico` do người dùng cung cấp.

- Logo trong app và biểu tượng tab trình duyệt.
- Icon Windows của StoryForge.exe và bộ cài.
- Icon extension ở thanh công cụ, trang quản lý extension và cửa sổ popup.

Giữ nguyên chức năng, bản dịch Tiếng Việt, cấu hình, quyền extension và dữ liệu người dùng.

## Sử dụng

Mở StoryForge như bình thường. Nếu trang đang mở vẫn hiện logo cũ, nhấn Ctrl+F5.

Với extension đã cài dạng Load unpacked, vào `chrome://extensions` hoặc
`edge://extensions` và nhấn Reload/Tải lại tại StoryForge US Browser Bridge.
Giữ nguyên extension hiện có để giữ khóa ghép nối. Nếu extension được nạp từ
một bản sao ở thư mục khác, chép nội dung bản extension mới đè vào đúng thư
mục đó rồi nhấn Reload; không cần gỡ extension.

Các gói mới nằm trong thư mục `release`:

- `StoryForge-US-3.0.0-Logo-Setup.exe`
- `StoryForge-US-3.0.0-Logo-Portable.zip`
- `StoryForge-US-3.0.0-Logo-Source.zip`
- `StoryForge-Browser-Bridge-1.0.0-Logo.zip`
- `SHA256SUMS-Logo.json`

## Build lại

`scripts/create_icon.py` sao chép nguyên ICO cho Windows/favicon và xuất các
khung PNG có sẵn trong ICO cho logo app và extension. `build_windows.ps1`
chạy bước này trước khi build giao diện. Khi thay ICO nguồn, chạy build đầy
đủ để đồng bộ cả giao diện và file EXE.
