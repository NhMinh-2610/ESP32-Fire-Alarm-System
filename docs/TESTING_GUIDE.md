# 🛠 Hướng dẫn Chạy thực tế và Kiểm thử (Testing Guide)

Tài liệu này giải đáp cơ chế tài khoản MQTT và cung cấp hướng dẫn Step-by-Step để bạn chạy thử toàn bộ hệ thống từ A-Z.

---

## 1. Cơ chế Tài khoản MQTT: Tại sao Web và ESP32 dùng chung 1 tài khoản?

**Câu trả lời ngắn:** ĐÚNG. Hiện tại cả ESP32 và Web Server đang dùng chung 1 cặp User/Pass là `admin` / `firealarm_secure_2026`.

**Giải thích dễ hiểu:**
- **MQTT Broker (Trạm Bưu Điện)** của chúng ta hiện đang được thiết lập ở chế độ "Phòng họp VIP kín".
- Để vào được phòng họp này, bạn phải có **Thẻ VIP** (Chính là cặp User/Pass `admin`).
- Cả **Web Server** và **ESP32** đều được cấp Thẻ VIP này. Khi cả hai vào được phòng, chúng sẽ tự do nói chuyện với nhau.
- Nếu một người lạ (Ví dụ một thằng hacker quét được IP của bạn) cố gắng kết nối vào cổng 1883, vì không có Thẻ VIP, nó sẽ bị Broker "đá" văng ra ngay lập tức với dòng chữ `[AUTH] ❌ Từ chối truy cập`.

*(Lưu ý: Nếu làm đồ án mức độ Tiến sĩ/Kỹ sư cao cấp, bạn có thể thiết lập mỗi con ESP32 một tài khoản riêng. Tuy nhiên, ở mức độ Đồ án Đại học, việc khóa được Broker bằng 1 tài khoản Admin chung đã là một điểm cộng bảo mật cực lớn so với 90% sinh viên khác thường thả rông không có Pass).*

---

## 2. Hướng dẫn chạy và test toàn hệ thống (Step-by-Step)

Để thấy toàn bộ hệ thống hoạt động, bạn làm đúng theo thứ tự sau:

### Bước 1: Tìm địa chỉ IP máy tính của bạn
Vì ESP32 và máy tính cần chung mạng WiFi, ESP32 phải biết máy tính ở đâu để kết nối tới.
- Trên máy tính Windows, mở Command Prompt (`cmd`) và gõ `ipconfig`.
- Tìm dòng `IPv4 Address`. Giả sử IP của bạn là `192.168.1.10`.

### Bước 2: Khởi động MQTT Broker (Trạm Bưu Điện)
- Mở Terminal số 1, di chuyển vào thư mục `mqtt-broker`.
- Chạy lệnh: `npm start`
- Kết quả mong đợi: `🚀 MQTT Broker đang chạy tại cổng 1883`

### Bước 3: Nạp Code cho ESP32
Mở file `firmware/include/config.h` (hoặc `config.example.h`) và sửa lại:
```cpp
#define WIFI_SSID "Tên_WiFi_Nhà_Bạn"
#define WIFI_PASSWORD "Pass_WiFi"

#define MQTT_SERVER "192.168.1.10" // Điền đúng IP máy tính ở Bước 1
#define MQTT_USER "admin"
#define MQTT_PASSWORD "firealarm_secure_2026"
```
- Cắm mạch ESP32 vào máy tính. Mở PlatformIO và nhấn nút **Upload**.
- Mở **Serial Monitor**. Kết quả mong đợi:
  ```text
  [WIFI] Connected to Tên_WiFi_Nhà_Bạn
  [MQTT] Connecting as ESP32_FireAlarm...
  [MQTT] Connected
  ```
- Nhìn sang Terminal số 1 (Broker), bạn sẽ thấy log: `[AUTH] ✅ Client được cấp quyền truy cập: ESP32_FireAlarm_...` (Bưu điện báo có người cầm thẻ VIP vào).

### Bước 4: Khởi động Web Server
- Mở Terminal số 2, di chuyển vào thư mục `web-server`.
- Chạy lệnh: `npm start`
- Nhìn sang Terminal số 1 (Broker), bạn sẽ thấy log thứ hai: `[AUTH] ✅ Client được cấp quyền truy cập: NodeServer_...` (Web Server đã vào phòng).
- Mở trình duyệt web, vào địa chỉ: `http://localhost:3000`

### Bước 5: Tiến hành Test kịch bản (Demo)

1. **Test cảm biến:** Cầm bật lửa xịt một ít khí gas (chưa xẹt lửa) vào cảm biến MQ-2.
   - Màn hình Web ngay lập tức nhảy biểu đồ khí Gas lên cao.
   - Khung cảnh báo chuyển sang "Cảnh báo màu vàng".
2. **Test mất mạng:** Rút dây cắm điện của con ESP32 ra.
   - Đợi 30 giây.
   - Màn hình Web sẽ tự động làm mờ cái bảng Kit 01, hiện chữ "OFFLINE", nút bấm sẽ bị liệt (không cho bấm). Trạng thái hệ thống chuyển sang "Mất kết nối".
3. **Test Lệnh điều khiển (Bảo mật PIN):** Cắm lại ESP32 chờ nó online.
   - Trên Web, bấm nút **"Mở cửa"**.
   - Bảng hiện ra yêu cầu nhập mã PIN. Bạn nhập sai thử -> Lắc bảng báo lỗi.
   - Bạn nhập đúng `1234` -> Ấn OK.
   - Đèn Servo trên mô hình ESP32 quay một góc 90 độ, Serial Monitor báo `[CMD] Door open override`. Màn hình Web hiện chữ "Cửa: MỞ".

Chúc mừng! Bạn đã test thành công toàn bộ hệ thống từ dưới lên trên.
