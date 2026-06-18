const mqtt = require('mqtt');
const CONFIG = require('../config/config');
const db = require('../database/db');

// ============================================================
//  VALIDATION HELPERS
// ============================================================
const isValidTemperature = (v) => Number.isFinite(v) && v >= -20 && v <= 80;
const isValidHumidity    = (v) => Number.isFinite(v) && v >= 0  && v <= 100;
const isValidSmoke       = (v) => Number.isFinite(v) && v >= 0  && v <= 4095;

// ============================================================
//  STATE — per-device maps
// ============================================================
// Map<deviceId, latestData>
const latestDataMap = new Map();

// Map<deviceId, boolean> — true = online
const deviceStatusMap = new Map();

// Map<deviceId, Timer> — heartbeat timeout timers
const heartbeatTimers = new Map();

let mqttConnected = false;
let _io = null; // reference to socket.io

// ============================================================
//  BUILD TOPIC LOOKUP — topicString → deviceId
// ============================================================
const topicToDevice = new Map();

CONFIG.DEVICES.forEach(device => {
  topicToDevice.set(`${device.topicPrefix}/telemetry`,        { deviceId: device.id, type: 'data'      });
  topicToDevice.set(`${device.topicPrefix}/status/door`,      { deviceId: device.id, type: 'door'      });
  topicToDevice.set(`${device.topicPrefix}/status/emergency`, { deviceId: device.id, type: 'emergency' });
});

// ============================================================
//  HEARTBEAT — mark device offline after timeout
// ============================================================
function resetHeartbeat(deviceId) {
  // Clear existing timer
  if (heartbeatTimers.has(deviceId)) {
    clearTimeout(heartbeatTimers.get(deviceId));
  }

  // Mark online
  if (!deviceStatusMap.get(deviceId)) {
    deviceStatusMap.set(deviceId, true);
    if (_io) {
      _io.emit('deviceStatus', { deviceId, online: true });
      console.log(`[DEVICE] ✅ ${deviceId} — ONLINE`);
    }
  }

  // Start new timeout
  const timer = setTimeout(() => {
    deviceStatusMap.set(deviceId, false);
    if (_io) {
      _io.emit('deviceStatus', { deviceId, online: false });
      console.log(`[DEVICE] ❌ ${deviceId} — OFFLINE (timeout)`);
    }
  }, CONFIG.DEVICE_TIMEOUT_MS);

  heartbeatTimers.set(deviceId, timer);
}

// ============================================================
//  MQTT CLIENT
// ============================================================
const clientId = 'NodeServer_' + Math.random().toString(16).substring(2, 10);
const mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
  clientId,
  username: CONFIG.MQTT_USERNAME,
  password: CONFIG.MQTT_PASSWORD,
  clean: true,
  connectTimeout: 10000,
  reconnectPeriod: 5000,
});

const setupMqtt = (io, sensorHistory) => {
  _io = io;

  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log('[MQTT] ✅ Kết nối thành công!');

    // Subscribe ALL topics for ALL devices
    const allTopics = [];
    CONFIG.DEVICES.forEach(device => {
      allTopics.push(`${device.topicPrefix}/telemetry`);
      allTopics.push(`${device.topicPrefix}/status/door`);
      allTopics.push(`${device.topicPrefix}/status/emergency`);
    });

    allTopics.forEach(topic => {
      mqttClient.subscribe(topic, (err) => {
        if (!err) console.log(`[MQTT] 📡 Subscribed: ${topic}`);
      });
    });

    io.emit('mqttStatus', { connected: true });
  });

  mqttClient.on('message', (topic, message) => {
    const msg = message.toString();
    const deviceInfo = topicToDevice.get(topic);

    if (!deviceInfo) return; // Unknown topic

    const { deviceId, type } = deviceInfo;

    if (type === 'data') {
      try {
        const data = JSON.parse(msg);
        data.deviceId  = deviceId;
        data.timestamp = new Date().toISOString();

        if (!isValidTemperature(data.temperature)) delete data.temperature;
        if (!isValidHumidity(data.humidity))        delete data.humidity;
        if (!isValidSmoke(data.smoke))              delete data.smoke;

        latestDataMap.set(deviceId, data);

        // Per-device history (reuse shared array with deviceId tag)
        sensorHistory.push(data);
        if (sensorHistory.length > CONFIG.MAX_HISTORY * CONFIG.DEVICES.length) {
          sensorHistory.shift();
        }

        // Persist to SQLite
        db.run(
          `INSERT INTO sensor_data (deviceId, temperature, humidity, smoke, smoke_delta, flame, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            data.deviceId,
            isValidTemperature(data.temperature) ? data.temperature : null,
            isValidHumidity(data.humidity)        ? data.humidity    : null,
            isValidSmoke(data.smoke)              ? data.smoke       : null,
            Number.isFinite(data.smoke_delta)     ? data.smoke_delta : null,
            data.flame ? 1 : 0,
            data.timestamp,
          ]
        );

        io.emit('fireAlarmData', data);

        // Reset heartbeat timer → device is alive
        resetHeartbeat(deviceId);

        const tempText   = isValidTemperature(data.temperature) ? `${data.temperature}°C` : 'N/A';
        const humText    = isValidHumidity(data.humidity)        ? `${data.humidity}%`     : 'N/A';
        const smokeText  = Number.isFinite(data.smoke_delta)     ? `Δ${data.smoke_delta}`  : `${data.smoke}`;
        console.log(`[${deviceId}] T:${tempText} H:${humText} Smoke:${smokeText} Flame:${data.flame}`);
      } catch (e) {
        console.error(`[MQTT][${deviceId}] ❌ Parse error:`, msg);
      }
    }

    if (type === 'door') {
      io.emit('doorStatus', { deviceId, state: msg });
      console.log(`[DOOR][${deviceId}] ${msg}`);
    }

    if (type === 'emergency') {
      io.emit('emergencyStatus', { deviceId, status: msg });
      console.log(`[EMERGENCY][${deviceId}] ${msg}`);
    }
  });

  mqttClient.on('error', (err) => {
    mqttConnected = false;
    io.emit('mqttStatus', { connected: false });
    console.error('[MQTT] ❌ Lỗi:', err.message);
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
    io.emit('mqttStatus', { connected: false });
    console.log('[MQTT] 🔌 Ngắt kết nối');
  });
};

// ============================================================
//  PUBLIC API
// ============================================================
const getLatestData    = (deviceId) => deviceId ? latestDataMap.get(deviceId) : null;
const getAllLatestData  = ()         => Object.fromEntries(latestDataMap);
const isMqttConnected  = ()         => mqttConnected;
const isDeviceOnline   = (deviceId) => deviceStatusMap.get(deviceId) === true;
const getAllDeviceStatus = ()        => Object.fromEntries(deviceStatusMap);

/**
 * Publish a control command to a specific device.
 * @param {string} deviceId
 * @param {string} command  — e.g. 'OPEN', 'CLOSE', 'EMERGENCY', 'STOP_ALARM'
 */
const publish = (deviceId, command) => {
  const device = CONFIG.DEVICES.find(d => d.id === deviceId);
  if (!device) {
    console.warn(`[MQTT] ⚠️ Unknown deviceId: ${deviceId}`);
    return;
  }
  const topic = `${device.topicPrefix}/led_control`;
  const payload = JSON.stringify({ action: command });
  mqttClient.publish(topic, payload);
  console.log(`[MQTT] 📤 [${deviceId}] ${topic} → ${payload}`);
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
