# Tài liệu API & Giao thức MQTT

Tài liệu này liệt kê toàn bộ các Endpoint REST API và cấu trúc bản tin MQTT Payload sử dụng trong hệ thống.

---

## 1. Giao thức MQTT

Hệ thống giao tiếp nội bộ qua Mosquitto MQTT Broker (Local). 
- **Địa chỉ Broker**: Tuỳ vào IP LAN của máy tính chạy Node.js (Ví dụ: `192.168.1.5`).
- **Cổng (Port)**: `1883` (TCP/Không mã hoá TLS).
- **Chứng thực**: Yêu cầu Username (`admin`) & Password (`firealarm_secure_2026`).

### A. Luồng Dữ liệu Cảm biến (Telemetry)
- **Topic**: `{topicPrefix}/telemetry` (VD: `nguyennhatminh_20225886/telemetry`)
- **Hướng**: ESP32 gửi lên Web Server.
- **Tần suất**: Mỗi 2 giây.

**Định dạng Payload (JSON):**
```json
{
 "temperature": 34.2,
 "humidity": 46.0,
 "smoke": 1290,
 "smoke_delta": 4,
 "flame": false,
 "flame_analog": 4095,
 "level": 1,
 "mq2_ready": true,
 "wifi_rssi": -56
}
```

### B. Luồng Lệnh Điều khiển (Control)
- **Topic**: `{topicPrefix}/led_control`
- **Hướng**: Web Server gửi xuống ESP32.
- **Tần suất**: Chỉ gửi khi người dùng thao tác trên Dashboard.

**Định dạng Payload (JSON):**
```json
{"action": "OPEN"}
```

**Các Lệnh (Action) hợp lệ:**
- `OPEN` / `CLOSE`: Bắt buộc Mở / Đóng cửa thoát hiểm.
- `EMERGENCY`: Bắt buộc kích hoạt chế độ báo động khẩn cấp.
- `STOP_ALARM`: Reset toàn bộ trạng thái hệ thống, dừng còi hú, tắt đèn báo.

---

## 2. API Giao tiếp Real-time (Socket.IO)

Web Server kết nối với Frontend qua Socket.IO để đẩy luồng sự kiện theo thời gian thực mà không cần Refresh trang.

### Server gửi cho Client (Emit)
- `mqttStatus` `{ connected: Boolean }`: Cập nhật trạng thái Broker.
- `devicesConfig` `[ {id, name, online} ]`: Danh sách Kit ESP32.
- `fireAlarmData` `{...TelemetryPayload, deviceId}`: Dữ liệu cảm biến có gắn tag thiết bị.
- `history` `[ {...TelemetryPayload} ]`: Danh sách 100 dòng lịch sử để vẽ Chart.

### Client gửi cho Server (On)
- `controlDoor` `{ deviceId, action: "OPEN" | "CLOSE" }`: Yêu cầu đóng/mở cửa.
- `triggerEmergency` `{ deviceId }`: Báo cháy giả lập.
- `stopAlarm` `{ deviceId }`: Yêu cầu ngừng báo cháy.

---

## 3. RESTful API Endpoints

Cung cấp dữ liệu thô cho các ứng dụng ngoại vi hoặc kiểm thử bằng Postman. 
Base URL mặc định: `http://localhost:3000/api`

### `GET /api/latest`
Lấy bản ghi dữ liệu cảm biến mới nhất từ RAM.

**Response:**
```json
{
 "kit01": {
 "temperature": 34.2,
 "humidity": 46,
 "smoke": 1290,
 "flame": false,
 "level": 1,
 "deviceId": "kit01",
 "timestamp": "2026-06-20T10:30:00.000Z"
 }
}
```

### `GET /api/history`
Truy vấn 100 bản ghi lịch sử mới nhất từ cơ sở dữ liệu SQLite.

**Response:**
```json
[
 {
 "id": 1,
 "deviceId": "kit01",
 "temperature": 34.2,
 "humidity": 46.0,
 "smoke": 1290,
 "smoke_delta": 4.0,
 "flame": 0,
 "timestamp": "2026-06-20 10:30:00"
 }
]
```

---

## 4. Cấu trúc Database (SQLite)

Toàn bộ lịch sử cảm biến được lưu trong file `database.sqlite` nằm trong thư mục `web-server/`.

**Câu lệnh tạo Schema:**
```sql
CREATE TABLE IF NOT EXISTS sensor_data (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 deviceId TEXT,
 temperature REAL,
 humidity REAL,
 smoke REAL,
 smoke_delta REAL,
 flame INTEGER,
 timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
