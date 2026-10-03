# StoryForge 3.1.16 / Browser Bridge 1.1.14

## Kết quả kiểm tra thật

Kiểm tra bằng hai dự án chẩn đoán riêng trên app đang chạy 3.1.14, với mã Bridge được sửa tại máy này. Không thay đổi truyện hoặc tài nguyên của dự án người dùng.

| Dịch vụ | File tải và gán thật | Kết quả |
| --- | --- | --- |
| AI Studio | `tts_001.wav`, `tts_002.wav` | Enzo / Friendly; 7,44 và 5,28 giây; PCM 16-bit, mono, 24 kHz; hoàn tất 2/2 |
| Gemini | `thumbnail.png`, `scene_001.png` | PNG đầy đủ 2752 × 1536; hoàn tất tải và gán |
| Flow | `scene_002.mp4`, `scene_003.mp4` | Omni 1.1 Flash; 1280 × 720; video 10 giây, container 10,005 giây; H.264 / AAC; hoàn tất tải và gán |

Người dùng cho phép giả lập số lượng. Batch hình gồm **2 ảnh (thumbnail + một ảnh scene), 2 video**, hoàn tất **4/4**. Hai prompt hình dùng cùng tab Gemini; hai video được tạo liên tiếp trong cùng một dự án/tab Flow. Các job đều có attempt 1 và dấu xác nhận Send; file tải có ID riêng, được kiểm tra trước khi gán vào đúng thumbnail/scene.

File nằm tại `C:/Users/Admin/Downloads/Studio Light Test`; âm thanh tại `C:/Users/Admin/Downloads/Bridge Download Test 2026-10-03`. Bản ghi kiểm tra kèm bản phát hành ghi checksum, metadata, ID tải, ID job và ID tài nguyên.

Trong lúc chẩn đoán đã dùng Reload và nút Tiếp tục để phục hồi hàng đợi. Có một lần bấm Download thủ công trên thumbnail để xác định cách Gemini tải qua iframe sandbox; **file thumbnail cuối cùng được đặt tên, tải và gán bằng Bridge sau bản sửa**, không gửi lại prompt. Không bấm Send/Run/Download thủ công cho ảnh scene hoặc hai video thành công. Lần đóng trình duyệt giữa bước cài đặt Flow được phục hồi trước Send; không tạo trùng video.

## Các lỗi được sửa

- Bỏ qua ô clipboard Quill ẩn của Gemini khi tìm ô nhập prompt, vẫn từ chối nếu có nhiều ô nhập thực sự.
- Gemini gửi PNG đầy đủ cho iframe sandbox, khác URL ảnh xem trước. Bridge chỉ nhận đúng thông điệp tải PNG đó, tạo URL blob có thể tải, đặt tên theo dự án/scene và tránh tải trùng. Không đọc lưu lượng mạng, cookie hay dữ liệu tài khoản.
- Nút model Flow có tên truy cập chung nhưng chữ hiển thị là Omni 1.1 Flash. Đọc và kiểm tra chữ hiển thị, tránh lặp mở menu model; xác minh Video / Ingredients / 16:9 / 720p / 10 giây / x1.
- Khi app tạm offline, giữ nguyên bước cần tiếp tục. Tìm đúng lượt tải nếu ID chưa được ghi; chỉ tải lại kết quả sẵn có khi lượt tải bị hủy hoặc không xuất hiện.
- Lưu URL dự án Flow ngay trong bước chuẩn bị. Khi tab chưa gửi bị đóng, chỉ mở lại URL đã ghi cho cùng dự án và chờ trang tải xong. Claim đã gửi không được quay lại bước tạo.

## Sử dụng

1. Dùng bản cài 3.1.16; Bridge kèm theo là 1.1.14. Nếu tiện ích hiện tại dùng thư mục riêng, giải nén ZIP mới thay nội dung thư mục đó.
2. Trong Comet Extensions, bấm **Reload** tiện ích hiện có để giữ khóa ghép nối. Phiên bản phải là **1.1.14**.
3. Trong **Settings → Downloads**, tắt **Ask where to save each file before downloading** để tải không cần Save As. Đây là thiết lập tải file của trình duyệt; không đổi thiết lập bảo mật.
4. Giữ app và trình duyệt chạy; bật **Tự động gửi, nhận và tải tài nguyên**. Âm thanh chạy ngay khi khởi chạy TTS; ảnh/video chỉ chạy sau khi xác nhận số lượng.
5. Nếu kết quả đã tạo nhưng tải bị gián đoạn, dùng **Tiếp tục tải tài nguyên**; Bridge lấy lại kết quả sẵn có.

Kiểm thử hồi quy: 165 backend, 16 frontend, 66 Bridge; build frontend thành công. Giữ các chức năng và cài đặt khác; bản này chưa xuất bản lên GitHub.
