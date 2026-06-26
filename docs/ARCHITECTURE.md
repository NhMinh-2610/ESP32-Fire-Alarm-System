# ️ Kiến trúc hệ thống — ESP32 Fire Alarm System

Hệ thống được thiết kế theo kiến trúc **Microservices phân tán** và sử dụng giao thức **MQTT** làm xương sống để truyền tải dữ liệu theo thời gian thực. Hệ thống bao gồm 4 thành phần chính:

---

## 1. Sơ đồ Kiến trúc Tổng thể

```mermaid
graph TB
 subgraph SENSOR[" Lớp Cảm biến (Hardware)"]
 direction LR
 S1["️ DHT11/22<br/>(Nhiệt độ & Độ ẩm)"]
 S2[" MQ-2<br/>(Khí Gas/Khói)"]
 S3[" IR Sensor<br/>(Cảm biến Lửa)"]
 end

 subgraph MCU[" Vi điều khiển (ESP32)"]
 direction TB
 WIFI[" WiFi Module"]
 LOGIC["️ Thu thập & Xử lý Logic"]
 ACTUATOR["️ Cơ cấu chấp hành"]
 end

 subgraph CLOUD["️ Private MQTT Broker"]
 HMQ[" Mosquitto (Local)<br/>Port: 1883<br/>Auth: admin / pass"]
 end

 subgraph SERVER["️ Lớp Máy chủ (Node.js)"]
 direction TB
 EXPRESS[" Express.js<br/>(Web Server)"]
 MQTTS[" MQTT Client<br/>(Node.js)"]
 SOCKETIO[" Socket.IO<br/>(Giao tiếp Real-time)"]
 SQLITE[" SQLite<br/>(Lưu trữ dữ liệu)"]
 end

 subgraph CLIENT[" Lớp Giao diện (Client UI)"]
 direction TB
 HTML[" Web Dashboard"]
 CHART[" Chart.js"]
 SOCK[" Socket.IO Client"]
 end

 S1 & S2 & S3 --> MCU
 MCU --> ACTUATOR
 ACTUATOR --> ACT1[" Servo (Cửa)"]
 ACTUATOR --> ACT2[" Còi hú (Buzzer)"]
 ACTUATOR --> ACT3[" Đèn LED (Đỏ/Xanh)"]

 WIFI <-->|"MQTT (Auth)"| HMQ
 HMQ <-->|"MQTT (Auth)"| MQTTS

 MQTTS --> SQLITE
 MQTTS --> SOCKETIO
 SOCKETIO <-->|"WebSocket"| SOCK
 SOCK --> CHART
 CHART --> HTML
 EXPRESS --> HTML
```

---

## 2. Hoạt động của MQTT Broker (Mô hình Bưu điện)

Toàn bộ luồng dữ liệu (Telemetry) và luồng điều khiển (Control) đều đi qua **MQTT Broker (Mosquitto)** nội bộ. Để dễ hình dung, hãy coi MQTT Broker là một **Trạm Bưu Điện**.

1. **Trạm Bưu Điện (MQTT Broker)**: Nhận thư và chuyển phát thư dựa trên địa chỉ (Topic). Hệ thống bảo mật yêu cầu **Thẻ VIP (Username/Password)** để kết nối.
2. **Người Gửi (Publisher - ESP32)**: Định kỳ gửi dữ liệu cảm biến vào hòm thư (Ví dụ: `nguyennhatminh_20225886/telemetry`).
3. **Người Nhận (Subscriber - Web Server)**: Đăng ký nhận thư từ hòm `.../telemetry`. Cứ có dữ liệu mới, Bưu điện sẽ lập tức chuyển đến Web Server để lưu vào Database và đẩy lên Dashboard.

Ngược lại, khi bạn bấm nút trên Web Dashboard:
- Web Server sẽ ném một bức thư lệnh (VD: `{"action": "OPEN"}`) vào hòm thư `.../led_control`.
- Bưu điện lập tức báo cho ESP32. ESP32 nhận lệnh và điều khiển Motor/Còi hú.

---

## 3. Phân loại Cấp độ Cháy (Firmware Logic)

Logic đánh giá mức độ nguy hiểm được xử lý trực tiếp dưới ESP32 để đảm bảo độ trễ bằng 0.

```mermaid
graph TD
 START[" Đọc cảm biến"] --> CHECK_L3{" Mức 3: Khẩn cấp<br/>1. Có lửa (Hồng ngoại)<br/>2. Cảm biến lửa chập/cháy<br/>3. Khói cực dày đặc (Danger)<br/>4. Khói tăng + Nhiệt tăng"}
 CHECK_L3 -->|"Có bất kỳ"| LEVEL3[" CẤP 3: KHẨN CẤP"]
 
 CHECK_L3 -->|"Không"| CHECK_L2{" Mức 2: Cảnh báo<br/>1. Có khói bất thường (Warning)<br/>2. Nhiệt độ cực cao (>60°C)"}
 CHECK_L2 -->|"Có bất kỳ"| LEVEL2[" CẤP 2: CẢNH BÁO"]
 
 CHECK_L2 -->|"Không"| LEVEL1[" CẤP 1: BÌNH THƯỜNG"]

 LEVEL3 --> ACTION3[" Mở cửa thoát hiểm<br/> Bật còi báo động<br/> LED Đỏ nhấp nháy"]
 LEVEL2 --> ACTION2[" Báo động giao diện Web<br/> LED Đỏ sáng tĩnh"]
 LEVEL1 --> ACTION1[" Đóng cửa<br/> LED Xanh sáng"]
```

---

## 4. Cấu trúc Thư mục & Vai trò

| Thành phần | File chính | Chức năng |
|-----------|------|-----------|
| **Cấu hình chung ESP32** | `firmware/include/config.h` | Quản lý Wi-Fi, IP Broker, Topic, cấu hình Cảm biến. |
| **Code nạp ESP32** | `firmware/src/main.cpp` | Đọc ADC/Digital từ cảm biến, đánh giá cháy, giao tiếp MQTT. |
| **Cấu hình Web Server** | `web-server/src/config/config.js` | Quản lý danh sách Kit ESP32, Port, Security PIN. |
| **Database** | `web-server/src/database/db.js` | Kết nối và thao tác lưu lịch sử với SQLite. |
| **MQTT Service** | `web-server/src/services/mqttService.js` | Nhận dữ liệu MQTT, lưu Database, theo dõi Heartbeat (Offline). |
| **WebSocket** | `web-server/src/sockets/socketIO.js` | Bắn dữ liệu Real-time (qua sự kiện `fireAlarmData`) xuống Client. |
| **Giao diện Web** | `web-server/public/index.html` | Thiết kế Glassmorphism giao diện người dùng. |
| **JS Giao diện** | `web-server/public/js/app.js` | Vẽ biểu đồ Chart.js, xử lý Popup mật khẩu PIN. |
