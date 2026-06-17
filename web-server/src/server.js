//  SERVER - HỆ THỐNG BÁO CHÁY THÔNG MINH ESP32
//  Nguyễn Nhật Minh - 20225886

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const CONFIG = require('./config/config');
const db = require('./database/db');
const mqttService = require('./services/mqttService');
const { setupSockets } = require('./sockets/socketIO');
const { setupRoutes } = require('./routes/apiRoutes');

const isValidTemperature = (value) => Number.isFinite(value) && value >= -20 && value <= 80;
const isValidHumidity = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
const isValidSmoke = (value) => Number.isFinite(value) && value >= 0 && value <= 4095;

// KHỞI ĐỘNG HỆ THỐNG
async function startServer() {
  // Khởi tạo CSDL trước
  await db.initDB();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(express.static(path.join(__dirname, '../public')));

  // Tải lịch sử từ CSDL
  let sensorHistory = [];
  try {
    const rows = db.all(`SELECT * FROM sensor_data ORDER BY id DESC LIMIT ?`, [CONFIG.MAX_HISTORY]);
    sensorHistory = rows.reverse().map(row => {
      const data = {
        ...row,
        flame: row.flame === 1,
      };

      if (!isValidTemperature(data.temperature)) delete data.temperature;
      if (!isValidHumidity(data.humidity)) delete data.humidity;
      if (!isValidSmoke(data.smoke)) delete data.smoke;

      return data;
    });
    console.log(`[DB] 📦 Đã tải ${sensorHistory.length} bản ghi lịch sử.`);
  } catch (err) {
    console.error('[DB] ❌ Lỗi khi tải lịch sử:', err.message);
  }

  // Kết nối MQTT
  mqttService.setupMqtt(io, sensorHistory);

  // Socket.IO
  setupSockets(io, mqttService, sensorHistory);

  // API Routes
  app.use('/api', setupRoutes(mqttService, sensorHistory));

  // Khởi chạy Express
  server.listen(CONFIG.WEB_PORT, () => {
    console.log(' HỆ THỐNG BÁO CHÁY THÔNG MINH - WEB SERVER');
    console.log(`[SERVER] 🚀 Đang chạy tại http://localhost:${CONFIG.WEB_PORT}`);
  });
}

startServer().catch(err => {
  console.error('[SERVER] ❌ Lỗi khởi động:', err);
  process.exit(1);
});
