#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

// CẤU HÌNH WIFI & MQTT
const char* ssid = "Wokwi-GUEST"; 
const char* password = "";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

// Đặt tên Topic 
const char* topic_publish = "nguyennhatminh_20225886/telemetry"; 
const char* topic_subscribe = "nguyennhatminh_20225886/led_control"; 
// KHAI BÁO CHÂN
#define DHTPIN 15
#define DHTTYPE DHT22
#define MQ2_PIN 34
#define FLAME_PIN 32
#define SERVO_PIN 18
#define BUZZER_PIN 4
#define LED_RED 2
#define LED_BLUE 19

// KHỞI TẠO ĐỐI TƯỢNG
WiFiClient espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);
Servo doorServo;

unsigned long lastMsg = 0;
bool isEmergency = false; 
int fireLevel = 1;

// Hàm kết nối Wi-Fi
void setup_wifi() {
  delay(10);
  Serial.println("\nĐang kết nối Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nKết nối Wi-Fi thành công");
}

// Xử lý khi nhận lệnh từ Server
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) message += (char)payload[i];
  
  StaticJsonDocument<200> doc;
  if (!deserializeJson(doc, message)) {
    if (String(topic) == topic_subscribe) {  // Xử lý nguyennhatminh_20225886/led_control
      String action = doc["action"];
      
      // Lệnh điều khiển cửa
      if (action == "OPEN_DOOR") {
        fireLevel = 3;  // Kích hoạt chế độ khẩn cấp
        Serial.println("[MQTT] Lệnh từ xa: OPEN_DOOR");
      } 
      else if (action == "CLOSE_DOOR") {
        fireLevel = 1;  // Trở lại bình thường
        Serial.println("[MQTT] Lệnh từ xa: CLOSE_DOOR");
      }
      // Lệnh điều khiển báo động
      else if (action == "BUZZER_ON") {
        digitalWrite(BUZZER_PIN, HIGH);
        Serial.println("[MQTT] Lệnh từ xa: BUZZER_ON");
      }
      else if (action == "BUZZER_OFF") {
        digitalWrite(BUZZER_PIN, LOW);
        Serial.println("[MQTT] Lệnh từ xa: BUZZER_OFF");
      }
      // Lệnh điều khiển LED
      else if (action == "LED_RED_ON") {
        digitalWrite(LED_RED, HIGH);
        Serial.println("[MQTT] Lệnh từ xa: LED_RED_ON");
      }
      else if (action == "LED_RED_OFF") {
        digitalWrite(LED_RED, LOW);
        Serial.println("[MQTT] Lệnh từ xa: LED_RED_OFF");
      }
      else if (action == "LED_BLUE_ON") {
        digitalWrite(LED_BLUE, HIGH);
        Serial.println("[MQTT] Lệnh từ xa: LED_BLUE_ON");
      }
      else if (action == "LED_BLUE_OFF") {
        digitalWrite(LED_BLUE, LOW);
        Serial.println("[MQTT] Lệnh từ xa: LED_BLUE_OFF");
      }
      // Dừng khẩn cấp
      else if (action == "EMERGENCY_STOP") {
        fireLevel = 1;
        digitalWrite(BUZZER_PIN, LOW);
        digitalWrite(LED_RED, LOW);
        digitalWrite(LED_BLUE, LOW);
        doorServo.write(0);
        Serial.println("[MQTT] Lệnh từ xa: EMERGENCY_STOP");
      }
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("MQTT đang kết nối...");
    if (client.connect("ESP32_FireAlarmClient")) {
      Serial.println("kết nối thành công");
      client.subscribe(topic_subscribe);  // Đăng ký nhận lệnh điều khiển từ xa 
    } else {
      Serial.print("kết nối thất bại, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  dht.begin();
  doorServo.attach(SERVO_PIN);
  doorServo.write(0);  // Khởi tạo cửa ở vị trí đóng

  pinMode(MQ2_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
}

void loop() {
  // Duy trì kết nối MQTT
  if (!client.connected()) reconnect();
  client.loop();

  // Thực thi hành động theo cấp độ
  if (fireLevel == 3) {
    // Cấp 3: Khẩn cấp - Kích hoạt tất cả cơ chế an toàn
    isEmergency = true;
    doorServo.write(90);  // Mở cửa thoát hiểm
    // Kích hoạt báo động xoay chiều: LED đỏ + Còi
    digitalWrite(LED_RED, HIGH); digitalWrite(LED_BLUE, LOW); digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(LED_RED, LOW); digitalWrite(LED_BLUE, HIGH); digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  } else {
    // Cấp 1-2: Hoạt động bình thường - Hủy chế độ khẩn cấp
    isEmergency = false;
    doorServo.write(0);  // Đóng cửa thoát hiểm
    digitalWrite(LED_RED, LOW); digitalWrite(LED_BLUE, LOW); digitalWrite(BUZZER_PIN, LOW);
  }

  // Đọc cảm biến và phân loại cấp độ mỗi 2 giây
  unsigned long now = millis();
  if (now - lastMsg > (isEmergency ? 0 : 2000)) {
    if (!isEmergency) lastMsg = now;

    // Đọc giá trị từ các cảm biến phát hiện cháy
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int smokeValue = analogRead(MQ2_PIN); 
    bool hasFlame = (digitalRead(FLAME_PIN) == LOW);

    if (isnan(temp)) return;  // Bỏ qua nếu đọc nhiệt độ thất bại

    // Phân loại cấp độ cháy
    // Cấp 3 khẩn cấp: Phát hiện lửa hoặc khí cao + nhiệt cao
    // Cấp 2 cảnh báo: Khí vừa phải hoặc nhiệt tăng
    // Cấp 1 bình thường: Tất cả cảm biến dưới ngưỡng
    if (hasFlame || (smokeValue > 2000 && temp > 50)) {
      fireLevel = 3;  // Khẩn cấp: Lửa hoặc điều kiện cực đoan
    } else if (smokeValue > 1000 || temp > 40) {
      fireLevel = 2;  // Cảnh báo: Phát hiện điều kiện cháy tiềm ẩn
    } else {
      fireLevel = 1;  // Bình thường: Tất cả cảm biến an toàn
    }

    // Truyền dữ liệu MQTT: Chế độ bình thường mỗi 2s hoặc liên tục ở chế độ khẩn cấp
    if (!isEmergency || (now - lastMsg > 2000)) {
      lastMsg = now;
      
      // Tạo JSON chứa dữ liệu cảm biến
      StaticJsonDocument<200> doc;
      doc["temperature"] = temp;
      doc["humidity"] = hum;
      doc["smoke"] = smokeValue;
      doc["flame"] = hasFlame;
      doc["level"] = fireLevel;

      // Chuyển đổi và gửi qua MQTT
      String payload;
      serializeJson(doc, payload);
      
      Serial.print("Level: "); Serial.print(fireLevel);
      Serial.print(" | Payload: "); Serial.println(payload);
      client.publish(topic_publish, payload.c_str());
    }
  }
}