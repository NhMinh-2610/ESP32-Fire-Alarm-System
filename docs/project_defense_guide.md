# TÀI LIỆU ÔN TẬP BẢO VỆ ĐỒ ÁN IOT: HỆ THỐNG CẢNH BÁO CHÁY

Tài liệu này được biên soạn ngắn gọn, đúng trọng tâm để giúp bạn trả lời các câu hỏi của thầy cô về kiến trúc code, chức năng của từng thành phần, và **đặc biệt là lộ trình phát triển (chia làm 2 ngày/giai đoạn) để giải thích quá trình hoàn thiện code.**

---

## BÁO CÁO TIẾN ĐỘ PHÁT TRIỂN (KỊCH BẢN CHIA 2 NGÀY PULL)

Khi bảo vệ, nếu thầy cô hỏi về quá trình làm code, bạn có thể giải thích theo lộ trình 2 giai đoạn sau để chứng minh sự am hiểu và liên tục tối ưu hệ thống:

### Ngày 1: Xây dựng nền tảng và Sửa lỗi phần cứng
1. **Thiết lập luồng MQTT:** Kết nối thành công ESP32 ↔ MQTT Broker ↔ Web Server Node.js. Chuyển đổi dữ liệu thành định dạng JSON.
2. **Sửa lỗi cảm biến lửa (False Positive):** Ban đầu hệ thống thỉnh thoảng báo cháy giả. Nhóm đã phát hiện ra chân GPIO32 trên ESP32 là chân "ADC-only" (chỉ đọc Analog), việc dùng hàm `digitalRead()` sinh ra nhiễu.
   -> *Giải pháp Ngày 1:* Chuyển sang đọc Analog (`analogRead`), lấy trung bình 5 lần đọc và giảm ngưỡng `FLAME_ANALOG_THRESHOLD` xuống 800 để lọc hoàn toàn nhiễu hồng ngoại từ ánh sáng mặt trời.
3. **Phân loại 3 mức độ cơ bản:** 
   - Mức 1: An toàn.
   - Mức 2: Khói bất thường hoặc Nhiệt độ cực cao.
   - Mức 3: Phát hiện ngọn lửa, hoặc (Khói tăng + Nhiệt tăng cùng lúc).

### Ngày 2: Tối ưu độ trễ và Bổ sung logic chống thảm họa
Dựa trên thử nghiệm thực tế, nhóm đã cập nhật code thêm 3 tính năng nâng cao:
1. **Tăng tốc độ phản hồi:** Giảm chu kỳ đọc cảm biến từ 2 giây xuống 1 giây. Giảm số lần xác nhận tín hiệu lửa. Hệ thống giờ đây phản hồi cháy chỉ trong khoảng ~2 giây.
2. **Logic Chống chập cháy Sensor:** Bổ sung tính năng phát hiện "Short-circuit". Nếu lửa bùng quá nhanh thiêu rụi mạch, giá trị analog của chân cảm biến lửa sẽ sụt về gần 0 (`< 50`). Code tự động nhận diện đây là thảm họa và ép hệ thống lên Mức 3 ngay lập tức.
3. **Cập nhật Logic Mức 3 (Cháy ngầm):** Bổ sung thêm điều kiện: Nếu lượng khói cực kỳ dày đặc (vượt ngưỡng `MQ2_DANGER_DELTA = 1400`), hệ thống sẽ **báo động Mức 3 ngay lập tức dù nhiệt độ chưa kịp tăng**. (Bảo vệ trường hợp cháy ngầm sinh ra nhiều khí độc trước khi bùng lửa).
4. **Bỏ cơ chế giữ trạng thái:** Xóa bỏ bộ đếm giữ Mức 3 nhân tạo để hệ thống phản ánh 100% thời gian thực theo đúng trạng thái vật lý của cảm biến.

---

## 1. Code này gồm những gì? (Kiến trúc hệ thống)
Hệ thống được chia làm 2 phần code chính, hoạt động độc lập và giao tiếp với nhau qua giao thức MQTT.

### Phần 1: Firmware ESP32 (Ngôn ngữ C++ / Khung làm việc Arduino)
Nằm trong thư mục `firmware/`. 
- **Cấu trúc code:** Gồm file `main.cpp` chứa logic chính và `config.h` chứa các hằng số cài đặt.
- **Thư viện sử dụng:** `WiFi` (kết nối mạng), `PubSubClient` (giao tiếp MQTT), `ArduinoJson` (đóng gói dữ liệu), `DHT` (cảm biến nhiệt ẩm), `ESP32Servo` (điều khiển cửa).

### Phần 2: Web Server (Ngôn ngữ JavaScript / Môi trường Node.js)
Nằm trong thư mục `web-server/`.
- **Cấu trúc code:** Gồm mã nguồn Backend (chạy trên máy chủ Node.js) và Frontend (giao diện web HTML/CSS/JS).
- **Thư viện sử dụng:** `Express` (tạo web server), `Mqtt.js` (giao tiếp với MQTT Broker), `Socket.IO` (truyền dữ liệu thời gian thực).

---

## 2. Code làm những công việc gì? (Luồng hoạt động)

### Phía ESP32 làm gì?
1. **Thu thập dữ liệu:** Đọc liên tục (mỗi 1 giây) các cảm biến: Nhiệt độ/Độ ẩm (DHT11), Khói/Khí gas (MQ-2), và Lửa (Hồng ngoại IR - chế độ Analog).
2. **Xử lý logic tại chỗ (Edge Computing):** Tự động phân tích dữ liệu để chia ra 3 cấp độ:
   - *Cấp 1 (An toàn):* Mọi thứ bình thường.
   - *Cấp 2 (Cảnh báo):* Có khói bất thường hoặc nhiệt độ quá cao (> 60 độ). (Bật đèn LED đỏ nháy).
   - *Cấp 3 (Khẩn cấp):* Phát hiện lửa, hoặc vừa có khói vừa có nhiệt cao, **HOẶC khói vượt ngưỡng nguy hiểm**, HOẶC đứt/chập mạch cảm biến lửa. (Hú còi, nháy đèn, tự động mở Servo giả lập cửa thoát hiểm).
3. **Đóng gói & Gửi dữ liệu:** Đóng gói thông số thành chuỗi JSON và gửi lên MQTT Broker. Lắng nghe lệnh điều khiển từ Web.

### Phía Web Server làm gì?
1. **Lắng nghe dữ liệu:** Kết nối với MQTT Broker và "nghe" (Subscribe) những gói tin JSON do ESP32 gửi lên.
2. **Cập nhật giao diện theo thời gian thực:** Dùng Socket.IO bắn dữ liệu ra ngoài giao diện web ngay lập tức (hiển thị biểu đồ, trạng thái cửa).
3. **Gửi lệnh điều khiển:** Khi người dùng bấm nút trên Web (VD: Mở cửa khẩn cấp), Web Server gửi lệnh xuống MQTT Broker để ESP32 thực thi.

---

## 3. Câu hỏi về MQTT và Web (Phần thầy cô hay xoáy sâu)

> [!IMPORTANT]
> **Câu hỏi 1: Tại sao lại dùng MQTT mà không dùng HTTP (gọi API thông thường)?**
> **Trả lời:** Vì MQTT nhẹ hơn, ít tốn băng thông và phản hồi nhanh hơn HTTP rất nhiều. Hoạt động theo cơ chế **Publish/Subscribe**. Khi có cháy, tín hiệu truyền đi gần như ngay lập tức (độ trễ mili-giây), thay vì phải "hỏi liên tục" (polling) như HTTP gây trễ.

> [!NOTE]
> **Câu hỏi 2: Broker ở đây đóng vai trò gì?**
> **Trả lời:** Broker là "trạm trung chuyển". ESP32 và Web Server không nói chuyện trực tiếp với nhau, mà đều nói chuyện qua Broker thông qua các "Chủ đề" (Topic). Điều này giúp hệ thống dễ dàng mở rộng nhiều thiết bị.

> [!TIP]
> **Câu hỏi 3: Làm sao dữ liệu từ Backend Node.js lên được giao diện Web mà không cần F5 tải lại trang?**
> **Trả lời:** Dạ nhóm em dùng **WebSockets (thư viện Socket.IO)**. Kết nối giữa trình duyệt Web và Node.js là đường ống hai chiều luôn mở. Khi Node.js nhận data từ MQTT, nó đẩy trực tiếp qua ống này ra biểu đồ.

> [!WARNING]
> **Câu hỏi 4: Logic phân tích cháy nằm ở ESP32 hay nằm trên Web?**
> **Trả lời:** Nằm trên ESP32. Web chỉ dùng để hiển thị và lưu trữ. Lý do: Khi đứt cáp quang hoặc mất mạng Wi-Fi, ESP32 vẫn phải tự quyết định việc hú còi và mở cửa thoát hiểm tại chỗ để cứu người. Hệ thống an toàn sinh mạng không được phụ thuộc vào mạng Internet.
