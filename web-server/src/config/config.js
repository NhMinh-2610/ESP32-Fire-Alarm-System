module.exports = {

 // CẤU HÌNH WEB SERVER

 WEB_PORT: process.env.PORT || 3000,

 // CẤU HÌNH KẾT NỐI MQTT BROKER

 MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://127.0.0.1:1883',
 MQTT_USERNAME: process.env.MQTT_USERNAME || 'admin',
 MQTT_PASSWORD: process.env.MQTT_PASSWORD || 'firealarm_secure_2026',

 // BẢO MẬT & ĐIỀU KHIỂN

 // Mã PIN bảo mật để thực thi các lệnh điều khiển (Mở cửa, Dừng báo động...)
 SECURITY_CODE: process.env.SECURITY_CODE || '1234',

 // Thời gian Timeout (ms): Nếu ESP32 không gửi tín hiệu Ping/Telemetry, hệ thống sẽ báo Offline.
 DEVICE_TIMEOUT_MS: 30000,

 // QUẢN LÝ THIẾT BỊ (MULTI-KIT)

 // Mỗi thiết bị ESP32 (Kit) cần một ID, Tên hiển thị và Tiền tố Topic (Topic Prefix) riêng.
 DEVICES: [
 {
 id: 'kit01',
 name: 'Kit 01 — Tầng 1',
 topicPrefix: 'nguyennhatminh_20225886',
 },
 // Để thêm Kit 02, cấu hình tương tự như block dưới:
 // {
 // id: 'kit02',
 // name: 'Kit 02 — Tầng 2',
 // topicPrefix: 'nguyennhatminh_20225886_kit02',
 // },
 ],

 // CẤU HÌNH LƯU TRỮ

 // Số bản ghi lịch sử tối đa được lưu tải lên giao diện Dashboard ban đầu.
 MAX_HISTORY: 100,
};
