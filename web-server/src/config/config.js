module.exports = {
  WEB_PORT: process.env.PORT || 3000,
  MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883',
  TOPICS: {
    // Topic server lắng nghe từ ESP32 (telemetry)
    FIRE_ALARM_DATA:   'nguyennhatminh_20225886/telemetry',
    
    // Các topic phụ nếu ESP32 có gửi thêm (có thể bỏ qua nếu ESP không gửi)
    DOOR_STATUS:       'nguyennhatminh_20225886/status/door',
    EMERGENCY_STATUS:  'nguyennhatminh_20225886/status/emergency',
    
    // Topic server gửi lệnh điều khiển xuống ESP32 (led_control)
    CONTROL_DOOR:      'nguyennhatminh_20225886/led_control',
    TRIGGER_EMERGENCY: 'nguyennhatminh_20225886/led_control',
  },
  MAX_HISTORY: 100,
};
