const mqtt = require('mqtt');
const CONFIG = require('../config/config');
const db = require('../database/db');

// HÀM HỖ TRỢ KIỂM TRA DỮ LIỆU

const isValidTemperature = (v) => Number.isFinite(v) && v >= -20 && v <= 80;
const isValidHumidity = (v) => Number.isFinite(v) && v >= 0 && v <= 100;
const isValidSmoke = (v) => Number.isFinite(v) && v >= 0 && v <= 4095;

// TRẠNG THÁI HỆ THỐNG

// Map<deviceId, latestData> - Lưu trữ dữ liệu mới nhất của từng thiết bị
const latestDataMap = new Map();

// Map<deviceId, boolean> - Theo dõi trạng thái Online/Offline (true = online)
const deviceStatusMap = new Map();

// Map<deviceId, Timer> - Bộ đếm thời gian kiểm tra mất kết nối (heartbeat)
const heartbeatTimers = new Map();

let mqttConnected = false;
let _io = null; // Biến tham chiếu đến Socket.IO instance

// BẢNG MAP TOPIC -> THIẾT BỊ

const topicToDevice = new Map();

CONFIG.DEVICES.forEach(device => {
 topicToDevice.set(`${device.topicPrefix}/telemetry`, { deviceId: device.id, type: 'data' });
 topicToDevice.set(`${device.topicPrefix}/status/door`, { deviceId: device.id, type: 'door' });
 topicToDevice.set(`${device.topicPrefix}/status/emergency`, { deviceId: device.id, type: 'emergency' });
});

// XỬ LÝ HEARTBEAT (KIỂM TRA THIẾT BỊ HOẠT ĐỘNG)

function resetHeartbeat(deviceId) {
 // Hủy bộ đếm cũ nếu có
 if (heartbeatTimers.has(deviceId)) {
 clearTimeout(heartbeatTimers.get(deviceId));
 }

 // Đánh dấu thiết bị đang Online
 if (!deviceStatusMap.get(deviceId)) {
 deviceStatusMap.set(deviceId, true);
 if (_io) {
 _io.emit('deviceStatus', { deviceId, online: true });
 console.log(`[DEVICE] ${deviceId} — ĐÃ KẾT NỐI (ONLINE)`);
 }
 }

 // Bắt đầu bộ đếm mới. Nếu hết thời gian mà không có dữ liệu -> Offline
 const timer = setTimeout(() => {
 deviceStatusMap.set(deviceId, false);
 if (_io) {
 _io.emit('deviceStatus', { deviceId, online: false });
 console.log(`[DEVICE] ${deviceId} — MẤT KẾT NỐI (OFFLINE)`);
 }
 }, CONFIG.DEVICE_TIMEOUT_MS);

 heartbeatTimers.set(deviceId, timer);
}

// CẤU HÌNH KẾT NỐI MQTT CLIENT

const clientId = 'NodeServer_' + Math.random().toString(16).substring(2, 10);
const mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
 clientId,
 username: CONFIG.MQTT_USERNAME,
 password: CONFIG.MQTT_PASSWORD,
 clean: true,
 connectTimeout: 10000,
 reconnectPeriod: 5000,
 protocolVersion: 4, 
});

const setupMqtt = (io, sensorHistory) => {
 _io = io;

 mqttClient.on('connect', () => {
 mqttConnected = true;
 console.log('[MQTT] Kết nối Broker thành công!');

 // Đăng ký nhận bản tin (Subscribe) cho toàn bộ thiết bị
 const allTopics = [];
 CONFIG.DEVICES.forEach(device => {
 allTopics.push(`${device.topicPrefix}/telemetry`);
 allTopics.push(`${device.topicPrefix}/status/door`);
 allTopics.push(`${device.topicPrefix}/status/emergency`);
 });

 allTopics.forEach(topic => {
 mqttClient.subscribe(topic, (err) => {
 if (!err) console.log(`[MQTT] Đã theo dõi Topic: ${topic}`);
 });
 });

 io.emit('mqttStatus', { connected: true });
 });

 mqttClient.on('message', (topic, message) => {
 const msg = message.toString();
 const deviceInfo = topicToDevice.get(topic);

 if (!deviceInfo) return; // Bỏ qua nếu nhận bản tin lạ

 const { deviceId, type } = deviceInfo;

 if (type === 'data') {
 try {
 const data = JSON.parse(msg);
 data.deviceId = deviceId;
 data.timestamp = new Date().toISOString();

 // Lọc dữ liệu lỗi
 if (!isValidTemperature(data.temperature)) delete data.temperature;
 if (!isValidHumidity(data.humidity)) delete data.humidity;
 if (!isValidSmoke(data.smoke)) delete data.smoke;

 // Cập nhật trạng thái mới nhất
 latestDataMap.set(deviceId, data);

 // Đẩy vào danh sách lịch sử trong RAM
 sensorHistory.push(data);
 if (sensorHistory.length > CONFIG.MAX_HISTORY * CONFIG.DEVICES.length) {
 sensorHistory.shift();
 }

 // Lưu vào SQLite CSDL
 db.run(
 `INSERT INTO sensor_data (deviceId, temperature, humidity, smoke, smoke_delta, flame, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
 [
 data.deviceId,
 isValidTemperature(data.temperature) ? data.temperature : null,
 isValidHumidity(data.humidity) ? data.humidity : null,
 isValidSmoke(data.smoke) ? data.smoke : null,
 Number.isFinite(data.smoke_delta) ? data.smoke_delta : null,
 data.flame ? 1 : 0,
 data.timestamp,
 ]
 );

 // Gửi qua WebSocket cho Client đang mở web
 io.emit('fireAlarmData', data);

 // Nhận được dữ liệu => Reset bộ đếm Heartbeat (Thiết bị vẫn sống)
 resetHeartbeat(deviceId);

 const tempText = isValidTemperature(data.temperature) ? `${data.temperature}°C` : 'N/A';
 const humText = isValidHumidity(data.humidity) ? `${data.humidity}%` : 'N/A';
 const smokeText = Number.isFinite(data.smoke_delta) ? `Δ${data.smoke_delta}` : `${data.smoke}`;
 console.log(`[${deviceId}] T:${tempText} | H:${humText} | Khói:${smokeText} | Lửa:${data.flame}`);
 } catch (e) {
 console.error(`[MQTT][${deviceId}] Lỗi phân tích JSON:`, e.message);
 console.error(`[MQTT][${deviceId}] Chuỗi lỗi:`, msg);
 }
 }

 if (type === 'door') {
 io.emit('doorStatus', { deviceId, state: msg });
 console.log(`[DOOR][${deviceId}] Trạng thái cửa: ${msg}`);
 }

 if (type === 'emergency') {
 io.emit('emergencyStatus', { deviceId, status: msg });
 console.log(`[EMERGENCY][${deviceId}] Cảnh báo khẩn cấp: ${msg}`);
 }
 });

 mqttClient.on('error', (err) => {
 mqttConnected = false;
 io.emit('mqttStatus', { connected: false });
 console.error('[MQTT] Lỗi kết nối:', err.message);
 });

 mqttClient.on('close', () => {
 mqttConnected = false;
 io.emit('mqttStatus', { connected: false });
 console.log('[MQTT] Đã ngắt kết nối với Broker');
 });
};

// PUBLIC API CỦA SERVICE

const getLatestData = (deviceId) => deviceId ? latestDataMap.get(deviceId) : null;
const getAllLatestData = () => Object.fromEntries(latestDataMap);
const isMqttConnected = () => mqttConnected;
const isDeviceOnline = (deviceId) => deviceStatusMap.get(deviceId) === true;
const getAllDeviceStatus = () => Object.fromEntries(deviceStatusMap);

/**
 * Gửi lệnh điều khiển xuống ESP32.
 * @param {string} deviceId ID của kit ESP32
 * @param {string} command Lệnh điều khiển, ví dụ: 'OPEN', 'CLOSE', 'EMERGENCY', 'STOP_ALARM'
 */
const publish = (deviceId, command) => {
 const device = CONFIG.DEVICES.find(d => d.id === deviceId);
 if (!device) {
 console.warn(`[MQTT] ️ Không tìm thấy thiết bị: ${deviceId}`);
 return;
 }
 const topic = `${device.topicPrefix}/led_control`;
 const payload = JSON.stringify({ action: command });
 mqttClient.publish(topic, payload);
 console.log(`[MQTT] [${deviceId}] Đã gửi lệnh (${topic}) -> ${payload}`);
};

module.exports = {
 setupMqtt,
 getLatestData,
 getAllLatestData,
 isMqttConnected,
 isDeviceOnline,
 getAllDeviceStatus,
 publish,
};
