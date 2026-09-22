# StoryForge US 3.0

Ứng dụng Windows/local-first quản lý quy trình sản xuất truyện kể tiếng Anh: nhiều kênh → nguồn → Story DNA → premise → Story Bible → outline → draft → cross-model QA → Story Lock → TTS/visuals → FFmpeg → phân tích kết quả.

**Không cần API trả phí.** Mặc định dùng mock fixtures để thử quy trình offline. Đổi sang Browser Bridge để làm việc với tài khoản ChatGPT, Gemini, AI Studio và Flow đang đăng nhập trong trình duyệt của bạn.

## Chạy bản Windows

1. Mở `release/StoryForge-US-3.0.0-Setup.exe`, chọn thư mục cài trên ổ bất kỳ.
2. Dùng shortcut **StoryForge US** trên Desktop hoặc **Start StoryForge** trong Start Menu.
3. App mở tại `http://127.0.0.1:8787`. Dữ liệu mặc định nằm trong thư mục sibling **StoryForge US Data**.
4. Tạo channel mới, hoặc bấm **Load demo workspace**. Nội dung demo luôn được gắn nhãn, không có số liệu YouTube giả.

Không muốn cài: giải nén `StoryForge-US-3.0.0-Windows-Portable.zip` vào thư mục có quyền ghi, chạy `StoryForge.exe`.

## Chạy từ mã nguồn

Python 3.11+ và Node.js 20.19+ hoặc 22.12+.

```powershell
cd 'D:\Auto Youtube\storyforge-us'
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
.\.venv\Scripts\python.exe launcher\main.py
```

Python alias trên máy hiện tại trỏ tới bản cài bị thiếu. Môi trường `.venv` đã được tạo từ Python 3.12 đi kèm Codex và đã cài dependencies; bạn có thể dùng trực tiếp `.venv\Scripts\python.exe`.

Phát triển UI: chạy backend bằng lệnh trên với `--no-browser`, sau đó `npm run dev` trong `frontend`. Vite dùng proxy `/api` về cổng 8787.

## Kiểm thử

```powershell
cd 'D:\Auto Youtube\storyforge-us'
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm test
npm run test:e2e
```

Kiểm thử E2E dùng Microsoft Edge và tự mở máy chủ thử nghiệm. Dừng StoryForge đang chạy ở cổng 8787 trước khi chạy E2E. Test FFmpeg tạo WAV và PNG thật, đồng bộ timeline, dựng MP4 và kiểm tra bằng ffprobe. Audio thử là sóng sin, không phải giọng đọc.

## Build Windows

```powershell
cd 'D:\Auto Youtube\storyforge-us'
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1
powershell -ExecutionPolicy Bypass -File .\build_installer.ps1
```

Chi tiết: [BUILD_WINDOWS.md](BUILD_WINDOWS.md). Hướng dẫn sử dụng: [USER_GUIDE.md](USER_GUIDE.md). Kiến trúc: [ARCHITECTURE.md](ARCHITECTURE.md). Phạm vi và giới hạn: [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Những thao tác do người dùng thực hiện

- Đăng nhập, CAPTCHA, quota, chọn giọng, kiểm tra trang AI và tải media.
- Load unpacked extension và ghép khóa local trong Settings.
- Chọn premise, duyệt Story Lock, xem video cuối. Hai checkpoint đầu chỉ tự động khi bật tùy chọn nâng cao.
- Upload YouTube và nhập analytics trong YouTube Studio theo ngày.

Browser Bridge có selector tập trung, timeout, trạng thái job và fallback copy/paste. Selector trên các trang bên thứ ba có thể thay đổi; kết nối tài khoản thật chưa được kiểm thử trong phiên xây dựng này.

## Cấu trúc

`backend/`, `frontend/`, `browser-extension/`, `launcher/`, `installer/`, `prompts/`, `tests/`, `fixtures/`, `scripts/`, `docs/`.

Không lưu mật khẩu/cookies. Chỉ bind loopback. API mutation có token chống CSRF, Bridge cần khóa pairing riêng. FFmpeg dùng danh sách đối số không thông qua shell. Media và ZIP paths được giới hạn trong workspace.
# Cài đặt và cập nhật online

Bộ cài mới nhất: https://github.com/minhtuan5991/StoryForce/releases/latest

Từ bản **3.1.0**, bản cài Windows tự tải cập nhật ở nền và áp dụng khi Stop rồi Start lại app. Lần đầu, cài Setup 3.1.0 vào đúng thư mục app hiện có. Dữ liệu dự án được giữ nguyên. Xem [hướng dẫn cập nhật](docs/ONLINE_UPDATES.md).
