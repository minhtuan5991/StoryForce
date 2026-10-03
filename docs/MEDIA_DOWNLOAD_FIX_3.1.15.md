# StoryForge 3.1.15 / Browser Bridge 1.1.13

## Các lỗi đã tái hiện và sửa

- AI Studio giữ bảng chọn giọng mở sau khi chọn Enzo; nút đóng thực tế là **Close panel**. Bridge cũ tiếp tục chọn giọng vì nút Speaker phía sau bảng bị inert.
- Nút style có tên truy cập **Style** dù chữ hiển thị là **Friendly**. Bridge cũ liên tục mở lại menu; menu này còn có ô nhập phụ khiến bước tìm ô lời đọc thất bại.
- Comet bật **Ask where to save each file before downloading** vẫn mở Save As khi Bridge dùng `saveAs:false`. Đây là thiết lập Downloads của trình duyệt, cần tắt để tải không có người thao tác. Không thay đổi thiết lập bảo mật hoặc quyền trang.
- Tiếp tục lượt tải bị hủy phải bỏ ID đã interrupted và tải lại **kết quả đã tạo**. Lượt complete/in_progress vẫn dùng ID hiện có. Không gửi lại prompt hay tạo thêm lượt media khi phục hồi tải.
- Sau Reload, nối lại content script trước khi đọc liên kết tải. Lưu prompt do Bridge điền theo tab để scene tiếp theo có thể thay đúng nội dung cũ qua lần khởi động lại; không xóa nội dung người dùng tự sửa.

## Kiểm tra trên máy này

Dùng một dự án chẩn đoán riêng **Bridge Download Test 2026-10-03**, bản app đang chạy 3.1.14 và tiện ích được cập nhật lên 1.1.13. Hai đoạn lời đọc ngắn được gửi bằng Bridge trên cùng một tab AI Studio, giọng Enzo / Friendly.

| File thật | Dung lượng | Thời lượng thực | Kết quả |
| --- | ---: | ---: | --- |
| tts_001.wav | 357164 byte | 7,44 giây | Chrome tải hoàn tất, app kiểm tra và tự gán đoạn 1 |
| tts_002.wav | 253484 byte | 5,28 giây | Bridge thay lời đọc, gửi, chờ kết quả, tải và tự gán đoạn 2 |

Cả hai file là PCM signed 16-bit, mono, 24000 Hz; lưu tại `Downloads/Bridge Download Test 2026-10-03`. Batch hoàn tất 2/2; mỗi job có một lần authorize_send. Không bấm Run hoặc Save cho hai kết quả được gán.

Trong quá trình chẩn đoán đã hủy hộp thoại Save As và tải lại tiện ích nhiều lần. Việc phục hồi lượt đầu dùng nút **Tiếp tục tải tài nguyên**. Vì lượt đầu đã được chuẩn bị bằng mã cũ chưa lưu lịch sử prompt, dấu vết prompt của riêng dự án thử được khôi phục trước khi tiếp tục đoạn 2. Mã mới lưu dấu vết này tự động; kiểm thử hồi quy mô phỏng worker mới và content script mất kết nối xác nhận hành vi đó.

Chưa chạy tạo thumbnail/ảnh/video thật trong lần kiểm tra này: vẫn chờ người dùng xác nhận số lượng theo yêu cầu trước đó. Kiểm thử hàng đợi vẫn kiểm tra cổng xác nhận, thứ tự, quyền sở hữu lượt tạo và tránh gửi trùng; không coi chúng là bằng chứng Gemini/Flow đã chạy thành công trên tài khoản.

## Sử dụng bản sửa

1. Cài bản 3.1.15; tiện ích được nạp từ thư mục riêng cần cập nhật nội dung bằng ZIP Bridge 1.1.13.
2. Trong Comet Extensions, **Reload** tiện ích hiện có để giữ khóa ghép nối; kiểm tra phiên bản **1.1.13**.
3. Trong Comet **Settings → Downloads**, tắt **Ask where to save each file before downloading**. Thiết lập này áp dụng cho các lượt tải khác trong Comet.
4. Giữ app và trình duyệt chạy, bật **Tự động gửi, nhận và tải tài nguyên**. Khởi chạy TTS trong app; với ảnh/video, xác nhận số lượng trước khi khởi chạy.
5. Nếu một kết quả đã tạo nhưng lượt tải bị hủy, dùng **Tiếp tục tải tài nguyên** trong popup Bridge; không tạo lại tác vụ để lấy cùng kết quả.

Bản sửa giữ nguyên các chức năng còn lại và chưa xuất bản lên GitHub.
