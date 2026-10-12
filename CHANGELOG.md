## v3.1.46 — Giọng đọc theo kênh và xác nhận dự án Extend/Customize

- Bỏ ô Tên giọng kể trong Thiết lập > Sản xuất. Tổng quan kênh có Speaker/Style mặc định; dự án mới có lựa chọn dùng mặc định hoặc nhập giọng riêng.
- Chốt giọng theo dự án; nâng cấp giữ Enzo/Friendly vốn được Bridge sử dụng. Có thể sửa giọng trước khi tạo được TTS; ngăn đổi giọng khi đã có lời kể để tránh trộn giọng. Chunk/outro và Browser Bridge cùng dùng hồ sơ giọng này.
- Extend/Customize mới chờ xác nhận thời lượng, số ảnh/video và giọng đọc ở Tổng quan trước khi chạy. Server, hàng đợi và API tác vụ đều kiểm tra điểm dừng này. Các dự án cũ chưa bắt đầu dàn ý và không có tác vụ hoạt động cũng được đưa về điểm xác nhận.
- Browser Bridge 1.1.42 tìm đúng Speaker, Paste Style vào ô Describe the voice style và mở lại để xác minh đã lưu. Giọng thiếu hoặc Style không được lưu sẽ dừng cả lượt TTS để người dùng sửa, không chạy lỗi qua từng đoạn và không tự thay giọng. Kiểm tra lại trước khi gửi lời kể.
- Xóa Extend trước khi dựng video thành công sẽ trả lại ý tưởng; ý tưởng đã có video dựng thành công vẫn được giữ là đã dùng sau khi xóa hoặc dọn tài nguyên. Sao lưu trước migration 7.
- Các clip Flow tiếp tục do người dùng tạo thủ công. Không thay đổi cài đặt dựng, nhạc nền, prompt sáng tác hay các điểm kiểm duyệt khác.

## v3.1.45 — Bản sắc sáng tác và nghiên cứu DNA riêng cho từng kênh

- The Midnight Log giữ nguyên DNA, prompt, thông số và luồng tác vụ hiện có. Chỉ hai kênh Heart & Hurdles và The Veiled Signal nhận bộ chỉ dẫn khởi đầu đã được duyệt; không đổi nội dung hoặc cài đặt của các dự án cũ.
- Heart & Hurdles tạo drama gia đình với động cơ con người hợp lý, tình huống tưởng phi lý có lời giải bất ngờ được gieo trước và hậu quả cảm xúc rõ ràng. The Veiled Signal tạo bí ẩn khoa học viễn tưởng: khoa học thật làm nền, phân biệt quan sát/giả thuyết/hư cấu, tổ chức che giấu và âm mưu đều hư cấu.
- Mục DNA kênh có tiêu chí sáng tác JSON và nút Nghiên cứu DNA kênh. ChatGPT biên soạn ba phần có giới hạn độ dài: bản sắc/hook, cách viết, kiểm định/hình ảnh/đóng gói. Lưu từng phần, tiếp tục phần còn thiếu, chặn kết quả từ DNA đã thay đổi và tránh gửi trùng.
- Kết quả nghiên cứu được xem trước, so sánh với bản đang dùng và chỉ áp dụng sau khi người dùng bấm Áp dụng. Lưu lịch sử; có thể khôi phục chỉ dẫn cũ khi DNA tương ứng khớp. Không khẳng định đã tra cứu web nếu chỉ biên soạn từ DNA.
- Dự án mới lưu phiên bản DNA và bộ chỉ dẫn riêng. Ý tưởng, Hồ sơ truyện, dàn ý, bản nháp, kiểm định, hình ảnh, thumbnail và thông tin YouTube cùng dùng bản sắc đã lưu; chỉ gửi phần chỉ dẫn cần cho từng tác vụ. Giữ nguyên hợp đồng JSON, nguồn AI, ngân sách thời lượng, hook đầu video, cao trào/twist giữa video và luồng sản xuất.
- Sao lưu SQLite trước migration 6. Xuất kênh kèm lịch sử chỉ dẫn; dữ liệu dự án giữ bản đã lưu độc lập với các lần nghiên cứu mới. Browser Bridge giữ bản 1.1.41; không cần đổi cơ chế tạo tài nguyên.

## v3.1.44 — Video Flow thủ công, Lyria trong AI Studio và phục hồi câu trả lời

- Video Flow chuyển sang tạo thủ công trong mọi chế độ. Hàng đợi chỉ tự tạo thumbnail, ảnh scene/nhân vật và âm thanh; các scene VIDEO, số lượng và prompt vẫn giữ nguyên. Đạo diễn hình ảnh có phần tải ảnh tham chiếu, sao chép prompt và nhập clip `scene_NNN.mp4` qua Tài nguyên. Tác vụ Flow còn chờ từ bản cũ được chuyển sang thủ công, giữ lại prompt, phiên Flow và tài nguyên; không chặn việc tạo ảnh tiếp theo.
- Chuyển tác vụ nhạc từ Gemini sang `https://aistudio.google.com/new_music?model=lyria-3-pro-preview`. Browser Bridge 1.1.41 mở vùng Describe the music, chọn ô nhập Text, xác minh Lyria 3 Pro Preview, Paste prompt rồi Generate một lần. Prompt dùng mốc thời gian cho bản nhạc không lời khoảng 150 giây, phong cách huyền bí, đầu/cuối tương thích để lặp.
- Nhận đúng Music player vừa tạo; bỏ qua nhạc mẫu, player của lượt trước và gói phát âm thanh. Tải file MP3/WAV hoàn chỉnh, đối chiếu thời lượng hiển thị, giữ nguyên cơ chế xác minh file và tránh gửi trùng.
- Tách phiên nhạc khỏi phiên TTS trong AI Studio. Chỉ chuyển tác vụ Gemini chưa gửi sang trang mới; không mở lại bước tạo cho yêu cầu đã gửi. Giữ bản nhạc đang dùng khi lượt mới lỗi, thư viện chung, gain 0 dB và các cài đặt sản xuất hiện có.
- Gia hạn heartbeat vẫn được nhận diện khi Windows trả cùng một mốc đồng hồ liên tiếp; tránh bỏ nhầm tác vụ media vừa kết nối lại.
- ChatGPT/Gemini kiểm tra trang tải xong ít nhất 1 giây và ô nhập không đổi ít nhất 0,5 giây, đồng thời thay vì cộng dồn 5 + 2 giây. Kiểm tra mỗi 0,5 giây khi chuẩn bị prompt; Gemini tạo ảnh cũng dùng mốc mới. Trang đang tải/chuyển hướng, ô nhập bị thay hoặc khóa, AI đang trả lời vẫn chờ; Paste đầy đủ, bản nháp người dùng, tệp đính kèm, phiên dự án và chống gửi trùng giữ nguyên. Nhịp thu kết quả, chờ tải ảnh tham chiếu, phục hồi scene lỗi và thời gian ổn định Flow/TTS/Lyria không đổi.
- Khi câu trả lời văn bản ChatGPT/Gemini đã hoàn tất nhưng JSON hoặc cấu trúc/độ dài/trích dẫn bị từ chối, Bridge yêu cầu sửa một lần trong đúng chat cũ. Dùng “Hãy viết lại câu trả lời chuẩn Json” hoặc “Viết lại câu trả lời theo đúng yêu cầu”, kèm lỗi cụ thể và hợp đồng đầu ra. Tệp JSON/TXT đọc được vẫn được kiểm tra trước; lỗi tải tệp/kết nối/đăng nhập/quota không kích hoạt yêu cầu viết lại.
- Nếu câu trả lời sau khi sửa vẫn lỗi, lưu chẩn đoán, đóng đúng tab do Bridge tạo rồi gửi lại đầy đủ yêu cầu trong một tab mới với cùng AI. Nếu lượt mới vẫn bị từ chối, tạm dừng; tối đa ba lượt trả lời cho chuỗi phục hồi định dạng. Quyền gửi, lượt sửa, lỗi và hạn mức được lưu bền; Reload không gửi trùng, câu trả lời sửa giống hệt câu cũ vẫn được kiểm tra. Không tự đổi AI, không biến kết quả kiểm duyệt FAIL/bất đồng thành PASS, giữ các cổng kiểm tra dữ liệu hiện tại.

## v3.1.43 — Lớp âm thanh mở đầu, điểm nhấn theo truyện và nhạc Lyria dài

- Ghép nền bí ẩn trong 30 giây đầu và các điểm nhấn ngắn tại tình tiết căng thẳng, bất ngờ hoặc hé lộ. Kế hoạch scene có thể chọn hiệu ứng cùng trích đoạn lời kể; app đặt thời điểm bằng thời lượng TTS thực tế, không dùng mốc giây AI tự đoán. Các kế hoạch đã có được nhận diện thận trọng từ lời kể; không thêm tiếng động cụ thể nếu truyện không có.
- Sáu hiệu ứng gốc được tạo cục bộ một lần trong `shared_sound_effects`, dùng lại giữa các dự án. Không phát sinh lượt AI riêng cho mỗi cảnh. Tài nguyên có nút bật/tắt, chuẩn bị, nghe thử và bảng thời điểm hiệu ứng. Các điểm nhấn được cân riêng, giới hạn số lượng và đỉnh âm thanh.
- Tài nguyên > Nhạc nền dùng chung có danh sách chọn bản nhạc và nghe thử. Nhận WAV/MP3/M4A/AAC/FLAC/OGG/OPUS chép vào thư mục `background_music` khi mở/làm mới danh sách. Mỗi dự án giữ lựa chọn riêng; lựa chọn thủ công không bị thay bằng bản mới nhất khi tiếp tục quy trình. File gốc trong thư mục không bị sửa hoặc xóa khi dọn tài nguyên dự án.
- Nhạc nền giữ mức của file gốc (gain 0 dB), bỏ cân/hạ mức theo lời kể và không áp dụng cài đặt Music (dB) cũ. Cài đặt cũ được giữ trong dữ liệu, giọng đọc/âm thanh môi trường giữ quy tắc hiện có. Giới hạn đỉnh ở bản ghép cuối vẫn ngăn vỡ tiếng; báo cáo ghi rõ mức nguồn được giữ và không ducking.
- Browser Bridge 1.1.38 chọn Pro / Đầy đủ / Không lời cho lượt Lyria mới, yêu cầu nhạc khoảng 2–3 phút mang phong cách huyền bí, gây tò mò với đầu/cuối tương thích để lặp. Không gửi khi cài đặt bị đổi hoặc chưa có thời lượng Đầy đủ. Lượt tạo nhạc cũ vẫn dùng cài đặt của lượt đó.
- Nhập nhạc không còn cắt còn 30 giây. Giữ đến ba phút và hòa điểm cuối vào điểm đầu để lặp mượt. Lượt Lyria mới trả file dưới 90 giây được báo thiếu thay vì nhận nhầm; nhạc cũ được giữ khi bản dài đang tạo hoặc tạo lỗi. Có nút Tạo nhạc Lyria dài mới, dùng chung một bản nhạc giữa các dự án và tránh gửi trùng.
- Ghi hiệu ứng và mức ghép trong báo cáo dựng/`sound_design.json`. Cache âm thanh đổi theo hiệu ứng; vẫn dùng lại scene, chuyển động ảnh và chuyển cảnh. Video final đã có chỉ thay đổi khi dựng lại. Giữ thao tác dựng thủ công trong Có hỗ trợ.

## v3.1.42 — Nhạc nền ổn định, tải ảnh Flow và tự khóa truyện Có hỗ trợ

- Browser Bridge 1.1.37 tải đúng ảnh tham chiếu qua ô chọn tệp của Flow, kể cả ô chọn tệp không nằm trong DOM hoặc dùng bộ chọn file Windows. Chọn ảnh đã tải, bấm Thêm vào câu lệnh và xác minh toàn bộ ảnh trong ô prompt trước khi dán và tạo video. Dùng lại ảnh cùng dự án, hỗ trợ chọn từng file và khôi phục khi mất phản hồi tải; không gửi lại ảnh hoặc tạo video trùng.
- Chế độ Có hỗ trợ tự khóa sau các vòng kiểm duyệt, xử lý bất đồng, chỉnh sửa và hai kiểm định cuối cho đúng bản nháp, kể cả còn bất đồng hoặc cảnh báo chất lượng. Các lỗi đã xác nhận vẫn được sửa; kiểm tra giữ người xem vẫn chạy và sửa tới giới hạn hiện có. Cảnh báo và kết quả AI được giữ nguyên, việc tự khóa được ghi riêng, không ghi thành xác nhận thủ công. Tác vụ lỗi, kết quả thiếu hoặc kiểm định cũ không bị bỏ qua.
- Sau tự khóa, tiếp tục TTS và kế hoạch/tài nguyên như thiết lập hiện tại. Chế độ Có hỗ trợ vẫn cần bấm dựng video thủ công; các chế độ khác giữ chính sách khóa hiện có.

- Nhạc nền được cân theo âm lượng thực của file và giọng đọc, với mục tiêu thấp hơn giọng đọc trung bình khoảng 9 dB thay cho 14 dB. Mức Music (dB) đã lưu vẫn điều chỉnh được độ lớn; giọng đọc giữ nguyên cài đặt.
- Bỏ giảm nhạc/âm thanh nền theo giọng đọc. Nhạc phát ở một mức xuyên suốt, kể cả lúc có lời kể và khoảng nghỉ; các mức hạ nhạc theo phần đầu/phần sau lưu trong tài nguyên Lyria cũ cũng không còn áp dụng.
- Giữ giới hạn mức nhạc theo biên độ đỉnh và giới hạn đỉnh âm thanh tổng để tránh vỡ tiếng. Nhạc im lặng vẫn được cảnh báo, không khuếch đại nguồn im lặng.
- Đổi phiên bản trộn âm thanh trong báo cáo, cache và dấu vết tài nguyên dựng. Dựng lại dùng bản trộn mới; vẫn dùng lại scene, timeline, chuyển động ảnh, chuyển cảnh và waveform đã dựng. Video đã xuất giữ nguyên đến khi dựng lại.

## v3.1.41 — Tách Hộp thư nội dung và Thư viện nguồn

- Hộp thư nội dung chứa nguồn mới chờ xử lý. Thư viện nguồn chứa nguồn đã phân tích hoặc được duyệt. Phân tích Story DNA thành công hoặc lưu DNA hợp lệ tự chuyển nguồn vào thư viện; phân tích lỗi không chuyển nguồn.
- Có thể duyệt vào thư viện hoặc chuyển về hộp thư từng nguồn, nhiều nguồn cùng lúc và ngay trong trang chi tiết. Chuyển nguồn giữ nguyên nội dung, DNA, kênh, dự án liên quan và ghi chú số hồ sơ đã dùng; không chạy tác vụ AI chỉ để chuyển nguồn.
- Mỗi danh sách có tìm kiếm, phân trang, trạng thái trống và số lượng riêng. Số trên Hộp thư nội dung chỉ tính nguồn đang chờ. Nguồn thêm mới hoặc nhập TXT/MD/CSV luôn vào hộp thư; các luồng tạo dự án hiện tại vẫn dùng được toàn bộ nguồn.
- Sao lưu trước nâng cấp dữ liệu. Nguồn hiện có đã phân tích hoặc đã được dùng trong dự án được xếp vào thư viện một lần. Lựa chọn chuyển lại về hộp thư được giữ khi mở lại app; quy trình sản xuất, tài nguyên và các cài đặt khác giữ nguyên.

## v3.1.40 — Dùng lại ý tưởng và phân loại dự án

- Dự án đã duyệt video cuối vẫn tạo được dự án mới từ ý tưởng chưa dùng sau cập nhật app hoặc xóa tài nguyên. Việc kiểm tra phiên bản truyện, kiểm định kỹ thuật, duyệt hoàn thành và tác vụ đang chạy vẫn giữ nguyên; kiểm tra file khi tải/dựng không thay đổi.
- Lưu lịch sử ý tưởng đã dùng, làm mờ và ngăn chọn lại, kể cả khi đã xóa dự án Extend. Mỗi lần chọn ý tưởng mới tạo một dự án độc lập cùng kênh, nguồn cảm hứng, thời lượng và lựa chọn sản xuất; bắt đầu tạo Hồ sơ truyện, không tạo lại Định hướng/Ý tưởng.
- Thêm tiền tố Full Step / Extend / Customize cho dự án mới và toàn bộ dự án hiện có. Tên truyện gửi AI, chữ thumbnail và thông tin YouTube vẫn dùng tên gốc. Sao lưu dữ liệu trước chuyển đổi và cập nhật liên kết thư mục/tài nguyên khi đổi tên.
- Hộp thư nội dung và Thư viện nguồn hiển thị “Đã dùng trong x Hồ sơ” hoặc “Chưa được dùng”, tính từ số dự án hiện có dùng nguồn, gồm Extend và các dự án đã xóa tài nguyên.

## v3.1.39 — Cân nhạc nền theo giọng đọc

- Đo âm lượng thực tế của giọng đọc và nhạc trước khi ghép, cân nhạc ở mức thấp hơn lời kể. Khi có giọng đọc, nhạc chỉ giảm nhẹ tối đa khoảng 3,7 dB để không bị chìm; nhạc không bật lớn đột ngột ở khoảng nghỉ.
- Nhạc dùng chung nổi hơn khoảng 3 dB trong 30 giây đầu rồi hạ êm trong 5 giây. Áp dụng cả file Lyria đã có, thay cách hạ cố định 8 dB và nén sâu ở phiên bản trước.
- Cài đặt Music (dB) có hiệu lực với nhạc Lyria; tăng giá trị để nhạc rõ hơn, có giới hạn theo lời kể và biên độ đỉnh để tránh lấn giọng hoặc vỡ tiếng. File nhạc im lặng được cảnh báo.
- Lưu kết quả đo và cache bản ghép âm thanh theo cấu hình mới; giữ cache scene và chuyển cảnh. Video đã xuất cần dựng lại để nhận cách trộn mới. Chế độ Có hỗ trợ vẫn chờ bấm dựng thủ công.

## v3.1.38 — Nhận thumbnail đã nhập và mở nút dựng đúng tài nguyên

- Nhận ba thumbnail A/B/C đã nhập thủ công theo tên file, kể cả khi kế hoạch thumbnail cũ không còn khớp sau cập nhật prompt. Không thay đổi metadata hay coi ảnh cũ là ảnh đã kiểm định theo kế hoạch mới.
- Điều kiện dựng chỉ yêu cầu tài nguyên thực sự dùng trong video: giọng đọc, scene, ảnh kết thúc, logo và lớp sóng nhạc đã bật. Thiếu thumbnail dùng để đăng YouTube chỉ cảnh báo, không khóa nút dựng.
- Giữ yêu cầu tạo đủ ba thumbnail có hình và chữ trong luồng tạo ảnh. Chế độ Có hỗ trợ vẫn chờ người dùng bấm dựng, không tự dựng hoặc tự xác nhận video cuối.

## v3.1.37 — Thumbnail có hình và chữ, dựng thủ công trong Có hỗ trợ

- Cả ba phương án thumbnail A/B/C bắt buộc có ảnh và câu chữ riêng 1–4 từ gây tò mò, bí ẩn hoặc kịch tính phù hợp cốt truyện. Font, ánh sáng và hiệu ứng bám theo nội dung; không tiết lộ cú ngoặt hay thêm chi tiết không có trong truyện.
- Luồng tạo hình tự động tạo đủ ba thumbnail; kế hoạch cũ cần tạo lại để đáp ứng yêu cầu có chữ. Giữ nguyên file cũ và các tài nguyên scene đã hợp lệ.
- Bỏ bước xác nhận tài nguyên. Kiểm tra đủ file, phiên bản truyện và thời lượng vẫn giữ nguyên. Chế độ Có hỗ trợ dừng ở trạng thái sẵn sàng và chỉ dựng khi người dùng bấm Dựng bản đầu tiên; hàng đợi tiếp tục chuẩn bị tài nguyên cho dự án tiếp theo.

## v3.1.36 — Thêm ảnh tham chiếu vào câu lệnh video Flow

- Sửa bổ sung Bridge 1.1.36: khung xác nhận nhận đúng bản ảnh vừa chọn khi có nhiều ảnh trùng tên. Lưu dấu vết ảnh đã tải trong đúng dự án Flow để dùng lại ở các scene sau và sau khi Reload Bridge; không chọn ảnh khác chỉ vì trùng tên.
- Tách tiến trình tải ảnh trong thư viện khỏi tiến trình tạo video. Mỗi bước tải/chọn/thêm ảnh có thời gian chờ riêng khi thực sự tiến triển; trang đứng quá ba phút vẫn được bỏ qua, toàn bộ chuẩn bị Flow giới hạn mười phút và ghi rõ bước đang kẹt.
- Tạm tắt Auto giữ liên lạc cho tác vụ đang sở hữu và tạm dừng bộ đếm, tránh app hiểu nhầm là trình duyệt mất kết nối rồi bỏ qua kết quả đã tạo. Hiện phiên bản Bridge đang nạp trong popup.

- Bridge 1.1.35 xử lý thư viện thành phần đã mở dù ô nhập phía sau bị khóa, nhận các nhãn tải nội dung và nút “Thêm vào câu lệnh”/“Add to prompt”.
- Chọn đúng ảnh vừa tải, bấm thêm vào câu lệnh nếu Flow mở khung xem trước, hoặc nhận ảnh được thêm ngay ở giao diện thu gọn. Chờ đủ ảnh thực sự nằm trong ô nhập rồi mới dán prompt và tạo video.
- Không lấy ảnh trong thư viện/khung xem trước làm bằng chứng đã đính kèm; không chọn ảnh khác hoặc tải trùng ảnh chỉ vì phải bấm thêm. Giữ nguyên model, thời lượng, số lượng, phiên dự án và các luồng TTS/ảnh/tải video.

## v3.1.35 — Đọc tệp JSON/TXT từ ChatGPT và tên hồ sơ nhập

- Bridge 1.1.34 nhận biết tệp JSON/TXT trong đúng lượt trả lời ChatGPT, đọc bản xuất đầy đủ từ nút tải của tệp/khung mã; không đọc từng dòng đang hiển thị của editor. Giữ nguyên trích dẫn, dấu nháy và xuống dòng trước khi app kiểm tra cấu trúc.
- Tệp chưa đọc được thì giữ lượt đã gửi để tiếp tục thu kết quả, không gửi thêm prompt chỉ vì nội dung nằm trong tệp. Không lấy khung mã cũ, tệp khác tên hoặc liên kết ngoài nhà cung cấp; giới hạn nguồn văn bản 2 MB.
- Nhập Hồ sơ truyện sẽ đổi tên dự án và thư mục theo trường title/story_title/working_title hoặc tiêu đề rõ ràng ở đầu summary của hồ sơ cũ. Giữ nguyên ID, kênh, nguồn và dữ liệu truyện/tài nguyên.

## v3.1.34 — Tự chạy tài nguyên trong chế độ Có hỗ trợ

- Dàn ý và bản nháp tự chuyển sang bước tiếp theo khi tiếp tục quy trình.
- Dùng số lượng ảnh/video đã chốt khi tạo dự án; tạo đủ ba thumbnail A/B/C cùng các scene, giữ nguyên hàng đợi sau TTS và tham chiếu nhân vật.
- Tự tạo hoặc dùng lại nhạc nền theo lựa chọn của dự án; vẫn báo các tài nguyên bị lỗi để bổ sung thủ công.
- Dự án được yêu cầu chạy có hàng đợi lưu bền; hoàn tất tài nguyên thì tiếp tục dự án chờ, không chạy lại dự án cũ chưa được yêu cầu.
- Bắt buộc duyệt bộ tài nguyên hiện tại trước khi dựng trong chế độ Có hỗ trợ. Tạo lại, thay file hoặc đổi ánh xạ làm hết hiệu lực duyệt; cả API dựng trực tiếp cũng kiểm tra.
- Giữ nguyên chế độ Thủ công, Tự động có kiểm duyệt, lựa chọn ý tưởng và các cài đặt khác.

## v3.1.33 — Sửa Bridge chờ ô nhập vô hạn

- Sửa bổ sung local cho Bản nháp đầy đủ: chỉ gửi toàn bộ hồ sơ truyện, dàn ý đã chỉnh sửa, mở đầu đã chọn và thông tin dự án/kênh/thời lượng. Bỏ dàn ý cũ, kiểm định đã xử lý và dữ liệu truyện khác khỏi prompt; không cắt cảnh hoặc rút ngắn truyện.
- Bridge 1.1.33 phát hiện lượt trả lời mới đã hoàn tất nhưng rỗng, kiểm tra lại tối thiểu 12 giây rồi dùng giới hạn thử lại JSON hiện có. Không gửi lại khi AI còn xử lý, chưa có lượt trả lời mới hoặc người dùng đang chỉnh nội dung. Bổ sung nhận diện nút Ngừng của ChatGPT; giữ các tác vụ media và điểm duyệt hiện có.
- Dùng phiên bản extension thực tế để xác minh kết nối, độc lập với phiên bản bộ selector. Sửa việc nạp lại content script mỗi lần kiểm tra và làm mất bộ đếm ổn định 2 giây trên ChatGPT/Gemini và các tab media.
- Giữ listener đang hoạt động; chỉ nạp lại khi mất kết nối hoặc nâng cấp extension. Tab bị treo vẫn có giới hạn thời gian chờ; giữ kiểm tra bản nháp và chống gửi trùng.
- Kiểm thử hồi quy với các lần kiểm tra liên tiếp, nâng cấp, mất listener, tab treo và Paste thật trong extension. Kèm Bridge 1.1.32; Reload Bridge để áp dụng, không cần thay khóa ghép nối.

## v3.1.32 — Nhạc nền Lyria dùng chung và tài nguyên chọn sẵn

- Khi tạo dự án, chọn bật/tắt nhạc nền không lời và số ảnh/video. Gợi ý theo thời lượng, tối thiểu 3 ảnh và 2 video 10 giây; thumbnail và ảnh tham chiếu tính riêng. Chế độ tự động dùng các lựa chọn này để lập kế hoạch và tạo tài nguyên sau TTS, không yêu cầu xác nhận số lượng lần thứ hai. Giữ điểm duyệt Khóa truyện và dựng bản đầu tiên. Dự án cũ giữ luồng hiện có.
- Bridge 1.1.31 dùng công cụ Tạo nhạc Lyria trong Gemini, chọn Ngắn/Không lời, gửi một lần và chỉ tải MP3 của đúng kết quả. Phiên nhạc riêng không thay thế chat ảnh của dự án; không yêu cầu API key AI Studio. Lyria có thể trả đoạn dài hơn yêu cầu, app lấy tối đa 30 giây để làm vòng lặp.
- Lưu một thư viện ở `background_music` trong thư mục dữ liệu. Dự án mới ưu tiên dùng lại file; các dự án đang chờ dùng chung một lượt tạo. Thất bại không kích hoạt tạo nhạc liên tục cho từng dự án, vẫn tiếp tục sản xuất và báo nhạc thiếu tại Tài nguyên; có nút thử lại/nhập file.
- Ghép nối mềm vòng nhạc, tăng hiện diện ở 30 giây đầu rồi giảm 8 dB trong 5 giây và tiếp tục lặp; tự giảm nhạc theo lời kể. Cache audio ghi nhận cấu hình này. Dọn dữ liệu dự án giữ thư viện chung, chuyển thư mục dữ liệu mang theo thư viện. Cần Reload Bridge 1.1.31 sau cập nhật.

## v3.1.31 — Sửa tác vụ thông tin đăng YouTube (local)

- Nhận đầy đủ các trường tham khảo trong phản hồi metadata: tối đa 16 chi tiết truyện, 300 ký tự thể loại và 32 ghi chú kiểm tra. Không cắt bỏ dữ liệu; vẫn giữ giới hạn tiêu đề, mô tả, tags, hashtags và kiểm tra câu trích dẫn đúng bản nháp hiện tại.
- Bổ sung giới hạn rõ ràng vào prompt metadata mới, kể cả khi dùng mẫu tùy chỉnh cũ. Phản hồi đang chờ từ phiên bản trước vẫn được nhận theo đúng nội dung truyện và lượt tác vụ.
- Bridge 1.1.30 tự đọc lại một lần phản hồi metadata đã gửi nhưng bị giới hạn trường cũ từ chối, trên đúng tab và lượt đã ghi nhận. Không gửi lại prompt hoặc tạo cuộc trò chuyện khác.
- Khi Comet tạm khóa chỉnh sửa tab, Bridge chờ và thử lại trong thời hạn chuẩn bị. Nếu đã nhận kết quả, chỉ thử đóng tab trong giới hạn rồi tiếp tục hàng đợi. Giữ quyền hiện có, khóa ghép nối, các phiên media và cơ chế chống gửi trùng. Cần Reload Bridge để áp dụng. Chưa đẩy GitHub.

## v3.1.30 — Ghép timeline nhanh và rút gọn lượt AI (local)

- Render riêng các cửa sổ fade rồi ghép trực tiếp phần thân scene đã có pan/zoom; giữ kích thước, FPS, thời lượng, nhạc, waveform, logo và cấu hình xuất. Kiểm tra số khung hình, độ dài và bộ mã hóa từng đoạn; tự dùng renderer cũ nếu không tương thích. Áp dụng với CPU H.264 và NVIDIA; Quick Sync giữ cách ghép đã kiểm chứng.
- Lưu cache cửa sổ chuyển cảnh, chỉ render lại phần giáp scene đã thay đổi. Phần thân scene không bị mã hóa lại khi ghép; lần xuất cuối vẫn dùng chất lượng/bitrate hiện có. Video hoàn thành trước khi cập nhật không bị yêu cầu dựng lại chỉ vì đổi phiên bản.
- Quy trình rút gọn dùng lại dàn ý đã được kiểm định đạt trên đúng nội dung hiện tại, tạo một hook trực tiếp trong bản nháp và gộp kiểm định giữ người xem vào phản hồi đối chiếu ChatGPT. Giữ bằng chứng, điểm kiểm định và artifact riêng; phản hồi thiếu/sai bằng chứng sẽ cần kiểm định riêng. Sửa bản nháp/dàn ý làm kết quả cũ hết hiệu lực như trước.
- Giữ kiểm định truyện Gemini, xử lý lỗi/bất đồng khi cần và xác minh cuối bằng cả hai AI. Chế độ tự động vẫn chờ duyệt Khóa truyện, số lượng ảnh/video, dựng bản đầu tiên và xem video cuối.
- Thêm tùy chọn bật/tắt rút gọn ở Thiết lập > Chung và ghép nhanh ở Thiết lập > Sản xuất. Có thể chọn 1 hoặc 3 ý tưởng; số lượng mặc định hiện có vẫn giữ nguyên. Thêm kế hoạch “Ít ảnh · giữ video mở đầu”, giảm khoảng một nửa ảnh và giữ đủ 2–3 clip video mở đầu ở chế độ chuẩn; chỉ áp dụng khi người dùng chọn và xác nhận.
- Giữ Bridge 1.1.29, phiên chat theo dự án, tham chiếu nhân vật và quy trình tải TTS/ảnh/video. Không cần reload Bridge cho các thay đổi của 3.1.30. Xem phép đo cùng mẫu và giới hạn tại `docs/RENDER_WORKFLOW_3.1.30.md`. Chưa đẩy GitHub.

## v3.1.29 — Sửa thiết lập TTS và phản hồi thumbnail (local)

- Sửa Bridge xác minh nhầm model AI Studio khi bảng chọn giọng làm phần cài đặt phía sau tạm thời không khả dụng. Hoàn tất chọn giọng trước, mở Run settings nếu bị thu gọn, nhận diện đúng thẻ model hiện tại và chờ tìm Enzo bằng Paste. Vẫn yêu cầu đúng model, Enzo và Friendly trước khi gửi.
- Xử lý đúng màn hình giới thiệu AI Studio ở tab mới trước khi đọc model; chờ ô nhập/cài đặt Flow tải trong giới hạn chuẩn bị ba phút thay vì bỏ qua sau tám lần kiểm tra ngắn. Nhận diện nút Flow “Đã chỉnh sửa xong”, đóng menu do Bridge đã mở trong editor rồi trở về đúng video để tải; giữ giới hạn lỗi và không gửi lại media đã tạo.
- Nhận diện nút tải ảnh tham chiếu mới của Gemini/Flow; chọn nút tải trong menu/dialog trước khi quay lại ô nhập. Flow chọn đúng ảnh Bridge vừa tải từ thư viện thành phần vào scene, chờ xác minh trước khi gửi. Với danh sách Flow thu gọn, mở menu chuột phải trên đúng clip vừa tạo để tìm nút tải. Tab của phiên được đưa lên khi bắt đầu tác vụ tiếp theo để hạn chế trang nền bị chậm tải.
- Gửi cấu trúc JSON thumbnail đầy đủ từ schema của app, kể cả khi dùng prompt tùy chỉnh cũ: enum, số lượng, giới hạn trường và điểm số. Bổ sung danh sách câu trích dẫn nguyên văn từ bản nháp hiện tại để tránh AI tự thay từ trong bằng chứng.
- Phản hồi thumbnail sai cấu trúc hoặc bằng chứng được yêu cầu sửa trong giới hạn thử lại hiện có. Chỉ sửa khi app đã ghi nhận lỗi của đúng lượt, đúng phiên Bridge và đúng nội dung truyện; thay truyện/kế hoạch làm kết quả cũ hết hiệu lực. Không tự gửi lại yêu cầu tạo media đã gửi.
- Cập nhật Bridge 1.1.29; giữ phân công AI v3.1.28, các điểm xác nhận, phiên chat/project, kiểm tra WAV đầy đủ và tải file theo dự án. Cần Reload extension để áp dụng. Chưa đẩy GitHub.

## v3.1.28 — Chuyển phân tích và lập kế hoạch sang ChatGPT (local)

- Chuyển sáu loại tác vụ văn bản sang ChatGPT: `story_dna`, `channel_fit`, `discovery`, `outline_audit`, `retention_audit` và `visual_director`. Giữ nguyên cấu trúc JSON, các bước tiếp theo và điều kiện kiểm tra bằng chứng/thời gian.
- Giữ kiểm định truyện, giải quyết bất đồng và xác minh cuối Gemini để tiếp tục đối chiếu với ChatGPT. Ảnh vẫn tạo bằng Gemini, video bằng Flow và giọng đọc bằng Google AI Studio; Bridge giữ phiên bản 1.1.28.
- Giữ nhà cung cấp đã ghi nhận cho tác vụ đang chờ kết quả và lịch sử đã hoàn thành. Lượt chuẩn bị/chạy lại tác vụ áp dụng phân công mới; không tạo lại truyện, tài nguyên hoặc thay đổi cài đặt dự án. Điểm Channel fit đang hiển thị vẫn là phép so sánh heuristic cục bộ.
- Sửa kiểm tra kế hoạch hình ảnh: dùng đúng ngân sách scene đã tính cho prompt, tránh tính lại số video theo API tổng scene cũ rồi từ chối kế hoạch chuẩn/tối thiểu đúng. Giữ kiểm tra số lượng, thứ tự clip mở đầu và thời lượng như trước.
- Cập nhật nhãn hướng dẫn nhà cung cấp và kiểm thử Bridge gửi/nhận sáu tác vụ, gồm kết quả Gemini còn chờ từ bản cũ. Chưa đẩy lên GitHub.

## v3.1.27 — Thư mục theo tên truyện, dọn tài nguyên và nhịp mở đầu

- Đặt tên thư mục Projects theo tên truyện tiếng Anh, giữ ID và liên kết dự án. Tự chuyển thư mục cũ cùng đường dẫn media/báo cáo; khôi phục tên thư mục dự án đã xóa từ bản sao lưu khi có. Không sao chép hoặc mã hóa lại video. Tên trùng được thêm mã phân biệt; tên làm việc chưa có tiêu đề tiếng Anh dùng `Story Project` tạm thời.
- Thêm **Xóa dữ liệu Tài Nguyên** ở Tổng quan: xem trước số file/dung lượng, xác nhận rồi dọn media, cache render, gói xuất và bản sao Downloads/CapCut đã được xác minh thuộc dự án. Giữ video final hiện tại, hồ sơ truyện, bản nháp, lịch sử ý tưởng và thông tin xuất bản. File dùng chung, liên kết ổ đĩa và bản gốc chưa được ghi nhận được giữ lại.
- Chặn dọn hoặc đổi tên khi dự án đang chạy. Báo file bị khóa để dọn lại; phục hồi đường dẫn khi quá trình đổi thư mục hoặc chuyển final bị gián đoạn. Sau khi dọn, vẫn tải final và chọn ý tưởng khác được; cần bấm **Tạo lại tài nguyên** trước khi dựng/xuất CapCut tiếp.

- Bổ sung Bridge **1.1.28**: nhập bằng Copy/Paste thật qua clipboard ở ChatGPT, Gemini, Flow và Google AI Studio. Kiểm tra đủ nội dung, giữ bản nháp của người dùng, thay đúng prompt scene trước và không gửi lặp. Nếu ChatGPT chuyển văn bản dán thành tệp, chờ xử lý xong và thêm câu lệnh ngắn trước khi gửi; tệp lỗi/bị gỡ hoặc clipboard thay đổi thì dừng để kiểm tra. Cần Reload Bridge để áp dụng quyền clipboard mới.
- Đưa hook/câu hỏi/nghịch lý vào 0–10 giây và xung đột/hệ quả vào 10–30 giây, kịch tính hóa vừa phải bằng hành động và lựa chọn có cơ sở. Đặt cao trào chính và plot twist khoảng 45–55%; phần sau giải thích nguyên nhân, hệ quả và kết thúc, có thể kết mở hợp lý.
- Đồng bộ hướng dẫn ở Ý tưởng, Hồ sơ, Dàn ý, mở đầu, Bản nháp và kiểm định giữ người xem. Kiểm định nhận đoạn giữa/cuối từ đúng bản nháp, dùng thời gian ước lượng từ số từ/WPM. Không tự viết lại truyện cũ hoặc bảo đảm hiệu quả giữ chân người xem.
- Kế hoạch hình ảnh mới dành 2–3 video ở chế độ chuẩn, đặt các clip 10 giây liên tiếp ngay từ 0:00. Giữ chính xác số lượng tùy chỉnh; video bổ sung nằm phía sau. Ảnh phủ phần còn lại, gồm cao trào và kết thúc. Đồng bộ âm thanh thật giữ các clip mở đầu nối tiếp và xử lý ranh giới từ không trùng chính xác 10 giây.
- Tạo một ảnh tham chiếu nhân vật chính trước các clip khi chưa có tham chiếu hợp lệ; dùng chung cho Gemini/Flow và giữ ngoài timeline. Tiếp tục dùng cùng chat/project và khuôn mặt, ngoại hình, trang phục chuẩn. Tham chiếu lỗi được báo ở Tài nguyên, không nhận nhầm file hay tự gửi lặp lại.
- Giữ nguyên tài nguyên/timeline đã tạo, cài đặt render và các điểm xác nhận; dọn media chỉ thực hiện khi người dùng xác nhận thao tác mới.

## v3.1.26 — Nhập Hồ sơ truyện và ưu tiên Ý tưởng 1 (local)

- Thêm “Đã có Hồ sơ truyện” khi tạo dự án. Khóa hai bước Định hướng/Ý tưởng, nhập JSON bằng nội dung dán hoặc file, kiểm tra và lưu hồ sơ rồi tiếp tục từ Dàn ý.
- Kiểm tra summary, characters có tên và world_rules; giữ trường bổ sung, không ghi đè hồ sơ cũ khi nhập lỗi. Lưu từng bản nhập và dấu SHA256. Hồ sơ đã chạy Dàn ý không được thay thế âm thầm bằng lần nhập khác.
- Ý tưởng 1 cố định là biến thể bám sát DNA nguồn; nếu không có nguồn thì là ý tưởng gốc theo kênh. Trích source_core, mô tả phần giữ/chuyển đổi, tách độ bám sát DNA khỏi rủi ro sao chép cách thể hiện. Tạo lại riêng Ý tưởng 1 tối đa hai lần khi các tiêu chí chưa đạt; giữ nguyên các ý tưởng còn lại.
- Chế độ Tự động có kiểm duyệt luôn chọn Ý tưởng 1 sau thử nghiệm, kể cả khi ý tưởng khác có tổng điểm cao hơn. Dừng để người dùng duyệt Khóa truyện, chốt số lượng ảnh/video và bắt đầu dựng bản đầu tiên. Sau duyệt Khóa truyện, TTS chạy độc lập trong lúc chờ chốt hình ảnh. Vẫn cần xem và xác nhận video cuối.
- Giữ luồng Thủ công/Có hỗ trợ và các tính năng tài nguyên, Bridge, render, thumbnail, metadata hiện có. Cập nhật local; chưa đẩy GitHub.

# Changelog

## 3.1.25 — 2026-10-07 (local only)

- Replace generic SEO metadata with story packaging: extract concrete anchors and anomalies from the Bible, outline and current draft; generate three title strategies with exact supporting quotes and an optional genre suffix.
- Add a primary semantic keyword cluster, usually 4–8 tags and 2–3 hashtags, natural spoiler-light descriptions and configurable channel fiction disclosure. Preserve platform limits and reject positive true-event claims for fiction.
- Store optional channel traffic percentages and attributed keyword evidence; reuse them across projects. Keep missing data unknown and distinguish story/editorial inference from creator-supplied research.
- Show editorial scores, recommendation notes and thumbnail word-overlap risk without claiming CTR or retention predictions. Let the user choose a variant before applying metadata to the publishing form; extend TXT exports while retaining legacy fields.
- Add three story-grounded thumbnail concepts: a concrete anomaly, human stakes and setting/atmosphere, with evidence-based alternatives when needed. Default to one selected image; optionally generate A/B/C sequentially in the existing Gemini project conversation.
- Make thumbnail overlay text optional or a short 1–4-word headline. Reuse optional channel treatment, retain the existing 2–3-font/two-accent preferences and store attributed research observations without claiming causal performance.
- Show actual 320 × 180 image previews and file/dimension checks separately from editorial concept scores. Bind creator image reviews to the exact asset and plan; use confirmed visual concepts for semantic title/image pairing without substituting lexical overlap for quality.
- Export thumbnail concepts, evidence and image reviews for manual YouTube Studio testing. Preserve earlier thumbnails and report missing A/B/C variants independently; keep the existing narration queue, scene count confirmation and rendering behavior.
- Preserve story content, render settings, resource automation and Bridge 1.1.27. Existing metadata can be regenerated with the new contract. No GitHub publication.

## 3.1.24 — 2026-10-06 (local only)

- Keep project-scoped Gemini chats, AI Studio dialogs and Flow projects through failed scenes and browser restarts; restore recorded pages and narration settings without resending a failed prompt. Save session URLs and owned prompt evidence locally; report missing resources when a session cannot be recovered.
- Attach consistent character references to Gemini/Flow scene prompts. Default to the first verified scene image, allow up to three optional image references and preserve a fixed reference snapshot for each request. Scope Gemini downloads to the submitted scene prompt and wait for old results and reference uploads to settle.
- Save final_video.mp4 directly to the project's Downloads folder, reuse its existing media folder and avoid overwriting previous downloads. Preserve playback and other output downloads. Include Browser Bridge 1.1.27.
- Preserve idea usage after deleting a derived project; block reuse of deleted used ideas and protect the shared original pool from individual/bulk project deletion.
- Mark projects developed from a selected idea, link back to the original pool and open an existing derived project from a used idea. Backfill history for existing projects without changing their stories/settings.

- Mark selected and previously used ideas in the original pool and prevent selecting them again.
- Create a separate project containing only the chosen idea, preserving its channel, source and content direction; start directly at Story Bible.
- Skip premise regeneration once an idea is selected, including pipeline continuation; supersede legacy paused generation when branching from an approved finished project.
- Preserve the finished project, video and all other features/settings. Not published to GitHub.

## 3.1.23 — 2026-10-05 (local only)

- Give AI thumbnails a story-grounded curiosity headline, one clear visual clue, 2–3 complementary typefaces and two contrasting text/accent colors. Adapt atmosphere to the channel and content direction, preserve the published title and avoid revealing the ending or inventing a viewer promise.
- Make scene-image prompts photographic and grounded in the scene's actual light, weather, materials and character continuity. Apply the same image direction when copying a prompt, queueing one image or running automatic media generation, including existing visual plans.
- Preserve scene counts, word ranges, audio/video timing, Flow prompts, attached resources, local thumbnail composition and all other features/settings. Include Browser Bridge 1.1.26. Not published to GitHub.

## 3.1.22 — 2026-10-05

- Complete the retention fix after testing a real Gemini reassessment. Accept only display-format differences in whitespace, double-quote delimiters and straight/curly apostrophes; retain the exact original source passage and its word/WPM timing in the saved audit.
- Keep changed words, contractions, order, ellipses and misplaced evidence rejected. Let the existing bounded corrective retry handle an evidence quotation that genuinely differs from the current draft, including pending legacy pauses.
- Include Browser Bridge 1.1.26. Preserve all other features, settings and project data.

## 3.1.21 — 2026-10-05

- Match retention evidence against the same word/WPM clock used for narration estimates. Include exact text for every time zone, support quotations crossing a boundary or repeated in the draft, and bound adjacent context to 15 seconds independently of word length.
- Send only the current draft, selected packaging and relevant channel context for retention assessments. Exclude old drafts and source transcripts; require Gemini to assess the supplied passage for each time zone.
- Report the rejected zone, measured quote times and quote excerpt. Automatically request a corrected retention assessment after a verified current rejection, within the existing three-retry budget and ownership/attempt guards. Keep independent quality checks and reject false passes.
- Include Browser Bridge 1.1.25, which resumes an existing legacy retention pause by reading its already-sent answer before requesting any correction. Preserve other features and settings.

## 3.1.20 — 2026-10-05 (local only)

- Add genre-aware title/thumbnail promises, three opening variants, timed retention evidence and targeted repairs. Keep story integrity, retention readiness and packaging alignment separate; prior projects without these assessments remain usable.
- Store optional observed YouTube metrics, actual packaging versions and units. Add dismissible in-app 7/28-day reminders, comparable channel medians and conservative pattern learning without requiring metrics or changing channel DNA.
- Automatically lock a story when its current required verifications pass and start narration production in Browser Bridge mode. Preserve final video viewing approval and unresolved human review requirements.
- Allow visual count review and replacement plans during automatic TTS. Persist the latest approved plan, run it after narration, and require explicit image/video count confirmation before generating visual resources.
- Skip an owned media item on browser/setup/generation/download failure; continue the batch, reject late results and show missing filenames/reasons in Assets. Detect lost Bridge heartbeats and keep unclaimed queues waiting. Preserve complete-WAV checks and reusable provider tabs.
- Include Browser Bridge 1.1.24, schema migration preserving existing rows/settings, Vietnamese controls and versioned local installer/source/portable archives. Not published to GitHub.

## 3.1.19 — 2026-10-04 (local only)

- Download AI Studio's complete WAV through its Download button and capture the assembled file instead of an individual streaming preview packet. Wait for a stable visible total-time counter and check it against the downloaded file when available.
- Capture AI Studio's observed sandbox download even when its WAV Blob has no MIME type. Preserve all bytes, and keep any large base64 download data out of extension storage by passing a page-owned blob URL.
- Keep compact, cached identities for prior AI Studio audio and identify new results by their authorized job and unchanged editor. Full base64 WAVs remain in the provider page so the next narration scene cannot overflow Bridge storage.
- Reject implausibly short narration or a WAV whose duration disagrees with AI Studio before assigning it or advancing the queue. Continue retries downloading the existing result without another Run; a new narration batch regenerates invalid existing clips and keeps valid assignments.
- Match the content-script version to the installed Bridge so provider tabs receive the updated adapter after extension reload. Include Browser Bridge 1.1.23. Preserve other features and settings; not published to GitHub.

## 3.1.18 — 2026-10-04 (local only)

- Leave Flow's owned clip editor with Xong / Done and wait for the project grid before downloading. Do not wait for a VIDEO element in its canvas player or mistake the editor timeline for a running generation.
- Persist the selected result across worker/content reloads, scope Download / More options to that result, and defer capture while the editor is closing. Resume existing results without sending another generation request.
- Reserve at least 10 seconds of corresponding narration for each new video scene. Rebalance contiguous word ranges using WPM initially and measured audio at the first sync, including the native duration of an assigned video. Images absorb the remaining time; reject insufficient narration without trimming/looping video or moving synced video starts. Exclude the separate outro from the story's video budget.
- Include Browser Bridge 1.1.15. Preserve other features and settings; not published to GitHub.

## 3.1.17 — 2026-10-03 (local only)

- Add Delete channel on channel cards and in the channel studio. Preview all owned projects before confirming deletion, preserve library sources, and optionally remove private project media using the existing shared-file protections. Active work and stale confirmations block deletion.
- After approving the current final video, choose another candidate premise to create a separate project with the same source, content direction, duration and candidate evaluations. Keep the finished story, assets and video unchanged; repeated clicks open the existing new project.
- Preserve the selected production mode and existing quality gates. Include Vietnamese controls and help. Install locally; not published to GitHub.

## 3.1.16 — 2026-10-03 (local only)

- Ignore Gemini's internal offscreen Quill clipboard when finding the prompt editor. Capture its full-resolution PNG download from the provider's sandbox message instead of saving a preview or leaving the file outside the project folder.
- Read Flow's selected model from its visible caption even when its accessible label is generic. Verify Omni 1.1 Flash, Video / Ingredients, 16:9, 720p, 10 seconds and x1 before Send.
- Preserve the media resume stage while the app is offline. Recover an exact completed download when its ID was not saved, and retry an interrupted/missing download of the existing result without regenerating it.
- Remember the Flow project URL during setup and reopen a closed unsent tab only after checking its backend claim. Already-sent jobs never reopen generation or send again.
- Validate actual downloads and imports using two Enzo/Friendly TTS clips plus a confirmed visual batch of one thumbnail, one scene image and two videos. Include Browser Bridge 1.1.14. Preserve other features/settings; not published to GitHub.

## 3.1.15 — 2026-10-03 (local only)

- Fix AI Studio's Enzo voice picker staying open and Friendly style being repeatedly selected because its accessible name remains Style. Verify the selected voice and close the actual picker before filling narration.
- Remember the exact prompt prepared by Bridge for each media tab across worker/extension restarts. Replace only that original prompt when moving to the next scene; preserve user edits.
- Reconnect the content listener before downloading an existing output after extension reload. Explicitly resuming an interrupted download retrieves the existing result without generating again; keep completed and in-progress downloads intact.
- Explain Comet's per-file Save As preference and the Downloads setting needed for unattended downloads. Include Browser Bridge 1.1.13. Preserve all other features/settings; not published to GitHub.

## 3.1.14 — 2026-10-03 (local only)

- Recover unescaped quoted dialogue and literal line breaks inside otherwise complete AI JSON strings without changing evidence, issues, severity or references. Continue rejecting missing separators, incomplete structure and ambiguous quoting; keep existing schema and draft/attempt checks.
- Use the same reader for manual paste and Bridge results. Bridge 1.1.12 prefers the provider's raw Copy source and asks the app for read-only syntax recovery only when normal JSON parsing fails. Valid JSON takes the existing fast path; successful recovery never resends the prompt.
- Clarify JSON escaping in the Gemini story audit prompt. Preserve all other features/settings and render optimizations. Local installer and extension only; not published to GitHub.

## 3.1.13 — 2026-10-03 (local only)

- Reuse validated narration, audio mixes, composed timelines and lossless keyed waveform cycles. Rebuild only stages affected by source, timing, format or audio-gain changes; keep previous completed outputs intact.
- Use a pinned, separately bundled FFmpeg compatibility renderer when it restores working NVIDIA encoding on the installed driver. Preserve explicit FFmpeg paths and CPU mode, and retain hardware/CPU fallback.
- Accelerate waveform/logo composition with CUDA where available, encode scene groups with NVENC, and join compatible cuts by packet copy. Retain bounded transition graphs, original video anchors/durations, image motion, captions and exact logo/waveform canvas.
- Add cache invalidation/recovery, GPU fallback and real pixel/timing regression coverage, plus stage timings in render diagnostics. Successful attempts prune only obsolete, marked cache entries.
- Keep all other features/settings and Browser Bridge 1.1.11 unchanged. Installer built locally; not published to GitHub.

## 3.1.12 — 2026-10-03 (local only)

- Add sequential resource generation/download through Browser Bridge 1.1.11, with one reusable AI Studio, Gemini and Flow tab. Wait for page load and stable controls before filling or submitting.
- Start missing narration immediately with AI Studio Create new dialog, Enzo and Friendly. Download tts_001.wav, etc. into Downloads/<project title> and attach each completed file to its exact chunk.
- Require explicit confirmation of the current image/video plan counts before creating any visual resource. Create the thumbnail first, then scene_001.png/mp4, etc. in order. Verify Flow Video / Ingredients / 16:9 / Omni 1.1 Flash / 720p / 10 seconds / x1, without silently selecting another model.
- Add the Bridge downloads permission, track completed download IDs and use saveAs:false to avoid per-file pickers. Keep existing resources by default; allow regeneration and stopping a batch. Recovery never resubmits an uncertain generation.
- Preserve manual workflows, native CapCut export, rendering and other settings. No GitHub publication in this update.

## 3.1.11 — 2026-10-02 (local only)

- Replace the CSV/media CapCut handoff with native CapCut Desktop project export, tested with CapCut International 9.5 on Windows.
- Copy assigned media into a new, independent draft. Re-probe narration/video durations and use the existing video anchors, image coverage and ending thumbnail without rendering the complete video in StoryForge.
- Create editable scene/narration tracks, background audio/SFX, selected subtitles, native-size green-screen waveform loops with sampled chroma key, and the topmost transparent PNG logo.
- Show export progress and the resulting project folder. Preserve existing project/archive exports, settings, workflows and Browser Bridge 1.1.10.

## 3.1.10 — 2026-10-02

- Add an optional Vietnamese reading pane in Source material, supporting English and Chinese transcripts. Keep the original JSON editor, source fields, analysis prompts and adaptation workflows unchanged.
- Translate visible chunks on the device with one background queue; cache display translations separately by source language and reuse them across reloads. No workflow jobs or translated source data are saved to the backend.
- Retain all settings, render behavior and Browser Bridge 1.1.10.

## 3.1.9 — 2026-09-30

- Sample the uploaded waveform video's actual green background instead of assuming pure #00FF00. Preserve its native canvas, speed, loop and position below the logo.
- Compose scenes in groups of at most six inputs, preserving frame-aligned video positions and transitions between groups. Apply captions/waveform/logo once to the assembled video.
- Replace fixed render deadlines with a progress watchdog: keep advancing renders running, stop after 15 minutes without frame/time advancement, and retain useful failure details and the previous completed video.
- Keep GPU final encoding and scene cache; use a fast CPU intermediate to avoid Quick Sync chroma changes during concat/xfade. Remove completed temporary join files after technical QA.

## 3.1.8 — 2026-09-30 (local only)

- Add per-project standard, half-count minimum and custom image/video budgets; validate AI counts before replacing the plan and prioritize main story beats.
- Display visual scenes as scene_001, scene_002, etc., retaining existing IDs and assets.
- Probe hardware encoding, use NVENC/Quick Sync when available and fall back to CPU. Encode final H.264 at 5 Mbps target with hardware, quality-based VBR with CPU, AAC 160 kbps.
- Prepare up to two scenes concurrently and reuse validated scene cache on rerenders while preserving fixed video timing and all existing overlays.

## 3.1.7 — 2026-09-29

- Preserve video starts and native duration; resize only image scene timing. Use frame-aligned cuts around videos, with transitions retained between images.
- Fill remaining audio after the final video with the assigned project/ending thumbnail. Report conflicting timing instead of trimming, looping or shifting video.
- Apply transparent full-canvas PNG overlays at 0,0 without resizing/repositioning, validating format and output dimensions.
- Use a selected green-screen asset for waveform: remove green, loop to output duration at original size/position, discard overlay audio and composite below the logo.
- Keep other features and Browser Bridge 1.1.10 unchanged.

## 3.1.6 — 2026-09-29

- Render assigned images/videos regardless of filename or planned visual type. Loop short videos when no fallback image is assigned and sync narration timing before every render.
- Add asset selection and confirmed single/bulk removal, preserving source files, shared imports and completed renders.
- Add per-project subtitles, moving audio waveform and topmost channel-logo overlay options. Defaults preserve subtitle behavior; waveform replaces subtitles.
- Retain Browser Bridge 1.1.10 and existing story workflows.

## 3.1.5 — 2026-09-28

- Browser Bridge 1.1.10 waits at least five seconds after the provider tab finishes loading, then observes an editable composer stable for at least two seconds before filling a prompt.
- Loading/reloading resets the settling period. The wait survives worker restarts and respects cancellation, disabling automation, and the existing preparation deadline.
- Readiness probes do not focus or modify the editor and time out on frozen tabs. Existing prompt verification, single-send protection, and response collection are preserved.
- Reload Browser Bridge after installing the update.

## 3.1.4 — 2026-09-28

- Browser Bridge 1.1.9 waits for the current ChatGPT response's completion controls before parsing or retrying, even when the Stop selector changes. Explicit thinking units are excluded from capture.
- Reinjection restores a disconnected same-version content listener after Reload, preserving the per-tab sent-job guard.
- Includes all ChatGPT answer collection fixes from 3.1.3. Other workflows and settings remain unchanged.

## 3.1.3 — 2026-09-28

- Browser Bridge 1.1.8 recognizes ChatGPT's current search-unit and assistant Markdown renderer, including response identity across virtualized turns.
- Recover original JSON escapes through the matching response's Copy action when rendered Markdown is not valid JSON; restore clipboard methods immediately afterward without reading the user's clipboard.
- Bound stalled tab reads and reconnect within the existing collection deadline, without sending the prompt again.
- Resume one legacy collection pause after upgrading the renderer; accepted results still close only their dedicated, unchanged provider tab.
- Log whether a result arrived from automatic collection or a manual action to make future diagnostics verifiable.
- Existing workflows and settings are unchanged. Reload Browser Bridge after installation.

## 3.1.2 — 2026-09-28

- Browser Bridge 1.1.7 recognizes additional ChatGPT composers, including Vietnamese inputs and rich text editors without the previous element ID.
- Continue collecting slow replies within a bounded 15-minute window instead of stopping after three minutes; recover an already-sent legacy timeout by polling only.
- Read all blocks of the latest assistant message and use message identity when rendered message counts stay unchanged.
- Bounded recovery reconnects pre-send tasks after delayed editor loading or a closed message channel, preserving user drafts and single-send authorization.
- Verify the filled prompt before sending; keep existing project settings and workflows.
- Reload the unpacked Browser Bridge extension after installing this update.

## 3.0.0 — 2026-09-17

- First local Windows implementation from the StoryForge US master specification.
- FastAPI/SQLite backend with durable jobs, versioned artifacts and offline fixture provider.
- Channel/source/project workflow, duration profiles, premise mini-tests and human checkpoints.
- Cross-model audit claims, independent cross-review, disagreement resolution, targeted repairs and exact-version dual verification.
- Semantic TTS, visual plans, file validation/mapping, actual-audio sync, captions and FFmpeg render/QA.
- Manual analytics snapshots, observational learning, calendar and global novelty guards.
- Chrome/Edge MV3 Browser Bridge with explicit UI controls and copy/paste fallback.
- Windows launcher, installer scripts, portable release, demo database and automated tests.
- Manual/Assisted/Auto execution semantics, saved premise defaults, responsive navigation and verification invalidation when story context changes.
