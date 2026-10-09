# StoryForge US 3.1.30 — Ghép timeline và rút gọn quy trình

## Cách sử dụng

Hai tùy chọn mới bật mặc định, có thể tắt độc lập:

- **Thiết lập → Chung → Giảm các lượt AI trùng nhau**: giữ dàn ý đã kiểm định đạt, viết một hook trong bản nháp, gộp đối chiếu ChatGPT và kiểm định giữ người xem.
- **Thiết lập → Sản xuất → Chỉ dựng riêng các đoạn chuyển cảnh**: render cửa sổ fade, ghép trực tiếp phần thân scene đã có chuyển động. Giữ renderer cũ làm phương án tương thích.

Số ý tưởng mặc định và ngân sách hình ảnh hiện có được giữ nguyên. Có thể chọn **1** hoặc **3** ý tưởng khi chỉ cần một video. Ở Đạo diễn hình ảnh, **Ít ảnh hơn · giữ video mở đầu** dùng khoảng một nửa số ảnh và giữ số video của chế độ chuẩn. Chọn rồi xác nhận trước khi tự tạo; kế hoạch đang có không tự bị thay đổi. Ít ảnh có nghĩa thời gian giữ mỗi ảnh dài hơn, cần xem lại nhịp hình ở cao trào.

## Phép đo trên máy local

Mẫu tổng hợp độc lập dài **180 giây**, **1920 × 1080**, **30 FPS**, gồm 12 scene: hai clip mở đầu 10 giây và mười ảnh có pan/zoom, chín fade 0,4 giây, waveform nền xanh và logo. Bộ mã hóa **NVIDIA H.264 NVENC**, runtime FFmpeg tương thích. Không thay đổi tài nguyên hoặc dựng lại dự án thật của người dùng.

| Bước | Cách ghép cũ, cache lạnh | Cách ghép mới, cache lạnh | Dựng lại, cache hợp lệ |
| --- | ---: | ---: | ---: |
| Scene | 17,26 s | 15,91 s | 0,06 s |
| Ghép timeline | 52,91 s | 7,92 s | 0,02 s |
| Ghép hiệu ứng và xuất cuối | 18,75 s | 19,22 s | 19,19 s |
| Tổng lượt render | 91,00 s | 44,84 s | 19,55 s |

Trong mẫu này, ghép timeline nhanh hơn khoảng **6,7 lần**, tổng lượt dựng đầu giảm khoảng **51%**. Đây là một mẫu đo trên máy này, không phải mức bảo đảm cho mọi video. Cache đã có từ các bản trước cũng giúp dựng lại nhanh; không coi toàn bộ lợi ích cache là thay đổi mới. Thời gian phụ thuộc GPU/CPU, ổ đĩa, độ dài video, số scene, thời lượng fade, kiểu phụ đề và tác vụ chạy đồng thời.

Hai video đều đủ **5.400 khung hình**, khớp audio/video và đạt các kiểm tra QA. SSIM toàn bộ hình ảnh hai video cuối là **0,997672**. Giá trị này thể hiện độ tương đồng cao trên mẫu thử, không thay cho xem video. Bộ kiểm thử riêng xác nhận mọi khung hình trong phần thân scene ghép nhanh giống hệt scene nguồn đã chuẩn hóa; fade được đối chiếu từng khung hình và theo trọng số hòa trộn ở 24/30 FPS, kể cả thời lượng lẻ và ranh giới nhóm.

Không hạ độ phân giải, FPS, cấu hình bitrate xuất, hoặc bỏ hiệu ứng. Phần thân scene không bị mã hóa lại ở bước ghép, giảm một số lượt nén có mất dữ liệu; cửa sổ fade và lần xuất cuối vẫn được mã hóa. Waveform, logo, phụ đề, nhạc và kiểm tra âm thanh tiếp tục qua pipeline hiện có. Thời gian xuất cuối gần như không giảm trong mẫu này.

## Giới hạn và khôi phục tương thích

Đường ghép fade nhanh hỗ trợ CPU H.264 và NVIDIA; Quick Sync tiếp tục cách ghép đã kiểm chứng. Scene được chuẩn hóa với khung khóa ở điểm cắt và không dùng B-frame ở các đoạn trung gian. App kiểm tra số khung hình, kích thước, FPS, thời lượng từng đoạn và bộ mã hóa fade. Nếu một phần không khớp, toàn bộ timeline được ghép lại bằng cách cũ, với cùng hiệu ứng và thời lượng. Video hoàn thành trước đó được giữ nguyên.

Cache chuyển cảnh được gắn với cả hai scene và cấu hình renderer. Thay một scene chỉ tạo lại các cửa sổ giáp nó; thay timing hoặc kích thước làm cache tương ứng hết hiệu lực. Video đã hoàn thành không cần dựng lại chỉ vì nâng phiên bản hoặc đổi tùy chọn tăng tốc, bởi các tùy chọn này không thay đổi yêu cầu nội dung đầu ra.

## Các lượt AI giảm được

- **Dàn ý đã đạt**: không gọi AI viết lại khi không có lỗi và hash của dàn ý đúng với bản đã kiểm định. Giữ artifact dàn ý gốc, ghi lại bước tái sử dụng cục bộ. Kiểm định có lỗi, thiếu hash từ bản cũ hoặc dàn ý đã đổi vẫn dùng AI. Nút chỉnh sửa thủ công vẫn gửi yêu cầu riêng.
- **Mở đầu**: một mở đầu tốt được viết ngay trong bản nháp theo hook 0–10 giây, xung đột 10–30 giây, cao trào/twist 45–55%. Nếu đã có mở đầu được chọn, vẫn dùng lựa chọn đó. Tạo ba phương án thủ công vẫn có sẵn; tắt rút gọn sẽ khôi phục lượt tạo tự động.
- **Đối chiếu + giữ người xem**: một phản hồi ChatGPT gồm đối chiếu các lỗi, kiểm định độc lập và kiểm định giữ người xem. Hai quyết định được xác minh bằng bộ kiểm tra riêng và lưu thành hai artifact. Kết quả giữ người xem thiếu/sai sẽ không được tính đạt; app chạy kiểm định riêng. Nếu sửa truyện, dàn ý hoặc packaging, kết quả phải được đánh giá lại trên nội dung hiện tại.
- **Chế độ tự động**: mini-test chỉ Ý tưởng 1 vì đây đã là lựa chọn tự động được người dùng yêu cầu. Ý tưởng 1 vẫn phải đạt các điều kiện chất lượng trước khi tiếp tục. Chế độ thủ công/có hỗ trợ vẫn có mini-test các phương án.

Truyện không có lỗi cần sửa có thể tiết kiệm ba lượt gửi AI chính. Nếu phải sửa bản nháp hoặc kết quả gộp không hợp lệ, kiểm định riêng vẫn chạy và số lượt tiết kiệm giảm. Không cam kết giảm chất lượng bằng cách bỏ kiểm định cần thiết.

Giữ kiểm định truyện Gemini, xử lý bất đồng/lỗi khi cần và xác minh cuối ChatGPT + Gemini. Chế độ Tự động có kiểm duyệt giữ các điểm dừng Khóa truyện, xác nhận ảnh/video, bắt đầu dựng và xem video cuối. TTS vẫn độc lập với xác nhận số lượng hình ảnh; phiên chat, tham chiếu nhân vật và Bridge 1.1.29 được giữ nguyên. Không yêu cầu reload Bridge cho thay đổi 3.1.30.
