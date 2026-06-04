# 📖 Hướng dẫn cài đặt — ESP32 Fire Alarm System

## 📋 Yêu cầu phần mềm

| Phần mềm | Phiên bản tối thiểu | Link tải |
|-----------|---------------------|----------|
| **Visual Studio Code** | 1.80+ | [code.visualstudio.com](https://code.visualstudio.com/) |
| **PlatformIO IDE** | Extension cho VS Code | [platformio.org](https://platformio.org/) |
| **Node.js** | v18.0+ | [nodejs.org](https://nodejs.org/) |
| **npm** | v9.0+ | Đi kèm Node.js |
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |
| **Wokwi Extension** (tùy chọn) | Latest | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=wokwi.wokwi-vscode) |

---

## 🚀 Cài đặt nhanh

### Bước 1: Clone repository

```bash
git clone https://github.com/YOUR_USERNAME/ESP32-Fire-Alarm-System.git
cd ESP32-Fire-Alarm-System
```

### Bước 2: Nạp firmware ESP32

#### Cách A: Dùng PlatformIO CLI

```bash
cd firmware

# Build project
pio run

# Upload firmware (kết nối ESP32 qua USB)
pio run --target upload

# Mở Serial Monitor (115200 baud)
pio device monitor --baud 115200
```

#### Cách B: Dùng VS Code + PlatformIO Extension

1. Mở thư mục `firmware/` trong VS Code
2. PlatformIO sẽ tự động nhận diện project
3. Click nút **Upload** (→) trên thanh toolbar PlatformIO
4. Mở **Serial Monitor** để xem log

#### Cách C: Mô phỏng với Wokwi (không cần phần cứng)

1. Cài extension **Wokwi Simulator** trong VS Code
2. Mở thư mục `firmware/` trong VS Code
3. Build project: `Ctrl+Shift+B` hoặc `pio run`
4. Nhấn `F1` → tìm **"Wokwi: Start Simulator"**
5. Sơ đồ mạch tự động load từ `diagram.json`

> **Lưu ý**: Wokwi yêu cầu tài khoản (miễn phí) để sử dụng.

### Bước 3: Chạy Web Server

```bash
cd web-server

# Cài đặt dependencies
npm install

# Khởi chạy server
npm start
```

Server sẽ chạy tại: **http://localhost:3000**

### Bước 4: Mở Dashboard

Mở trình duyệt và truy cập:

```
http://localhost:3000
```

---

## ⚙️ Cấu hình

### Cấu hình WiFi (ESP32)

Mở file `firmware/src/main.cpp` và thay đổi thông tin WiFi:

```cpp
// CẤU HÌNH WIFI & MQTT
const char* ssid = "YOUR_WIFI_SSID";       // ← Thay đổi
const char* password = "YOUR_WIFI_PASS";    // ← Thay đổi
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
```

> **Wokwi**: Dùng SSID `Wokwi-GUEST` và password rỗng `""`.

### Cấu hình MQTT Broker (Web Server)

Mở file `web-server/src/config/config.js`:

```js
module.exports = {
  WEB_PORT: process.env.PORT || 3000,           // Port web server
  MQTT_BROKER: 'mqtt://broker.hivemq.com:1883', // MQTT broker URL
  TOPICS: {
    FIRE_ALARM_DATA: 'nguyennhatminh_20225886/telemetry',
    CONTROL_DOOR:    'nguyennhatminh_20225886/led_control',
    // ...
  },
  MAX_HISTORY: 100, // Số bản ghi lịch sử tối đa
};
```

### Thay đổi port web server

```bash
# Dùng biến môi trường
PORT=8080 npm start
```

---

## 🧪 Kiểm tra hệ thống

### 1. Kiểm tra ESP32 → Server

1. Nạp firmware và khởi động ESP32
2. Mở Serial Monitor (115200 baud)
3. Xác nhận log:
   ```
   Đang kết nối Wi-Fi...
   Kết nối Wi-Fi thành công
   MQTT đang kết nối...kết nối thành công
   Level: 1 | Payload: {"temperature":25.5,"humidity":60,"smoke":350,"flame":false,"level":1}
   ```

### 2. Kiểm tra Web Server

1. Chạy `npm start` trong thư mục `web-server/`
2. Xác nhận log:
   ```
   [DB] ✅ Đã tải CSDL từ file!
   [MQTT] ✅ Kết nối thành công!
   [SERVER] 🚀 Đang chạy tại http://localhost:3000
   ```

### 3. Kiểm tra Dashboard

1. Mở **http://localhost:3000**
2. Kiểm tra:
   - Badge "Đã kết nối" hiển thị màu xanh
   - Sensor cards hiển thị dữ liệu real-time
   - Chart cập nhật liên tục
   - Nhật ký hoạt động ghi nhận sự kiện

### 4. Kiểm tra điều khiển

1. Click nút **MỞ** → cửa thoát hiểm phải mở (servo quay 90°)
2. Click nút **ĐÓNG** → cửa đóng lại (servo quay 0°)
3. Click **KÍCH HOẠT KHẨN CẤP** → còi + LED + cửa mở

---

## ❓ Xử lý sự cố

| Vấn đề | Giải pháp |
|--------|-----------|
| ESP32 không kết nối WiFi | Kiểm tra SSID/password. Wokwi dùng `Wokwi-GUEST` |
| MQTT không kết nối | Kiểm tra firewall, thử port 1883. HiveMQ public có thể quá tải |
| Dashboard hiện "Mất kết nối" | Kiểm tra web server đang chạy, cùng mạng với ESP32 |
| DHT22 trả về NaN | Kiểm tra kết nối chân DATA, thử đổi chân GPIO |
| Chart không cập nhật | Refresh trang, kiểm tra Console (F12) xem lỗi |
| `npm install` lỗi | Xóa `node_modules/` và chạy lại. Kiểm tra Node.js version |
