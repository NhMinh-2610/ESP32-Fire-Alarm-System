# Nap code len ESP32 that

Huong dan nay dung khi chay tren kit ESP32 that, khong dung Wokwi.

## 1. Sua WiFi va MQTT

Mo file:

```text
firmware/include/config.h
```

Sua hai dong nay theo WiFi 2.4 GHz cua ban:

```cpp
#define WIFI_SSID "TEN_WIFI_CUA_BAN"
#define WIFI_PASSWORD "MAT_KHAU_WIFI"
```

ESP32 thuong khong ket noi duoc WiFi 5 GHz.

Neu dashboard hien nhiet do/do am vo ly nhu `384°C` hoac `3660%`, gan nhu chac chan la khai bao sai loai DHT hoac dau day sai. Neu cam bien cua ban la DHT11, sua:

```cpp
#define DHT_SENSOR_TYPE DHT11
```

Neu dung dung DHT22 thi giu:

```cpp
#define DHT_SENSOR_TYPE DHT22
```

## 2. Dau day phan cung

Dung pinout hien tai trong firmware:

| Thiet bi | Chan ESP32 |
| --- | --- |
| DHT22 DATA | GPIO 15 |
| MQ-2 AO/SIG | GPIO 34 |
| Flame sensor OUT/DO | GPIO 32 |
| Servo PWM | GPIO 18 |
| Buzzer + | GPIO 4 |
| LED do | GPIO 2 |
| LED xanh | GPIO 19 |

Luu y quan trong:

- MQ-2 can warm-up. Firmware tu lay nen khong khi sach trong 30 giay dau. Khi vua reset, de cam bien o moi truong binh thuong va khong dua gas/khói vao gan cam bien.
- Sau khi calibrate, dashboard/Serial se co `mq2_baseline` va `smoke_delta`. Canh bao gas dua tren `smoke_delta`, khong dua tren raw ADC tuyet doi.
- Neu van bao gas gia, tang `MQ2_WARNING_DELTA` trong `firmware/include/config.h`. Neu qua kem nhay, giam gia tri nay.
- Neu cap MQ-2 bang 5V, chan analog AO co the ra gan 5V. ESP32 ADC chi chiu toi da 3.3V, nen can module co AO 3.3V hoac mach chia ap.
- Servo SG90 nen dung nguon 5V rieng neu bi reset ESP32 khi servo quay. Nho noi chung GND voi ESP32.
- Flame sensor tu hoc muc khong-co-lua trong 5 giay dau. Luc reset khong chieu lua/remote hong ngoai vao cam bien.
- Neu khong muon auto hoc muc idle, doi `FLAME_AUTO_IDLE_LEVEL` thanh `0`, roi chinh `FLAME_ACTIVE_LOW`.
- Neu chua lap flame sensor hoac no cu bao lua khi khong co lua, tam thoi doi `#define ENABLE_FLAME_SENSOR 1` thanh `0` de test DHT/MQ-2 truoc.
- Neu buzzer cua ban la active-low, doi `#define BUZZER_ACTIVE_LEVEL HIGH` thanh `LOW`.

## 3. Nap firmware bang PlatformIO

Mo terminal tai thu muc `firmware`:

```bash
pio run --target upload
```

Neu PlatformIO khong tu nhan cong COM, xem cong trong Device Manager roi sua `firmware/platformio.ini`:

```ini
upload_port = COM5
monitor_port = COM5
```

Sau khi nap, mo serial monitor:

```bash
pio device monitor --baud 115200
```

Log binh thuong se co dang:

```text
[BOOT] ESP32 Fire Alarm System - real hardware mode
[WiFi] Connecting to ...
[WiFi] Connected, IP=...
[MQTT] Connected
[DATA] {"temperature":...,"humidity":...,"smoke":...,"flame":false,"level":1,...}
```

## 4. Chay dashboard

Mo terminal tai thu muc `web-server`:

```bash
npm install
npm start
```

Mo trinh duyet:

```text
http://localhost:3000
```

Firmware moi nhan duoc ca lenh cu kieu JSON, vi du `{"action":"OPEN_DOOR"}`, va lenh dashboard hien tai dang gui dang chuoi thuan: `OPEN`, `CLOSE`, `EMERGENCY`.
