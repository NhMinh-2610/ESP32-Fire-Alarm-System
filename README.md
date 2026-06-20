<h1 align="center">
 Hệ Thống Báo Cháy Thông Minh ESP32
</h1>

<p align="center">
 <strong>IoT Smart Fire Detection & Alert System (Microservices & Multi-Kit)</strong>
</p>

<p align="center">
 <img src="https://img.shields.io/badge/MCU-ESP32-blue?style=for-the-badge&logo=espressif&logoColor=white" alt="ESP32" />
 <img src="https://img.shields.io/badge/Platform-PlatformIO-orange?style=for-the-badge&logo=platformio&logoColor=white" alt="PlatformIO" />
 <img src="https://img.shields.io/badge/Server-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
 <img src="https://img.shields.io/badge/Broker-Mosquitto-660066?style=for-the-badge&logo=mqtt&logoColor=white" alt="MQTT Mosquitto" />
 <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

<p align="center">
 <em>Đồ án thiết kế Hệ thống phát hiện và cảnh báo cháy thông minh theo kiến trúc phân tán. Quản lý, giám sát nhiều thiết bị (Multi-Kit) độc lập qua MQTT với giao diện Web Dashboard trực quan, bảo mật bằng mã PIN.</em>
</p>

---

## Mục lục
- [ Tổng quan](#-tổng-quan)
- [ Tính năng nổi bật](#-tính-năng-nổi-bật)
- [️ Kiến trúc Hệ thống](#-kiến-trúc-hệ-thống)
- [ Sơ đồ Phần cứng](#-sơ-đồ-phần-cứng)
- [ Hướng dẫn Cài đặt & Sử dụng](#-hướng-dẫn-cài-đặt--sử-dụng)
- [ API & Giao thức](#-api--giao-thức)
- [‍ Tác giả](#-tác-giả)

---

## Tổng quan

**ESP32 Smart Fire Alarm** là đồ án kết hợp phần cứng IoT và kiến trúc phần mềm tiên tiến (Microservices) để đem lại sự an toàn tối ưu. 

Thay vì dựa dẫm vào các MQTT Broker Public (dễ bị delay hoặc bảo trì), hệ thống sử dụng **Mosquitto Local Broker** kết hợp với **Node.js Web Server** độc lập. Nhờ đó, tốc độ xử lý là tức thời (Real-time), kể cả khi đứt cáp quang thì hệ thống trong mạng LAN vẫn cảnh báo ổn định.

---

## Tính năng nổi bật

| Chức năng | Mô tả chi tiết |
|-----------|----------------|
| **Độ Trễ Phân Loại Bằng Không** | ESP32 tự đánh giá mức độ rủi ro (Bình thường / Cảnh báo / Khẩn cấp) trực tiếp trên Board mà không cần chờ Server. |
| ️ **Bảo Mật Giao Diện Bằng PIN** | Mọi thao tác nguy hiểm (Dừng báo động, Mở cửa khẩn cấp) đều bị khóa bằng Modal yêu cầu nhập mã PIN. |
| **Giám Sát Kết Nối (Heartbeat)** | Hệ thống Ping thiết bị liên tục. Nếu rút điện ESP32 quá 30 giây, Dashboard tự động vô hiệu hóa khu vực đó và hiển thị `OFFLINE`. |
| **Lưu Trữ Lịch Sử Cảm Biến** | Tự động lưu giá trị cảm biến vào SQLite, xuất ra biểu đồ trực quan thông qua thư viện Chart.js. |
| **Mở Cửa Tự Động** | Khi báo khẩn cấp (có lửa), Servo sẽ tự động mở cửa thoát hiểm, Còi báo động hú liên tục. |

---

## ️ Kiến trúc Hệ thống

Bạn có thể xem chi tiết kiến trúc hoạt động, luồng dữ liệu của hệ thống ở tài liệu:
 **[Tài liệu Kiến trúc Hệ thống (ARCHITECTURE.md)](docs/ARCHITECTURE.md)**

---

## Sơ đồ Phần cứng

Bạn có thể xem danh sách toàn bộ linh kiện sử dụng, sơ đồ đấu dây và ý nghĩa các ngưỡng (Threshold) cảm biến tại đây:
 **[Tài liệu Sơ đồ Phần cứng (HARDWARE.md)](docs/HARDWARE.md)**

---

## Hướng dẫn Cài đặt & Sử dụng

Để xem cách khởi động Mosquitto Broker, nạp Code xuống ESP32 bằng PlatformIO, cũng như cách chạy giao diện Web Dashboard, vui lòng đọc hướng dẫn:
 **[Hướng dẫn Cài đặt (SETUP.md)](docs/SETUP.md)**

---

## API & Giao thức

Tất cả các định dạng bản tin JSON mà hệ thống truyền qua MQTT và mô tả các REST API đều được liệt kê ở đây:
 **[Tài liệu API và Payload MQTT (API.md)](docs/API.md)**

---

## ‍ Tác giả

<table>
 <tr>
 <td align="center">
 <strong>Nguyễn Nhật Minh</strong><br/>
 MSSV: 20225886<br/>
 minh.nn225886@sis.hust.edu.vn<br/>
 Trường Công Nghệ Thông Tin Truyền Thông, Đại Học Bách Khoa Hà Nội<br/>
 Đồ án IoT — Học kỳ 20252
 </td>
 </tr>
</table>

<p align="center"><sub>Made with ️ in HUST</sub></p>
