# TÀI LIỆU ÔN TẬP: CHI TIẾT FILE `mqttService.js`

Nếu thầy giáo chỉ tay vào file `mqttService.js` trên Web Server và hỏi: *"File này code gồm những gì? Nó làm nhiệm vụ gì?"*, bạn hãy trả lời theo cấu trúc sau.

---

## 1. File này gồm những thành phần gì? (Cấu trúc code)

Đoạn code trong `mqttService.js` được chia thành các phần chính:

1. **Khai báo thư viện:** Sử dụng thư viện `mqtt` (để kết nối broker), `db` (để kết nối SQLite lưu dữ liệu) và `config` (chứa tên các thiết bị, địa chỉ broker).
2. **Các biến trạng thái (RAM):**
   - `latestDataMap`: Lưu trữ dữ liệu cảm biến mới nhất vừa nhận được.
   - `deviceStatusMap`: Lưu trạng thái thiết bị đang Online hay Offline.
   - `heartbeatTimers`: Lưu các bộ đếm thời gian (hẹn giờ) để kiểm tra xem thiết bị còn sống không.
3. **Cấu hình Client MQTT:** `mqtt.connect(...)` chứa thông tin đăng nhập vào Broker (IP, Username, Password).
4. **Hàm `setupMqtt()` (Cốt lõi):** Chứa các sự kiện (Events) khi kết nối thành công (`on('connect')`), khi nhận được tin nhắn (`on('message')`), hoặc khi lỗi/đứt mạng (`on('error')`, `on('close')`).
5. **Hàm `publish()`:** Nơi chứa logic gửi lệnh từ Web ngược xuống ESP32.

---

## 2. File này thực hiện những công việc gì? (Nhiệm vụ)

File này đóng vai trò là **"Người phiên dịch và vận chuyển"** giữa ESP32 (MQTT) và Giao diện Web (Socket.IO). Nó thực hiện 5 nhiệm vụ cực kỳ quan trọng:

### Nhiệm vụ 1: Kết nối và Theo dõi (Subscribe)
Khi khởi động, nó tự động kết nối vào MQTT Broker và đăng ký "Lắng nghe" (Subscribe) 3 luồng thông tin từ con ESP32:
- Luồng telemetry (dữ liệu cảm biến).
- Luồng status/door (trạng thái cửa).
- Luồng status/emergency (trạng thái khẩn cấp).

### Nhiệm vụ 2: Lọc và Xử lý dữ liệu
Khi nhận được 1 bản tin JSON từ ESP32, nó không lưu bừa bãi mà sẽ:
- Parse (Giải mã) chuỗi JSON thành Object JavaScript.
- Kiểm tra tính hợp lệ: Ví dụ nhiệt độ phải từ -20 đến 80 độ, độ ẩm phải từ 0-100%. Nếu dữ liệu nhiễu (sai), nó tự động loại bỏ để tránh làm hỏng biểu đồ.

### Nhiệm vụ 3: Lưu trữ và Báo cáo (Phát sóng)
Ngay sau khi lọc xong dữ liệu sạch, nó làm 2 việc cùng một lúc:
1. Ghi dữ liệu đó vào Database SQLite (`INSERT INTO sensor_data...`) để sau này xem lại lịch sử.
2. Dùng `io.emit()` (Socket.IO) bắn trực tiếp dữ liệu đó ra giao diện web. Nhờ vậy biểu đồ nhảy ngay lập tức mà web không cần tải lại trang.

### Nhiệm vụ 4: Kiểm tra nhịp tim (Heartbeat / Giám sát Online-Offline)
Đoạn code có hàm `resetHeartbeat()`. 
- Cứ mỗi lần ESP32 gửi dữ liệu lên, nó đánh dấu ESP32 là **Online** và khởi động lại một cái đồng hồ đếm ngược (ví dụ 15 giây).
- Nếu ESP32 bị mất điện hoặc đứt Wi-Fi, nó sẽ không gửi dữ liệu nữa. Hết 15 giây đếm ngược, code tự động đánh dấu thiết bị là **Offline** và báo đỏ ra ngoài màn hình web để quản trị viên biết.

### Nhiệm vụ 5: Chuyển phát lệnh điều khiển
Khi bạn bấm nút trên Web (Ví dụ: "Mở Cửa"), giao diện sẽ gọi hàm `publish()` trong file này. Hàm này sẽ gói lệnh thành chuỗi `{"action": "OPEN"}` và gửi xuống chủ đề điều khiển (`led_control`) để ESP32 nhận lệnh và mở cửa.
