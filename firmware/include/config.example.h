#pragma once

// Copy this file to config.h, then edit the WiFi values.
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Change DHT22 to DHT11 if your real temperature/humidity sensor is DHT11.
#define DHT_SENSOR_TYPE DHT22

#define MQTT_SERVER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_TELEMETRY_TOPIC "nguyennhatminh_20225886/telemetry"
#define MQTT_CONTROL_TOPIC "nguyennhatminh_20225886/led_control"
#define MQTT_DOOR_STATUS_TOPIC "nguyennhatminh_20225886/status/door"
#define MQTT_EMERGENCY_STATUS_TOPIC "nguyennhatminh_20225886/status/emergency"

#define DHT_MIN_VALID_C -20.0f
#define DHT_MAX_VALID_C 80.0f
#define HUMIDITY_MIN_VALID 0.0f
#define HUMIDITY_MAX_VALID 100.0f

#define FLAME_ACTIVE_LOW 1
#define ENABLE_FLAME_SENSOR 1
#define FLAME_AUTO_IDLE_LEVEL 1
#define FLAME_CONFIRM_READS 2
#define FLAME_STARTUP_IGNORE_MS 5000
#define FLAME_SAMPLE_COUNT 9
#define BUZZER_ACTIVE_LEVEL HIGH

#define SERVO_CLOSED_ANGLE 0
#define SERVO_OPEN_ANGLE 90

#define MQ2_AUTO_BASELINE 1
#define MQ2_WARNING_DELTA 700
#define MQ2_DANGER_DELTA 1400
#define MQ2_MIN_VALID 0
#define MQ2_MAX_VALID 4095
#define SMOKE_WARNING_THRESHOLD 1000
#define SMOKE_DANGER_THRESHOLD 2000
#define TEMP_WARNING_C 40.0f
#define TEMP_DANGER_C 50.0f
