const mqtt = require('mqtt');
const CONFIG = require('../config/config');
const db = require('../database/db');

let mqttConnected = false;
let latestData = null;

const clientId = 'NodeServer_' + Math.random().toString(16).substring(2, 10);
const mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
  clientId: clientId,
  clean: true,
  connectTimeout: 10000,
  reconnectPeriod: 5000,
});

const setupMqtt = (io, sensorHistory) => {
  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log('[MQTT] ✅ Kết nối thành công!');
    
    const topics = [
      CONFIG.TOPICS.FIRE_ALARM_DATA,
      CONFIG.TOPICS.DOOR_STATUS,
      CONFIG.TOPICS.EMERGENCY_STATUS
    ];
    topics.forEach(topic => mqttClient.subscribe(topic));

    io.emit('mqttStatus', { connected: true });
  });

  mqttClient.on('message', (topic, message) => {
    const msg = message.toString();

    if (topic === CONFIG.TOPICS.FIRE_ALARM_DATA) {
      try {
        const data = JSON.parse(msg);
        data.timestamp = new Date().toISOString();
        latestData = data;

        sensorHistory.push(data);
        if (sensorHistory.length > CONFIG.MAX_HISTORY) sensorHistory.shift();

        // Ghi vào SQLite (sql.js - đồng bộ)
        db.run(
          `INSERT INTO sensor_data (temperature, humidity, smoke, flame, timestamp) VALUES (?, ?, ?, ?, ?)`, 
          [data.temperature, data.humidity, data.smoke, data.flame ? 1 : 0, data.timestamp]
        );

        io.emit('fireAlarmData', data);
        console.log(`[DATA] T:${data.temperature}°C H:${data.humidity}% Smoke:${data.smoke}ppm Flame:${data.flame}`);
      } catch (e) {
        console.error('[MQTT] ❌ Parse error:', msg);
      }
    }

    if (topic === CONFIG.TOPICS.DOOR_STATUS) {
      io.emit('doorStatus', msg);
      console.log(`[DOOR] Trạng thái: ${msg}`);
    }

    if (topic === CONFIG.TOPICS.EMERGENCY_STATUS) {
      io.emit('emergencyStatus', msg);
      console.log(`[EMERGENCY] Trạng thái: ${msg}`);
    }
  });

  mqttClient.on('error', (err) => {
    mqttConnected = false;
    io.emit('mqttStatus', { connected: false });
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
    io.emit('mqttStatus', { connected: false });
  });
};

const getLatestData = () => latestData;
const isMqttConnected = () => mqttConnected;
const publish = (topic, message) => mqttClient.publish(topic, message);

module.exports = { setupMqtt, getLatestData, isMqttConnected, publish };
