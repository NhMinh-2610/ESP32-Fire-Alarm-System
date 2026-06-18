# 📡 Kiến trúc MQTT Broker & Phân tích Hoạt động

Tài liệu này giải thích chi tiết cách hệ thống truyền thông MQTT hoạt động trong dự án, giúp bạn dễ dàng ôn tập và bảo vệ đồ án trước hội đồng.

---

## 1. Cơ chế hoạt động tổng quan (Mô hình Bưu điện)

Hệ thống giao tiếp thông qua mô hình **Publish / Subscribe** (Xuất bản / Đăng ký). Để dễ hình dung, hãy coi MQTT Broker là một **Trạm Bưu Điện**.

1. **Trạm Bưu Điện (MQTT Broker - `broker.js`)**: Không tạo ra dữ liệu, chỉ đứng ở giữa nhận thư và chuyển phát thư dựa trên địa chỉ (Topic). Nó có bảo vệ gác cổng (Yêu cầu Username/Password).
2. **Người Gửi (Publisher - ESP32)**: Cứ mỗi 2 giây, đóng gói dữ liệu cảm biến (Nhiệt độ, Gas) thành một bức thư và gửi lên Bưu Điện vào hòm thư `.../telemetry`.
3. **Người Nhận (Subscriber - Web Server)**: Đăng ký với Bưu Điện rằng: *"Cứ có thư nào vào hòm `.../telemetry` thì gửi ngay cho tôi"*.

Khi bạn bấm nút **"Mở cửa"** trên Web:
- Web Server trở thành *Người Gửi*, ném một bức thư lệnh `{"action": "OPEN"}` vào hòm `.../led_control`.
- ESP32 trước đó đã dặn Bưu Điện theo dõi hòm này, nên lập tức Bưu Điện chuyển bức thư đó xuống cho ESP32. Nhận được chữ OPEN, ESP32 quay Servo mở cửa.

---

## 2. Giải thích chi tiết code `broker.js`

File `mqtt-broker/broker.js` được viết cực kỳ tinh gọn nhờ tận dụng thư viện `aedes`. Dưới đây là ý nghĩa của từng phần:

```javascript
const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
```
- Thư viện `aedes` xử lý toàn bộ logic phức tạp của giao thức MQTT ở tầng dưới (đọc byte nhị phân, xử lý cờ QoS...).
- `net.createServer` mở ra một cổng mạng (TCP) để các thiết bị có thể cắm dây (kết nối) vào.

```javascript
aedes.authenticate = (client, username, password, callback) => { ... }
```
- Đây là **Chốt chặn bảo mật (Bảo vệ gác cổng)**. Mỗi khi ESP32 hay Web Server xin kết nối, hàm này chạy.
- Nó so sánh `username` và `password` gửi lên với biến môi trường trong file `.env` (`admin` / `firealarm_secure_2026`). Nếu đúng thì cho vào `callback(null, true)`, sai thì đuổi ra `callback(null, false)`.

```javascript
aedes.on('client', (client) => { console.log(...) });
aedes.on('clientDisconnect', (client) => { ... });
```
- Đây là bộ phận **Giám sát (Logging)**. Nó báo cáo ra màn hình màu sắc đẹp mắt khi có ai đó (ESP32) vừa kết nối vào hay rớt mạng. Rất hữu ích khi demo cho giáo viên thấy hệ thống đang chạy.

---

## 3. Liên kết với các file trong hệ thống

Broker độc lập (`broker.js`) sẽ tương tác trực tiếp với 2 thành phần chính:

### A. Tương tác với Web Server (`web-server/src/services/mqttService.js`)
Trong Web Server, chúng ta sử dụng thư viện `mqtt.js` (là một client MQTT) để kết nối ngược lại lên Broker.
- Khi khởi động, file `config.js` cung cấp cấu hình `mqtt://127.0.0.1:1883` cùng Username/Password.
- `mqttService.js` đăng ký (subscribe) các topic và hứng dữ liệu, sau đó phát (emit) qua Socket.IO lên giao diện cho người dùng xem.

### B. Tương tác với ESP32 (`firmware/src/main.cpp`)
Trong ESP32, chúng ta dùng thư viện `PubSubClient` (của Nick O'Leary).
- ESP32 đọc cấu hình `MQTT_SERVER`, `MQTT_USER`, `MQTT_PASSWORD` từ file `config.h`.
- Khối code `#if defined(MQTT_USER)... client.connect(...)` sẽ đẩy thông tin đăng nhập lên Broker. 
- Ngay khi kết nối, ESP32 gọi `client.subscribe(MQTT_CONTROL_TOPIC)` để dọn sẵn sàng lắng nghe lệnh điều khiển từ trên Web giáng xuống.

---

## 4. Câu hỏi phản biện: Tại sao tự code Node.js thay vì dùng app có sẵn (Mosquitto)?

Nếu giáo viên thắc mắc tại sao code đơn giản vậy mà lại phải tự viết, tại sao không dùng phần mềm Mosquitto hay HiveMQ, bạn hãy dùng 3 ý sau để trả lời:

1. **Khả năng làm chủ và linh hoạt:** Dùng app có sẵn như một "Hộp đen", không thể can thiệp sâu. Tự viết bằng Node.js giúp em làm chủ hoàn toàn quá trình xác thực. Ví dụ, sau này em có thể dễ dàng code thêm phần: *Đọc User/Pass từ trong Database (MySQL/SQLite)* thay vì dùng file text cứng.
2. **Khả năng mang đi triển khai (Deploy):** Tất cả môi trường của em đều được đóng gói bằng Node.js. Chỉ cần gõ lệnh `npm start` là cả Web Server và MQTT Broker chạy song song. Đi thi hay chuyển máy tính cực kỳ nhanh gọn mà không bắt giám khảo cài đặt rườm rà.
3. **Phân chia mục đích Scale (Mở rộng):**
   - Em biết Mosquitto (viết bằng C) cực kỳ mạnh để gánh tải hàng chục triệu thiết bị (Scale to Millions).
   - Tuy nhiên, với hệ thống Smart Home / IoT vừa và nhỏ (vài chục ngàn thiết bị), dùng Aedes trên Node.js là quá dư sức gánh tải, lại mang đến sự tiện lợi tối ưu cho lập trình viên. Do đó, việc chọn Aedes là một sự **Đánh đổi có tính toán (Trade-off)** trong thiết kế phần mềm của em.
