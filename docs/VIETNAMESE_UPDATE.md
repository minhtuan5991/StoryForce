# Bản cập nhật ngôn ngữ giao diện — StoryForge US 3.0.0 VI

## Cách dùng

1. Mở StoryForge như trước. Nếu đang mở trang, tải lại bằng Ctrl+F5.
2. Ở thanh bên, chọn **Interface language → Tiếng Việt**.
3. Hoặc vào **Settings → General → Interface language → Tiếng Việt**.
4. Đổi lại **English** bất cứ lúc nào. Lựa chọn được nhớ trong trình duyệt trên máy này, không cần bấm Save settings.

Khi dùng cửa sổ hẹp, mở nút menu để thấy bộ chọn ngôn ngữ.

## Phạm vi cập nhật

- Bổ sung nhãn, điều hướng, thông báo giao diện và hướng dẫn sử dụng bằng tiếng Việt.
- Mặc định vẫn là English cho trình duyệt chưa chọn ngôn ngữ.
- Không dịch hoặc ghi đè tên kênh, tên dự án, nội dung truyện, kết quả AI, prompt, JSON đang chỉnh hay dữ liệu của bạn.
- Không đổi ngôn ngữ lời kể, giọng đọc, nhà cung cấp, chế độ pipeline hoặc các thiết lập sản xuất.
- Backend, launcher, Browser Bridge và các mẫu prompt gốc giữ nguyên. Tiện ích Browser Bridge và thông báo kỹ thuật nguyên bản của nhà cung cấp vẫn có thể dùng tiếng Anh.
- Chọn ngôn ngữ không tải lại trang nên nội dung biểu mẫu đang nhập được giữ lại.

## Bản bàn giao

- `StoryForge-US-3.0.0-VI-Setup.exe`: bộ cài có thêm giao diện tiếng Việt. Chọn đúng thư mục ứng dụng cũ nếu dùng để cập nhật. Dữ liệu tiếp tục nằm trong thư mục cũ.
- `StoryForge-US-3.0.0-VI-Portable.zip`: bản portable, giữ nguyên bộ thực thi hiện tại và bổ sung giao diện đã dịch.
- `StoryForge-US-3.0.0-VI-Source.zip`: mã nguồn bản cập nhật.
- `SHA256SUMS-VI.json`: checksum các gói cập nhật.

Bản ứng dụng trong `release/StoryForge` của workspace này đã được cập nhật giao diện; shortcut Start/Stop cũ vẫn dùng được. Không cần cài lại trên máy hiện tại.

## Kiểm thử

- Biên dịch TypeScript + Vite: đạt.
- 4 unit tests giao diện: đạt.
- 4 E2E trên Edge: đạt; gồm luồng tạo truyện cũ, chuyển ngôn ngữ, nhớ lựa chọn, biểu mẫu, dữ liệu nguyên bản và giá trị API.
- Kiểm thử chuyển ngôn ngữ xác nhận không phát sinh yêu cầu ghi API; settings, danh sách dự án và prompt giữ nguyên.
- Các tệp backend, launcher, prompt, fixtures, Browser Bridge và tệp thực thi Windows được đối chiếu SHA-256 với bản trước cập nhật.

Lệnh kiểm thử từ thư mục mã nguồn (dừng ứng dụng ở cổng 8787 trước khi chạy E2E):

```powershell
npm --prefix frontend test
npm --prefix frontend run test:e2e
```
