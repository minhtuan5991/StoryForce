# Browser Bridge 1.1.0 — Tự động gửi và nhận kết quả

Trước đây extension chỉ chạy khi bấm từng nút Open / Fill / Send / Capture.
Chế độ Auto của quy trình trong app không tự điều khiển các nút đó.

## Bật tự động

1. Giữ StoryForge và Chrome/Edge đang mở.
2. Mở `chrome://extensions` hoặc `edge://extensions`, tìm StoryForge US
   Browser Bridge và bấm Reload/Tải lại. Bản mới là **1.1.0**. Nếu extension
   được nạp từ thư mục khác, chép nội dung gói 1.1.0 đè vào thư mục đã nạp
   rồi Reload, hoặc dùng thư mục `browser-extension` bên cạnh StoryForge.exe.
3. Mở popup extension. Khóa ghép nối cũ được giữ nếu tải lại cùng extension.
   Chỉ ghép nối lại nếu popup báo chưa ghép nối.
4. Đăng nhập ChatGPT/Gemini trong trình duyệt đó, rồi bật
   **Tự động gửi và nhận kết quả**. Chỉ bật nếu các tác vụ đang chờ chưa được
   gửi thủ công; với tác vụ đã gửi, lấy kết quả thủ công trước để tránh gửi lại.
5. Extension tự lấy tác vụ văn bản đang chờ, mở tab AI riêng, điền prompt,
   gửi một lần, chờ câu trả lời mới ổn định và lưu kết quả hợp lệ về app.
   Có thể đóng popup; giữ trình duyệt và app đang chạy.

Khi app tạo tác vụ kế tiếp, extension tiếp tục nhận. Chế độ quy trình
Manual / Assisted / Auto và các điểm chọn ý tưởng, duyệt truyện vẫn theo
thiết lập hiện có. Muốn nối nhiều bước, chọn chế độ quy trình phù hợp
trong Thiết lập → Chung; bật tự động ở extension không tự đổi thiết lập này.

## Khi tạm dừng

Popup và dòng trạng thái tác vụ hiển thị lý do. Đăng nhập, CAPTCHA,
hạn mức, ô nhập có bản nháp, nút gửi không khả dụng hoặc cấu trúc trang
AI thay đổi đều cần bạn kiểm tra. Sau khi xử lý, bấm
**Tiếp tục sau khi kiểm tra tab AI**. Với prompt đã được ghi nhận gửi,
extension chỉ tiếp tục lấy kết quả, không tự bấm gửi lần nữa.

Nếu thao tác gửi đã bị gián đoạn ở thời điểm không xác định, kiểm tra
trang AI để biết prompt đã gửi chưa. Có thể tắt tự động rồi dùng các nút
thủ công để gửi/lấy kết quả đúng tác vụ. Không bấm Thử lại tác vụ nếu đã
có câu trả lời cần lấy, vì Thử lại tạo một lượt thực thi mới.

Giọng đọc, ảnh và video vẫn cần tải file và gắn vào Tài nguyên; luồng tự
động này xử lý kết quả văn bản JSON của ChatGPT/Gemini.

## Bảo vệ và kiểm tra

- Kiểm tra quyền nhận tác vụ trên app để hai trình duyệt không cùng gửi
  một lượt tác vụ. Lưu dấu gửi trước khi bấm nút, tránh tự gửi trùng khi
  bộ xử lý extension được khởi động lại.
- Chỉ nhận câu trả lời mới sau mốc gửi, chờ hết trạng thái tạo nội dung
  và ổn định ít nhất 4,5 giây. App tiếp tục kiểm tra cấu trúc kết quả.
- Không ghi đè bản nháp sẵn có; không vượt đăng nhập, CAPTCHA hay hạn mức.
- Chế độ tự động mặc định tắt cho tới khi bạn bật trong popup.
- Bộ kiểm tra gồm mô phỏng khởi động lại, mất phản hồi gửi, hủy tác vụ,
  hết thời gian, kết quả không hợp lệ và trang DOM AI mô phỏng. Chưa xác
  minh gửi/nhận bằng tài khoản AI thật của người dùng.

Extension thêm quyền `alarms` để khôi phục việc kiểm tra hàng đợi khi bộ
xử lý nền ngủ. Tham khảo [tài liệu Chrome về vòng đời service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
và [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms).
