# Xem nội dung bằng tiếng Việt

Trong dự án, mở một trang thuộc **Phát triển**, **Chất lượng** hoặc **Sản xuất**. Thanh **Ngôn ngữ nội dung** ở đầu phần bên phải có hai nút:

- **Tiếng Việt**: dịch nội dung để đọc. Lần đầu, Comet có thể cần tải gói dịch Anh–Việt; tiến độ xuất hiện ngay dưới nút.
- **Tiếng Anh gốc**: trở lại nội dung gốc ngay lập tức.

Lựa chọn được giữ khi chuyển giữa các trang trong cùng dự án. Sau khi tải lại trang, bấm Tiếng Việt để bật lại. Bản dịch đã lưu vẫn được dùng lại.

## Nội dung gốc được giữ nguyên

Các nút sao chép, tải TXT, xuất dự án, gửi Bridge/AI và tiếp tục quy trình luôn dùng dữ liệu gốc. Mã định danh, đường dẫn, tên file và số liệu không được dịch. Ô **Sửa JSON** giữ nguyên JSON gốc. Ở **Bản nháp**, phần đọc tiếng Việt nằm phía trên ô chỉnh sửa tiếng Anh. Bản dịch không được lưu vào truyện, phiên bản, prompt, phụ đề hoặc video đầu ra.

Trong TTS và dàn ý, mở phần chi tiết để xem bản dịch của nội dung bên trong. Khi nội dung dài, cuộn xuống để dịch phần tiếp theo. Di chuột lên đoạn đã dịch để xem nguyên văn.

## Tốc độ và yêu cầu trình duyệt

Sử dụng Translator API tích hợp trong Comet/Chrome hỗ trợ cặp Anh–Việt. Bộ dịch chạy trên máy, không cần khóa API, không gửi nội dung lên ChatGPT/Gemini và không chiếm hàng đợi tác vụ của StoryForge. Lần đầu cần mạng để tải gói dịch; các lần sau dùng lại gói có sẵn.

Chỉ dịch phần đang xem, xử lý một đoạn nhỏ tại một thời điểm và nhường thời gian giữa các đoạn. Việc dịch tạm dừng khi tab bị ẩn hoặc khi trở về tiếng Anh. Bộ nhớ đệm IndexedDB riêng có giới hạn; kết quả được nhận diện theo nguyên văn nên nội dung thay đổi sẽ được dịch lại. Nếu trình duyệt không cho lưu bộ đệm, phiên hiện tại vẫn sử dụng bộ nhớ tạm.

Nếu tải bộ dịch thất bại hoặc trình duyệt chưa hỗ trợ, thông báo xuất hiện cạnh nút; bản gốc và các thao tác vẫn hoạt động. Bấm **Thử dịch lại** sau khi kết nối trở lại. Đây là bản dịch tham khảo; dùng bản gốc để kiểm tra sắc thái quan trọng.

Tài liệu API: https://developer.chrome.com/docs/ai/translator-api
