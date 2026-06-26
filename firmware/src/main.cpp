#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

#if defined(__has_include)
#if __has_include("config.h")
#include "config.h"
#endif
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_WIFI_SSID"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif

#ifndef MQTT_SERVER
#define MQTT_SERVER "broker.hivemq.com"
#endif

#ifndef MQTT_PORT
#define MQTT_PORT 1883
#endif

#ifndef MQTT_TELEMETRY_TOPIC
#define MQTT_TELEMETRY_TOPIC "nguyennhatminh_20225886/telemetry"
#endif

#ifndef MQTT_CONTROL_TOPIC
#define MQTT_CONTROL_TOPIC "nguyennhatminh_20225886/led_control"
#endif

#ifndef MQTT_DOOR_STATUS_TOPIC
#define MQTT_DOOR_STATUS_TOPIC "nguyennhatminh_20225886/status/door"
#endif

#ifndef MQTT_EMERGENCY_STATUS_TOPIC
#define MQTT_EMERGENCY_STATUS_TOPIC "nguyennhatminh_20225886/status/emergency"
#endif

#ifndef FLAME_ACTIVE_LOW
#define FLAME_ACTIVE_LOW 1
#endif

#ifndef BUZZER_ACTIVE_LEVEL
#define BUZZER_ACTIVE_LEVEL HIGH
#endif

#ifndef SERVO_CLOSED_ANGLE
#define SERVO_CLOSED_ANGLE 0
#endif

#ifndef SERVO_OPEN_ANGLE
#define SERVO_OPEN_ANGLE 90
#endif

#ifndef SMOKE_WARNING_THRESHOLD
#define SMOKE_WARNING_THRESHOLD 1000
#endif

#ifndef SMOKE_DANGER_THRESHOLD
#define SMOKE_DANGER_THRESHOLD 2000
#endif

#ifndef MQ2_AUTO_BASELINE
#define MQ2_AUTO_BASELINE 1
#endif

#ifndef MQ2_WARNING_DELTA
#define MQ2_WARNING_DELTA 700
#endif

#ifndef MQ2_DANGER_DELTA
#define MQ2_DANGER_DELTA 1400
#endif

#ifndef MQ2_MIN_VALID
#define MQ2_MIN_VALID 0
#endif

#ifndef MQ2_MAX_VALID
#define MQ2_MAX_VALID 4095
#endif

#ifndef TEMP_WARNING_C
#define TEMP_WARNING_C 40.0f
#endif

#ifndef TEMP_DANGER_C
#define TEMP_DANGER_C 50.0f
#endif

#ifndef DHT_SENSOR_TYPE
#define DHT_SENSOR_TYPE DHT22
#endif

#ifndef DHT_MIN_VALID_C
#define DHT_MIN_VALID_C -20.0f
#endif

#ifndef DHT_MAX_VALID_C
#define DHT_MAX_VALID_C 80.0f
#endif

#ifndef HUMIDITY_MIN_VALID
#define HUMIDITY_MIN_VALID 0.0f
#endif

#ifndef HUMIDITY_MAX_VALID
#define HUMIDITY_MAX_VALID 100.0f
#endif

#ifndef ENABLE_FLAME_SENSOR
#define ENABLE_FLAME_SENSOR 1
#endif

#ifndef FLAME_USE_ANALOG
#define FLAME_USE_ANALOG 1
#endif

#ifndef FLAME_ANALOG_THRESHOLD
#define FLAME_ANALOG_THRESHOLD 1000
#endif

#ifndef FLAME_CONFIRM_READS
#define FLAME_CONFIRM_READS 3
#endif

#ifndef FLAME_STARTUP_IGNORE_MS
#define FLAME_STARTUP_IGNORE_MS 5000
#endif

#ifndef FLAME_AUTO_IDLE_LEVEL
#define FLAME_AUTO_IDLE_LEVEL 0
#endif

#ifndef FLAME_SAMPLE_COUNT
#define FLAME_SAMPLE_COUNT 9
#endif

// GPIO wiring for the real ESP32 kit.
#define DHTPIN 15
#define DHTTYPE DHT_SENSOR_TYPE
#define MQ2_PIN 34
#define FLAME_PIN 32
#define SERVO_PIN 18
#define BUZZER_PIN 4
#define LED_RED 2
#define LED_BLUE 19

const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long MQTT_RETRY_MS = 5000;
const unsigned long SENSOR_INTERVAL_MS = 1000;
const unsigned long STATUS_INTERVAL_MS = 5000;
const unsigned long MQ2_WARMUP_MS = 30000;
const unsigned long ALARM_BLINK_MS = 180;
const unsigned long WARNING_BLINK_MS = 500;
const int FLAME_SHORT_CIRCUIT_THRESH = 50;       // Analog < 50 = sensor bi chay/chap

WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);
Servo doorServo;

unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastSensorRead = 0;
unsigned long lastStatusPublish = 0;

int fireLevel = 1;
bool manualEmergency = false;
bool doorOverrideOpen = false;
bool buzzerOverride = false;
bool ledRedOverride = false;
bool ledBlueOverride = false;
bool doorIsOpen = false;
bool emergencyActive = false;

uint32_t mq2BaselineSum = 0;
uint16_t mq2BaselineSamples = 0;
int mq2Baseline = 0;
bool mq2BaselineReady = false;

uint16_t flameIdleHighSamples = 0;
uint16_t flameIdleTotalSamples = 0;
int flameIdleLevel = HIGH;
bool flameIdleReady = false;
int lastFlameAnalog = 4095; // Track analog value for telemetry

bool wifiConfigLooksValid() {
 return strcmp(WIFI_SSID, "YOUR_WIFI_SSID") != 0 && strlen(WIFI_SSID) > 0;
}

void writeBuzzer(bool enabled) {
 digitalWrite(BUZZER_PIN, enabled ? BUZZER_ACTIVE_LEVEL : !BUZZER_ACTIVE_LEVEL);
}

// PHẦN ĐỌC CẢM BIẾN LỬA (FLAME SENSOR)
#if FLAME_USE_ANALOG

// Chế độ đọc Analog: giá trị càng thấp = cường độ tia hồng ngoại (IR) càng cao = có lửa
int readFlameAnalogValue() {
 if (!ENABLE_FLAME_SENSOR) return 4095;
 // Lấy trung bình 5 lần đọc để tránh nhiễu
 long sum = 0;
 for (int i = 0; i < 5; i++) {
 sum += analogRead(FLAME_PIN);
 delayMicroseconds(200);
 }
 return (int)(sum / 5);
}

bool updateStableFlameState(int /* unused */) {
 static uint8_t activeSamples = 0;

 if (!ENABLE_FLAME_SENSOR) {
 activeSamples = 0;
 return false;
 }

 // Bỏ qua tín hiệu rác trong thời gian khởi động
 if (millis() < FLAME_STARTUP_IGNORE_MS) {
 activeSamples = 0;
 lastFlameAnalog = readFlameAnalogValue();
 return false;
 }

 lastFlameAnalog = readFlameAnalogValue();
 const bool rawActive = lastFlameAnalog < FLAME_ANALOG_THRESHOLD;

 if (rawActive) {
 if (activeSamples < FLAME_CONFIRM_READS) {
 activeSamples++;
 }
 } else {
 activeSamples = 0;
 }

 return activeSamples >= FLAME_CONFIRM_READS;
}

#else
// CHẾ ĐỘ ĐỌC DIGITAL (Tương thích module cũ)

int readFlameRawLevel() {
 if (!ENABLE_FLAME_SENSOR) return HIGH;

 uint8_t highCount = 0;
 for (uint8_t i = 0; i < FLAME_SAMPLE_COUNT; i++) {
 if (digitalRead(FLAME_PIN) == HIGH) {
 highCount++;
 }
 delayMicroseconds(500);
 }

 return highCount > (FLAME_SAMPLE_COUNT / 2) ? HIGH : LOW;
}

bool flameRawLevelIsActive(int rawLevel) {
#if FLAME_ACTIVE_LOW
 return rawLevel == LOW;
#else
 return rawLevel == HIGH;
#endif
}

bool updateStableFlameState(int rawLevel) {
 static uint8_t activeSamples = 0;

 if (!ENABLE_FLAME_SENSOR) {
 activeSamples = 0;
 return false;
 }

 const bool rawActive = millis() >= FLAME_STARTUP_IGNORE_MS && flameRawLevelIsActive(rawLevel);
 flameIdleReady = true;
 flameIdleLevel = FLAME_ACTIVE_LOW ? HIGH : LOW;

 if (rawActive) {
 if (activeSamples < FLAME_CONFIRM_READS) {
 activeSamples++;
 }
 } else {
 activeSamples = 0;
 }

 return activeSamples >= FLAME_CONFIRM_READS;
}
#endif

bool dhtReadingLooksValid(float temperature, float humidity) {
 return !isnan(temperature) &&
 !isnan(humidity) &&
 temperature >= DHT_MIN_VALID_C &&
 temperature <= DHT_MAX_VALID_C &&
 humidity >= HUMIDITY_MIN_VALID &&
 humidity <= HUMIDITY_MAX_VALID;
}

bool mq2ReadingLooksValid(int smokeValue) {
 return smokeValue >= MQ2_MIN_VALID && smokeValue <= MQ2_MAX_VALID;
}

bool updateMq2Baseline(int smokeValue) {
 if (!mq2ReadingLooksValid(smokeValue)) {
 return false;
 }

#if MQ2_AUTO_BASELINE
 if (!mq2BaselineReady) {
 mq2BaselineSum += smokeValue;
 mq2BaselineSamples++;

 if (millis() < MQ2_WARMUP_MS) {
 return false;
 }

 mq2Baseline = mq2BaselineSamples > 0 ? (int)(mq2BaselineSum / mq2BaselineSamples) : smokeValue;
 mq2BaselineReady = true;
 Serial.print("[MQ2] Giá trị nền (Baseline) = ");
 Serial.print(mq2Baseline);
 Serial.println(" (Raw ADC)");
 }

 return true;
#else
 mq2BaselineReady = true;
 mq2Baseline = 0;
 return millis() >= MQ2_WARMUP_MS;
#endif
}

int mq2Delta(int smokeValue) {
#if MQ2_AUTO_BASELINE
 return mq2BaselineReady ? smokeValue - mq2Baseline : 0;
#else
 return smokeValue;
#endif
}

bool mq2WarningDetected(int smokeValue, bool mq2Ready) {
 if (!mq2Ready || !mq2ReadingLooksValid(smokeValue)) {
 return false;
 }

#if MQ2_AUTO_BASELINE
 return mq2Delta(smokeValue) >= MQ2_WARNING_DELTA;
#else
 return smokeValue > SMOKE_WARNING_THRESHOLD;
#endif
}

bool mq2DangerDetected(int smokeValue, bool mq2Ready) {
 if (!mq2Ready || !mq2ReadingLooksValid(smokeValue)) {
 return false;
 }

#if MQ2_AUTO_BASELINE
 return mq2Delta(smokeValue) >= MQ2_DANGER_DELTA;
#else
 return smokeValue > SMOKE_DANGER_THRESHOLD;
#endif
}

int classifyFireLevel(float temperature, bool temperatureValid, int smokeValue, bool hasFlame, bool mq2Ready) {
  const bool smokeDanger = mq2DangerDetected(smokeValue, mq2Ready);
  const bool smokeWarning = mq2WarningDetected(smokeValue, mq2Ready);
  const bool tempDanger = temperatureValid && temperature > TEMP_DANGER_C;
  const bool tempWarning = temperatureValid && temperature > TEMP_WARNING_C;

  // Gop nhom tin hieu
  const bool smokeAbnormal = smokeWarning || smokeDanger;
  const bool tempAbnormal  = tempWarning  || tempDanger;

  // Phat hien cam bien lua bi chay/chap mach (analog doc gan 0)
  const bool flameSensorBurned = (lastFlameAnalog < FLAME_SHORT_CIRCUIT_THRESH) && (lastFlameAnalog >= 0);

  // =================================================================
  // CAP 3 - KHAN CAP (Xac nhan hoac rat co the dang chay)
  // =================================================================
  // 1. Cam bien phat hien LUA (tia hong ngoai) -> Chay thuc su, bao ngay
  // 2. Khoi bat thuong + Nhiet do tang dong thoi -> Dam chay dang phat trien
  // 3. Cam bien lua bi chay/chap (analog = 0) -> Lua da dot chay sensor
  // 4. Khoi day dac, muc do nguy hiem (smokeDanger) -> Kha nang cao la chay lon
  if (hasFlame || (smokeAbnormal && tempAbnormal) || flameSensorBurned || smokeDanger) {
    if (flameSensorBurned) {
      Serial.println("[ALARM] Cam bien lua doc gia tri cuc thap - co the bi chay/chap!");
    }
    return 3;
  }

  // =================================================================
  // CAP 2 - CANH BAO (Bat thuong, can kiem tra, chua xac nhan chay)
  // =================================================================
  // 1. Khoi bat thuong nhung nhiet do on dinh
  //    -> Co the do nau an, hut thuoc, chay am i (smoldering) chua bung
  // 2. Nhiet do CUC CAO (>60C) nhung chua co khoi
  //    -> Thiet bi qua nhiet, nguon nhiet an, sap bung chay
  if (smokeAbnormal || tempDanger) {
    return 2;
  }

  // =================================================================
  // CAP 1 - AN TOAN
  // =================================================================
  return 1;
}

void connectWiFiIfNeeded() {
 static bool warnedAboutConfig = false;

 if (WiFi.status() == WL_CONNECTED) {
 return;
 }

 if (!wifiConfigLooksValid()) {
 if (!warnedAboutConfig) {
 Serial.println("[WiFi] Vui lòng cấu hình SSID và Mật khẩu trong thư mục firmware/include/config.h.");
 warnedAboutConfig = true;
 }
 return;
 }

 const unsigned long now = millis();
 if (lastWifiAttempt != 0 && now - lastWifiAttempt < WIFI_RETRY_MS) {
 return;
 }

 lastWifiAttempt = now;
 Serial.print("[WiFi] Đang kết nối đến mạng: ");
 Serial.println(WIFI_SSID);

 WiFi.disconnect(false);
 WiFi.mode(WIFI_STA);
 WiFi.setSleep(false);
 WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void reportWiFiStatus() {
 static bool wasConnected = false;
 const bool connected = WiFi.status() == WL_CONNECTED;

 if (connected && !wasConnected) {
 Serial.print("[WiFi] Kết nối thành công! IP = ");
 Serial.print(WiFi.localIP());
 Serial.print(", Độ trễ tín hiệu (RSSI) = ");
 Serial.println(WiFi.RSSI());
 } else if (!connected && wasConnected) {
 Serial.println("[WiFi] Mất kết nối.");
 }

 wasConnected = connected;
}

void connectMqttIfNeeded() {
 if (WiFi.status() != WL_CONNECTED || client.connected()) {
 return;
 }

 const unsigned long now = millis();
 if (lastMqttAttempt != 0 && now - lastMqttAttempt < MQTT_RETRY_MS) {
 return;
 }

 lastMqttAttempt = now;

 uint64_t chipId = ESP.getEfuseMac();
 char clientId[40];
 snprintf(
 clientId,
 sizeof(clientId),
 "ESP32_FireAlarm_%04X%08X",
 (uint16_t)(chipId >> 32),
 (uint32_t)chipId
 );

 Serial.print("[MQTT] Khởi tạo kết nối với ID: ");
 Serial.println(clientId);

#if defined(MQTT_USER) && defined(MQTT_PASSWORD)
 bool connected = client.connect(clientId, MQTT_USER, MQTT_PASSWORD);
#else
 bool connected = client.connect(clientId);
#endif

 if (connected) {
 Serial.println("[MQTT] Kết nối Broker thành công.");
 client.subscribe(MQTT_CONTROL_TOPIC);
 lastStatusPublish = 0;
 } else {
 Serial.print("[MQTT] Lỗi kết nối Broker. Trạng thái lỗi (State): ");
 Serial.println(client.state());
 }
}

String payloadToAction(byte* payload, unsigned int length) {
 String message;
 message.reserve(length + 1);
 for (unsigned int i = 0; i < length; i++) {
 message += (char)payload[i];
 }
 message.trim();

 StaticJsonDocument<256> doc;
 DeserializationError error = deserializeJson(doc, message);
 if (!error && doc.containsKey("action")) {
 String action = doc["action"].as<const char*>();
 action.trim();
 action.toUpperCase();
 return action;
 }

 message.toUpperCase();
 return message;
}

void handleControlAction(const String& action) {
 if (action == "OPEN" || action == "OPEN_DOOR") {
 doorOverrideOpen = true;
 Serial.println("[CMD] Nhận lệnh: Bắt buộc MỞ CỬA");
 } else if (action == "CLOSE" || action == "CLOSE_DOOR") {
 doorOverrideOpen = false;
 Serial.println("[CMD] Nhận lệnh: Bắt buộc ĐÓNG CỬA");
 } else if (action == "EMERGENCY" || action == "TRIGGER_EMERGENCY") {
 manualEmergency = true;
 fireLevel = 3;
 Serial.println("[CMD] Nhận lệnh: KÍCH HOẠT KHẨN CẤP");
 } else if (action == "STOP" || action == "STOP_ALARM" || action == "EMERGENCY_STOP" || action == "RESET") {
 manualEmergency = false;
 fireLevel = 1;
 doorOverrideOpen = false;
 buzzerOverride = false;
 ledRedOverride = false;
 ledBlueOverride = false;
 Serial.println("[CMD] Nhận lệnh: DỪNG BÁO ĐỘNG (RESET)");
 } else if (action == "BUZZER_ON") {
 buzzerOverride = true;
 Serial.println("[CMD] Nhận lệnh: BẬT CÒI");
 } else if (action == "BUZZER_OFF") {
 buzzerOverride = false;
 Serial.println("[CMD] Nhận lệnh: TẮT CÒI");
 } else if (action == "LED_RED_ON") {
 ledRedOverride = true;
 Serial.println("[CMD] Nhận lệnh: BẬT LED ĐỎ");
 } else if (action == "LED_RED_OFF") {
 ledRedOverride = false;
 Serial.println("[CMD] Nhận lệnh: TẮT LED ĐỎ");
 } else if (action == "LED_BLUE_ON") {
 ledBlueOverride = true;
 Serial.println("[CMD] Nhận lệnh: BẬT LED XANH");
 } else if (action == "LED_BLUE_OFF") {
 ledBlueOverride = false;
 Serial.println("[CMD] Nhận lệnh: TẮT LED XANH");
 } else {
 Serial.print("[CMD] Lệnh không xác định: ");
 Serial.println(action);
 }
}

void callback(char* topic, byte* payload, unsigned int length) {
 if (String(topic) != MQTT_CONTROL_TOPIC) {
 return;
 }

 const String action = payloadToAction(payload, length);
 handleControlAction(action);
}

void applyOutputs() {
 const unsigned long now = millis();
 emergencyActive = manualEmergency || fireLevel == 3;
 doorIsOpen = emergencyActive || doorOverrideOpen;

 doorServo.write(doorIsOpen ? SERVO_OPEN_ANGLE : SERVO_CLOSED_ANGLE);

 if (emergencyActive) {
 const bool blink = (now / ALARM_BLINK_MS) % 2 == 0;
 digitalWrite(LED_RED, blink ? HIGH : LOW);
 digitalWrite(LED_BLUE, blink ? LOW : HIGH);
 writeBuzzer(blink);
 return;
 }

 const bool warningBlink = fireLevel == 2 && ((now / WARNING_BLINK_MS) % 2 == 0);
 digitalWrite(LED_RED, (ledRedOverride || warningBlink) ? HIGH : LOW);
 digitalWrite(LED_BLUE, (ledBlueOverride || (fireLevel == 1 && WiFi.status() == WL_CONNECTED)) ? HIGH : LOW);
 writeBuzzer(buzzerOverride);
}

void publishStatus(bool force = false) {
 static bool firstPublish = true;
 static bool lastDoorOpen = false;
 static bool lastEmergency = false;

 if (!client.connected()) {
 return;
 }

 const unsigned long now = millis();
 if (!force && !firstPublish && now - lastStatusPublish < STATUS_INTERVAL_MS &&
 lastDoorOpen == doorIsOpen && lastEmergency == emergencyActive) {
 return;
 }

 if (force || firstPublish || lastDoorOpen != doorIsOpen) {
 client.publish(MQTT_DOOR_STATUS_TOPIC, doorIsOpen ? "OPEN" : "CLOSED", true);
 lastDoorOpen = doorIsOpen;
 }

 if (force || firstPublish || lastEmergency != emergencyActive) {
 client.publish(MQTT_EMERGENCY_STATUS_TOPIC, emergencyActive ? "EMERGENCY" : "SAFE", true);
 lastEmergency = emergencyActive;
 }

 firstPublish = false;
 lastStatusPublish = now;
}

void readSensorsAndPublish() {
 const unsigned long now = millis();
 if (now - lastSensorRead < SENSOR_INTERVAL_MS) {
 return;
 }

 lastSensorRead = now;

 const float temperature = dht.readTemperature();
 const float humidity = dht.readHumidity();
 const int smokeValue = analogRead(MQ2_PIN);
#if FLAME_USE_ANALOG
 const bool hasFlame = updateStableFlameState(0);
#else
 const int flameRawLevel = readFlameRawLevel();
 const bool hasFlame = updateStableFlameState(flameRawLevel);
#endif
 const bool mq2Ready = updateMq2Baseline(smokeValue);
 const bool dhtValid = dhtReadingLooksValid(temperature, humidity);

 if (!dhtValid) {
 Serial.print("[DHT] Bỏ qua dữ liệu lỗi. T=");
 Serial.print(temperature);
 Serial.print(" H=");
 Serial.print(humidity);
 Serial.println(" (Kiểm tra lại chân DATA, VCC, GND của DHT).");
 }

  const int measuredLevel = classifyFireLevel(temperature, dhtValid, smokeValue, hasFlame, mq2Ready);
  if (!manualEmergency) {
    fireLevel = measuredLevel;
  }

 const bool effectiveEmergency = manualEmergency || fireLevel == 3;
 const bool effectiveDoorOpen = effectiveEmergency || doorOverrideOpen;

 // Build full JSON payload with ArduinoJson
 StaticJsonDocument<512> doc;

 if (dhtValid) {
 doc["temperature"] = temperature;
 doc["humidity"] = humidity;
 }
 doc["smoke"] = smokeValue;
 doc["smoke_delta"] = mq2Delta(smokeValue);
 doc["flame"] = hasFlame;
 doc["flame_analog"] = lastFlameAnalog;
 doc["level"] = effectiveEmergency ? 3 : fireLevel;
 doc["mq2_ready"] = mq2Ready;

 if (WiFi.status() == WL_CONNECTED) {
 doc["wifi_rssi"] = WiFi.RSSI();
 }

 char payload[512];
 serializeJson(doc, payload, sizeof(payload));

 Serial.print("[DATA] ");
 Serial.println(payload);

 if (client.connected()) {
 bool ok = client.publish(MQTT_TELEMETRY_TOPIC, payload);
 if (!ok) Serial.println("[MQTT] Gửi gói tin thất bại (Kích thước buffer có thể bị đầy).");
 }
}

void setup() {
 Serial.begin(115200);
 delay(300);

 pinMode(MQ2_PIN, INPUT);
 pinMode(FLAME_PIN, INPUT);
 analogSetPinAttenuation(FLAME_PIN, ADC_11db);
 pinMode(BUZZER_PIN, OUTPUT);
 pinMode(LED_RED, OUTPUT);
 pinMode(LED_BLUE, OUTPUT);

 writeBuzzer(false);
 digitalWrite(LED_RED, LOW);
 digitalWrite(LED_BLUE, LOW);

 analogReadResolution(12);
 analogSetPinAttenuation(MQ2_PIN, ADC_11db);

 dht.begin();
 doorServo.setPeriodHertz(50);
 doorServo.attach(SERVO_PIN, 500, 2400);
 doorServo.write(SERVO_CLOSED_ANGLE);

 client.setServer(MQTT_SERVER, MQTT_PORT);
 client.setCallback(callback);
 client.setBufferSize(512);
 client.setKeepAlive(30);

 Serial.println();
 Serial.println("==========================================================");
 Serial.println("[BOOT] ESP32 SMART FIRE ALARM SYSTEM - KHOA CNTT ĐHBK HN");
 Serial.println("[BOOT] Chờ 30 giây để cảm biến MQ-2 thiết lập mức tĩnh...");
 Serial.println("[BOOT] Chú ý: Tránh để lửa gần cảm biến lúc đang khởi động.");
 Serial.println("==========================================================");
}

void loop() {
 connectWiFiIfNeeded();
 reportWiFiStatus();
 connectMqttIfNeeded();

 if (client.connected()) {
 client.loop();
 }

 readSensorsAndPublish();
 applyOutputs();
 publishStatus();
}
