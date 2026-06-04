# 🔗 API Reference — ESP32 Fire Alarm System

## 📡 MQTT Topics

### Broker Configuration

| Thuộc tính | Giá trị |
|-----------|---------|
| **Broker** | `broker.hivemq.com` |
| **Port** | `1883` (TCP, không mã hóa) |
| **Protocol** | MQTT v3.1.1 |
| **Client ID (ESP32)** | `ESP32_FireAlarmClient` |
| **Client ID (Server)** | `NodeServer_<random>` |

---

### Topics

#### 📤 Telemetry — ESP32 gửi dữ liệu cảm biến

| Thuộc tính | Giá trị |
|-----------|---------|
| **Topic** | `nguyennhatminh_20225886/telemetry` |
| **Direction** | ESP32 → Server |
| **QoS** | 0 |
| **Interval** | Mỗi 2 giây (bình thường) / liên tục (khẩn cấp) |

**Payload (JSON)**:

```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "smoke": 350,
  "flame": false,
  "level": 1
}
```

| Field | Type | Range | Mô tả |
|-------|------|-------|--------|
| `temperature` | `float` | -40 ~ 80 | Nhiệt độ (°C) từ DHT22 |
| `humidity` | `float` | 0 ~ 100 | Độ ẩm (%) từ DHT22 |
| `smoke` | `int` | 0 ~ 4095 | Giá trị ADC từ MQ-2 |
| `flame` | `bool` | true/false | Trạng thái phát hiện lửa |
| `level` | `int` | 1, 2, 3 | Cấp độ báo cháy |

---

#### 📥 Control — Server gửi lệnh đến ESP32

| Thuộc tính | Giá trị |
|-----------|---------|
| **Topic** | `nguyennhatminh_20225886/led_control` |
| **Direction** | Server → ESP32 |
| **QoS** | 0 |

**Payload (JSON)**:

```json
{"action": "<COMMAND>"}
```

**Danh sách lệnh**:

| Action | Mô tả | ESP32 Response |
|--------|-------|----------------|
| `OPEN_DOOR` | Mở cửa thoát hiểm | Servo → 90° (mở), fireLevel = 3 |
| `CLOSE_DOOR` | Đóng cửa thoát hiểm | Servo → 0° (đóng), fireLevel = 1 |
| `BUZZER_ON` | Bật còi báo động | GPIO 4 = HIGH |
| `BUZZER_OFF` | Tắt còi báo động | GPIO 4 = LOW |
| `LED_RED_ON` | Bật LED đỏ | GPIO 2 = HIGH |
| `LED_RED_OFF` | Tắt LED đỏ | GPIO 2 = LOW |
| `LED_BLUE_ON` | Bật LED xanh | GPIO 19 = HIGH |
| `LED_BLUE_OFF` | Tắt LED xanh | GPIO 19 = LOW |
| `EMERGENCY_STOP` | Dừng tất cả, reset về bình thường | Tắt hết, servo = 0°, level = 1 |

---

## 🌐 REST API

Base URL: `http://localhost:3000/api`

### GET `/api/latest`

Trả về dữ liệu cảm biến mới nhất.

**Response**:
```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "smoke": 350,
  "flame": false,
  "level": 1,
  "timestamp": "2025-06-05T10:30:00.000Z"
}
```

### GET `/api/history`

Trả về lịch sử dữ liệu cảm biến (tối đa 100 bản ghi).

**Response**:
```json
[
  {
    "temperature": 25.5,
    "humidity": 60.2,
    "smoke": 350,
    "flame": false,
    "timestamp": "2025-06-05T10:28:00.000Z"
  },
  ...
]
```

### GET `/api/status`

Trả về trạng thái hệ thống.

**Response**:
```json
{
  "mqtt_connected": true,
  "total_readings": 42,
  "uptime": 3600.5
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `mqtt_connected` | `bool` | Trạng thái kết nối MQTT |
| `total_readings` | `int` | Tổng số bản ghi trong bộ nhớ |
| `uptime` | `float` | Thời gian server chạy (giây) |

---

## 🔌 Socket.IO Events

### Server → Client (Emit)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `fireAlarmData` | `{temperature, humidity, smoke, flame, level, timestamp}` | Dữ liệu cảm biến real-time |
| `mqttStatus` | `{connected: bool}` | Trạng thái kết nối MQTT |
| `doorStatus` | `string` | Trạng thái cửa: "OPEN" / "CLOSED" |
| `emergencyStatus` | `string` | Trạng thái khẩn cấp: "EMERGENCY" / "NORMAL" |
| `history` | `Array<SensorData>` | Lịch sử cảm biến (khi client mới kết nối) |

### Client → Server (Emit)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `controlDoor` | `string` "OPEN" / "CLOSE" | Điều khiển mở/đóng cửa |
| `triggerEmergency` | — | Kích hoạt chế độ khẩn cấp |

---

## 💾 Database Schema

### Bảng `sensor_data`

```sql
CREATE TABLE sensor_data (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL,
    humidity    REAL,
    smoke       REAL,
    flame       INTEGER,      -- 0: không lửa, 1: có lửa
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Mô tả |
|--------|------|--------|
| `id` | INTEGER | Primary key, auto-increment |
| `temperature` | REAL | Nhiệt độ (°C) |
| `humidity` | REAL | Độ ẩm (%) |
| `smoke` | REAL | Giá trị khí gas (ADC) |
| `flame` | INTEGER | 0 = không lửa, 1 = có lửa |
| `timestamp` | DATETIME | Thời điểm ghi nhận |
