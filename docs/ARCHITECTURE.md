# 🏗️ Kiến trúc hệ thống — ESP32 Fire Alarm System

## Tổng quan kiến trúc

Hệ thống được chia thành **4 lớp** chính, giao tiếp qua giao thức MQTT:

```mermaid
graph TB
    subgraph SENSOR["🔧 Sensor Layer"]
        direction LR
        S1["🌡️ DHT22"]
        S2["💨 MQ-2"]
        S3["🔥 Flame IR"]
    end

    subgraph MCU["📟 ESP32 Controller"]
        direction TB
        WIFI["📶 WiFi Module"]
        LOGIC["⚙️ Fire Level Logic"]
        ACTUATOR["🎛️ Actuator Control"]
    end

    subgraph CLOUD["☁️ MQTT Broker"]
        HMQ["📡 HiveMQ Public<br/>broker.hivemq.com:1883"]
    end

    subgraph SERVER["🖥️ Web Server Layer"]
        direction TB
        EXPRESS["🟢 Express.js<br/>HTTP Server"]
        MQTTS["📡 MQTT Client<br/>Subscribe & Publish"]
        SOCKETIO["🔌 Socket.IO<br/>WebSocket Server"]
        SQLITE["💾 SQLite<br/>sql.js Database"]
        API["🔗 REST API<br/>/api/latest, /api/history"]
    end

    subgraph CLIENT["🌐 Browser Client"]
        direction TB
        HTML["📄 Dashboard UI"]
        CHART["📊 Chart.js"]
        SOCK["🔌 Socket.IO Client"]
    end

    S1 & S2 & S3 --> MCU
    MCU --> ACTUATOR
    ACTUATOR --> ACT1["🚪 Servo"]
    ACTUATOR --> ACT2["🔊 Buzzer"]
    ACTUATOR --> ACT3["💡 LEDs"]

    WIFI <-->|"MQTT"| HMQ
    HMQ <-->|"MQTT"| MQTTS

    MQTTS --> SQLITE
    MQTTS --> SOCKETIO
    EXPRESS --> API
    SOCKETIO <-->|"WebSocket"| SOCK
    API --> HTML
    SOCK --> CHART
    CHART --> HTML
```

## Luồng dữ liệu

### 1. Luồng telemetry (ESP32 → Dashboard)

```mermaid
sequenceDiagram
    participant S as 🔧 Sensors
    participant E as 📟 ESP32
    participant M as ☁️ MQTT Broker
    participant N as 🖥️ Node.js Server
    participant D as 💾 SQLite DB
    participant B as 🌐 Browser

    loop Mỗi 2 giây
        S->>E: Đọc DHT22, MQ-2, Flame
        E->>E: Phân loại cấp độ cháy (1/2/3)
        E->>M: Publish telemetry JSON
        M->>N: Forward message
        N->>D: INSERT sensor_data
        N->>B: Emit 'fireAlarmData' (Socket.IO)
        B->>B: Cập nhật gauge, chart, log
    end
```

### 2. Luồng điều khiển (Dashboard → ESP32)

```mermaid
sequenceDiagram
    participant B as 🌐 Browser
    participant N as 🖥️ Node.js Server
    participant M as ☁️ MQTT Broker
    participant E as 📟 ESP32

    B->>N: Emit 'controlDoor' (Socket.IO)
    N->>M: Publish {action: "OPEN_DOOR"}
    M->>E: Forward to led_control topic
    E->>E: Xử lý lệnh (mở servo)
```

## Phân loại cấp độ cháy

```mermaid
graph TD
    START["📡 Đọc cảm biến"] --> CHECK_FLAME{"🔥 Phát hiện lửa?"}
    CHECK_FLAME -->|"Có"| LEVEL3["🔴 CẤP 3: KHẨN CẤP"]
    CHECK_FLAME -->|"Không"| CHECK_EXTREME{"💨 Gas > 2000<br/>VÀ 🌡️ Temp > 50°C?"}
    CHECK_EXTREME -->|"Có"| LEVEL3
    CHECK_EXTREME -->|"Không"| CHECK_WARNING{"💨 Gas > 1000<br/>HOẶC 🌡️ Temp > 40°C?"}
    CHECK_WARNING -->|"Có"| LEVEL2["🟡 CẤP 2: CẢNH BÁO"]
    CHECK_WARNING -->|"Không"| LEVEL1["🟢 CẤP 1: BÌNH THƯỜNG"]

    LEVEL3 --> ACTION3["🚪 Mở cửa thoát hiểm<br/>🔊 Bật còi báo động<br/>💡 LED nhấp nháy"]
    LEVEL2 --> ACTION2["📊 Cảnh báo trên dashboard"]
    LEVEL1 --> ACTION1["✅ Không hành động"]
```

## Component Diagram

| Component | File | Chức năng |
|-----------|------|-----------|
| **ESP32 Firmware** | `firmware/src/main.cpp` | Đọc cảm biến, phân loại cấp cháy, MQTT publish/subscribe |
| **Web Server** | `web-server/src/server.js` | Khởi tạo Express, Socket.IO, kết nối modules |
| **MQTT Service** | `web-server/src/services/mqttService.js` | Kết nối MQTT broker, xử lý messages |
| **Database** | `web-server/src/database/db.js` | SQLite (sql.js) — lưu lịch sử cảm biến |
| **API Routes** | `web-server/src/routes/apiRoutes.js` | REST API endpoints |
| **Socket.IO** | `web-server/src/sockets/socketIO.js` | WebSocket handlers cho dashboard |
| **Dashboard** | `web-server/public/index.html` | Giao diện web premium |
| **Frontend JS** | `web-server/public/js/app.js` | Chart.js, gauge animation, Socket.IO client |
| **CSS Theme** | `web-server/public/css/style.css` | Dark theme với glassmorphism |
