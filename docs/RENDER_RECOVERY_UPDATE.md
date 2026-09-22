# Sửa tiếp tục sản xuất và dựng lại video

- Tiếp tục quy trình kiểm tra tài nguyên thật, nêu rõ WAV/scene còn thiếu, tự chuyển sang đồng bộ và dựng khi đủ dữ liệu theo chế độ quy trình đã chọn.
- Dựng video tự đồng bộ thời lượng WAV hiện tại. Không cần thay đổi cài đặt hay chia lại đoạn.
- Chuẩn hóa màu và mã hóa lại chỗ nối video ngắn với ảnh thay thế; sửa lỗi luồng hình kết thúc ở scene005 trong khi âm thanh vẫn chạy.
- QA kiểm tra riêng thời lượng hình và âm thanh, không chỉ tổng thời lượng MP4.
- Mỗi lần dựng lưu vào thư mục riêng, giữ bản cũ nếu lần mới thất bại. Trình xem tải đúng bản mới và bỏ bộ nhớ đệm.
- Nút Dựng lại video xuất hiện khi đã có bản dựng. Trang dựng hiển thị tệp thiếu và lỗi lần dựng gần nhất.
- Dự án có đoạn lời kết phải đính kèm WAV cho đoạn này. Không tự bỏ đoạn lời kết hoặc thay bằng im lặng.
