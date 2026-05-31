#include <Arduino.h>
#include <WiFi.h>
#include <DHT.h>
#include <ESP32Servo.h>

// WiFi config
const char* ssid = "Wokwi-GUEST"; 
const char* password = "";

// Pin definitions
#define DHTPIN 15
#define DHTTYPE DHT22
#define MQ2_PIN 34
#define FLAME_PIN 32
#define SERVO_PIN 18
#define BUZZER_PIN 4
#define LED_RED 2
#define LED_BLUE 19

// Objects
DHT dht(DHTPIN, DHTTYPE);
Servo doorServo;

unsigned long lastMsg = 0;
int fireLevel = 1;

void setup_wifi() {
  delay(10);
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void setup() {
  Serial.begin(115200);
  setup_wifi();

  dht.begin();
  doorServo.attach(SERVO_PIN);
  doorServo.write(0);

  pinMode(MQ2_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
}

void loop() {
  unsigned long now = millis();
  if (now - lastMsg > 2000) {
    lastMsg = now;

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    int smokeValue = analogRead(MQ2_PIN); 
    bool hasFlame = (digitalRead(FLAME_PIN) == LOW);

    if (isnan(temp)) return;

    if (hasFlame || (smokeValue > 2000 && temp > 50)) {
      fireLevel = 3;
    } else if (smokeValue > 1000 || temp > 40) {
      fireLevel = 2;
    } else {
      fireLevel = 1;
    }

    Serial.print("Level: "); Serial.print(fireLevel);
    Serial.print(" | Temp: "); Serial.print(temp);
    Serial.print(" | Hum: "); Serial.print(hum);
    Serial.print(" | Smoke: "); Serial.print(smokeValue);
    Serial.print(" | Flame: "); Serial.println(hasFlame);
  }
}