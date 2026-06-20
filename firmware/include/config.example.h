#pragma once

// 1. CẤU HÌNH KẾT NỐI WI-FI
// Thay đổi SSID và Mật khẩu phù hợp với mạng Wi-Fi thực tế.
// Lưu ý: ESP32 chỉ hỗ trợ băng tần 2.4 GHz, không hỗ trợ băng tần 5 GHz.
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// 2. CẤU HÌNH MÁY CHỦ MQTT (BROKER)
// Đảm bảo thông số này khớp với cấu hình trong thư mục web-server (config.js).
#define MQTT_SERVER "192.168.x.x"
#define MQTT_PORT 1883
#define MQTT_USER "admin"
#define MQTT_PASSWORD "YOUR_MQTT_PASSWORD"

// 3. CẤU HÌNH MQTT TOPICS
// Các luồng giao tiếp giữa ESP32 và Server (định dạng prefix/tên_chủ_đề).
#define MQTT_TELEMETRY_TOPIC "student_id/telemetry"
#define MQTT_CONTROL_TOPIC "student_id/led_control"
#define MQTT_DOOR_STATUS_TOPIC "student_id/status/door"
#define MQTT_EMERGENCY_STATUS_TOPIC "student_id/status/emergency"

// 4. CẤU HÌNH CẢM BIẾN NHIỆT ĐỘ & ĐỘ ẨM (DHT)
// Loại cảm biến: Thay đổi thành DHT22 nếu sử dụng module DHT22/AM2302.
#define DHT_SENSOR_TYPE DHT11

// Giới hạn hợp lệ của dữ liệu (Loại bỏ các giá trị nhiễu hoặc lỗi phần cứng).
#define DHT_MIN_VALID_C -20.0f
#define DHT_MAX_VALID_C 80.0f
#define HUMIDITY_MIN_VALID 0.0f
#define HUMIDITY_MAX_VALID 100.0f

// Các ngưỡng cảnh báo nhiệt độ (độ C).
#define TEMP_WARNING_C 40.0f
#define TEMP_DANGER_C 50.0f

// 5. CẤU HÌNH CẢM BIẾN LỬA (FLAME SENSOR - IR)
#define ENABLE_FLAME_SENSOR 1

// Chế độ đọc Analog: 1 (Bật), 0 (Tắt, dùng DigitalRead).
// Nếu bật, cần điều chỉnh ngưỡng FLAME_ANALOG_THRESHOLD (giá trị càng nhỏ = cường độ hồng ngoại càng lớn).
#define FLAME_USE_ANALOG 0
#define FLAME_ANALOG_THRESHOLD 1000

// Chế độ đọc Digital (Chỉ áp dụng khi FLAME_USE_ANALOG = 0).
// 1: Báo lửa khi chân tín hiệu về mức LOW (Active-Low).
// 0: Báo lửa khi chân tín hiệu về mức HIGH (Active-High).
#define FLAME_ACTIVE_LOW 1
#define FLAME_AUTO_IDLE_LEVEL 0
#define FLAME_SAMPLE_COUNT 9

// Chống nhiễu: Số lần đọc liên tiếp để xác nhận có lửa thực sự.
#define FLAME_CONFIRM_READS 3
// Bỏ qua tín hiệu trong 5 giây đầu tiên khi khởi động.
#define FLAME_STARTUP_IGNORE_MS 5000

// 6. CẤU HÌNH CẢM BIẾN KHÍ GAS (MQ-2)
// Chế độ tự động hiệu chuẩn: 1 (Bật), 0 (Tắt).
// Cảm biến sẽ lấy giá trị môi trường xung quanh trong 30 giây đầu làm mức nền (Baseline).
#define MQ2_AUTO_BASELINE 1

// Ngưỡng phát hiện tăng đột biến (Delta) so với Baseline (Chỉ dùng khi tự hiệu chuẩn).
#define MQ2_WARNING_DELTA 700
#define MQ2_DANGER_DELTA 1400

// Ngưỡng tĩnh cố định (Chỉ dùng khi MQ2_AUTO_BASELINE = 0).
#define SMOKE_WARNING_THRESHOLD 1000
#define SMOKE_DANGER_THRESHOLD 2000

// Dải giá trị ADC hợp lệ (0 - 4095) của ESP32.
#define MQ2_MIN_VALID 0
#define MQ2_MAX_VALID 4095

// 7. CẤU HÌNH CƠ CẤU CHẤP HÀNH (ĐỘNG CƠ CỬA & CÒI HÚ)
// Điều chỉnh góc quay Servo cho phù hợp với thiết kế cửa vật lý.
#define SERVO_CLOSED_ANGLE 0
#define SERVO_OPEN_ANGLE 90

// Mức tín hiệu kích hoạt còi hú.
// Thay đổi thành LOW nếu còi hú là loại kích mức thấp (Active-Low).
#define BUZZER_ACTIVE_LEVEL HIGH
