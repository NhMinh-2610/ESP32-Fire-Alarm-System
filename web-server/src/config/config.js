module.exports = {
  WEB_PORT: process.env.PORT || 3000,
  MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://127.0.0.1:1883',
  MQTT_USERNAME: process.env.MQTT_USERNAME || 'admin',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || 'firealarm_secure_2026',

  // Mã bảo mật để thực hiện các lệnh điều khiển qua giao diện Web
  SECURITY_CODE: process.env.SECURITY_CODE || '1234',

  // Thời gian (ms) không nhận dữ liệu thì coi kit là offline
  DEVICE_TIMEOUT_MS: 30000,

  // Danh sách thiết bị ESP32. Mỗi kit có id, name, và topicPrefix riêng.
  // Topic telemetry:        <topicPrefix>/telemetry
  // Topic door status:      <topicPrefix>/status/door
  // Topic emergency status: <topicPrefix>/status/emergency
  // Topic control:          <topicPrefix>/led_control
  DEVICES: [
    {
      id: 'kit01',
      name: 'Kit 01 — Tầng 1',
      topicPrefix: 'nguyennhatminh_20225886',
    },
    // Để thêm kit thứ 2, bỏ comment block dưới:
    // {
    //   id: 'kit02',
    //   name: 'Kit 02 — Tầng 2',
    //   topicPrefix: 'nguyennhatminh_20225886_kit02',
    // },
  ],

  MAX_HISTORY: 100,
};
