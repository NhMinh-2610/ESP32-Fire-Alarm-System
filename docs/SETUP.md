# Hướng dẫn Cài đặt & Sử dụng Hệ thống

Tài liệu này cung cấp hướng dẫn Step-by-Step để bạn cài đặt, cấu hình và chạy thử toàn bộ hệ thống từ A-Z.

---

## 1. Yêu cầu phần mềm

| Phần mềm               | Vai trò                    | Link tải                                     |
| ---------------------- | -------------------------- | -------------------------------------------- |
| **Visual Studio Code** | Code Editor chính          | [Tải xuống](https://code.visualstudio.com/)  |
| **PlatformIO IDE**     | Nạp Firmware cho ESP32     | Extention trên VS Code                       |
| **Node.js (v18+)**     | Chạy Web Server            | [Tải xuống](https://nodejs.org/)             |
| **Mosquitto Broker**   | Dịch vụ MQTT Server nội bộ | [Tải xuống](https://mosquitto.org/download/) |

---

## 2. Bước 1: Khởi động Mosquitto MQTT Broker

Hệ thống sử dụng **Mosquitto MQTT Broker** chạy trên máy tính Windows ở mạng nội bộ (LAN).

1. Bạn cần cài đặt Mosquitto bản Windows.
2. Tại thư mục gốc của project, có sẵn file `mosquitto_local.conf` cấu hình port `1883` và cho phép mọi thiết bị kết nối.
3. Mở Terminal (PowerShell) bằng quyền Administrator và gõ:

```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" -c ".\mosquitto_local.conf" -v
```

// & "C:\Program Files\mosquitto\mosquitto.exe" -c "c:\Users\nnhat\OneDrive - Hanoi University of Science and Technology\Documents\Nguyen_Nhat_Minh\HUST_20252\iot\Project\ESP32-Fire-Alarm-System\mosquitto_local.conf" -v

> **Lưu ý**: Hãy giữ cửa sổ Terminal này luôn mở. MQTT Broker đã sẵn sàng nhận dữ liệu.

---

## 3. Bước 2: Nạp Firmware cho ESP32

Để ESP32 có thể gửi dữ liệu, nó phải kết nối cùng chung mạng WiFi với máy tính chạy Mosquitto.

### A. Tìm địa chỉ IP máy tính

1. Mở Command Prompt (`cmd`) trên máy tính và gõ lệnh `ipconfig`.
2. Tìm dòng `IPv4 Address`. Giả sử IP máy tính của bạn là `192.168.1.5`.

### B. Cấu hình Code

Mở file `firmware/include/config.h` và sửa lại thông tin:

```cpp
// Sửa thành tên và mật khẩu WiFi đang phát trong nhà bạn
#define WIFI_SSID "Tên_WiFi"
#define WIFI_PASSWORD "Mật_khẩu"

// Điền IP máy tính bạn vừa lấy được ở bước A
#define MQTT_SERVER "192.168.1.5"
#define MQTT_USER "admin"
#define MQTT_PASSWORD "firealarm_secure_2026"
```

### C. Nạp Code (Upload)

1. Cắm cáp kết nối ESP32 vào máy tính.
2. Trong thư mục `firmware`, sử dụng lệnh của PlatformIO để nạp code:

```bash
cd firmware
pio run --target upload
```

3. Sau khi nạp xong, hãy mở Serial Monitor để kiểm tra: `pio device monitor --baud 115200`.

---

## 4. Bước 3: Khởi động Web Server (Dashboard)

1. Mở một Terminal mới, chuyển vào thư mục `web-server`:

```bash
cd web-server
```

2. Mở file `web-server/src/config/config.js` để kiểm tra IP Broker (thường là `127.0.0.1` nếu web server chạy cùng máy với Mosquitto).
3. Cài đặt các thư viện cần thiết và khởi chạy:

```bash
npm install
npm start
```

4. Giao diện điều khiển (Dashboard) sẽ hiển thị tại: **http://localhost:3000**

---

## 5. Tiến hành Kiểm thử (Testing Demo)

Sau khi cả 3 thành phần (Broker, ESP32, Web Server) đều đã chạy. Bạn có thể kiểm tra các chức năng:

- **Test Khí Gas**: Dùng bật lửa xịt nhẹ một ít khí gas (không xẹt lửa) vào cảm biến MQ-2. Biểu đồ trên Web sẽ tăng lên, nếu vượt ngưỡng hệ thống sẽ chuyển sang CẢNH BÁO.
- **Test Báo Cháy (Lửa)**: Bật lửa trước cảm biến IR. Đèn trên cảm biến sẽ báo, còi hú trên kit sẽ kêu, servo tự động quay 90 độ mở cửa và trên Web sẽ nháy đỏ KHẨN CẤP.
- **Test Lệnh Điều Khiển**: Nhấn nút **"MỞ"** cửa trên giao diện Web. Hệ thống sẽ yêu cầu nhập mã PIN. Bạn nhập đúng `1234` (Mã cấu hình trong `config.js`). Ngay lập tức cửa (Servo) sẽ mở.
- **Test Mất Kết Nối**: Thử rút nguồn ESP32. Sau 30 giây (Timeout), giao diện Web sẽ tự làm mờ khu vực của thiết bị đó và khóa các nút điều khiển, báo trạng thái "OFFLINE".
