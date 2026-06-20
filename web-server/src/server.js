
// SERVER - HỆ THỐNG BÁO CHÁY THÔNG MINH ESP32
// Sinh viên thực hiện: Nguyễn Nhật Minh - 20225886
// Kiến trúc: Microservices (Web Server Node.js độc lập kết hợp Local MQTT Broker)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const CONFIG = require('./config/config');
const db = require('./database/db');
const mqttService = require('./services/mqttService');
const { setupSockets } = require('./sockets/socketIO');
const { setupRoutes } = require('./routes/apiRoutes');

// Hàm kiểm tra tính hợp lệ của dữ liệu cảm biến
const isValidTemperature = (value) => Number.isFinite(value) && value >= -20 && value <= 80;
const isValidHumidity = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
const isValidSmoke = (value) => Number.isFinite(value) && value >= 0 && value <= 4095;

// KHỞI ĐỘNG HỆ THỐNG

async function startServer() {
 // 1. Khởi tạo Cơ sở dữ liệu SQLite
 await db.initDB();

 const app = express();
 const server = http.createServer(app);
 const io = new Server(server, { cors: { origin: '*' } });

 // 2. Cấu hình thư mục chứa file Frontend tĩnh (HTML/CSS/JS)
 app.use(express.static(path.join(__dirname, '../public')));

 // 3. Tải dữ liệu lịch sử từ SQLite lên bộ nhớ tạm
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
 console.log(`[DB] Đã tải ${sensorHistory.length} bản ghi lịch sử vào bộ nhớ.`);
 } catch (err) {
 console.error('[DB] Lỗi khi tải lịch sử:', err.message);
 }

 // 4. Khởi tạo dịch vụ MQTT (Kết nối Broker, Lắng nghe dữ liệu)
 mqttService.setupMqtt(io, sensorHistory);

 // 5. Khởi tạo WebSockets (Giao tiếp Real-time với trình duyệt)
 setupSockets(io, mqttService, sensorHistory);

 // 6. Cấu hình API RESTful
 app.use('/api', setupRoutes(mqttService, sensorHistory));

 // 7. Chạy Server
 server.listen(CONFIG.WEB_PORT, () => {
 console.log(' HỆ THỐNG BÁO CHÁY THÔNG MINH - KHOA CNTT ĐHBK HN ');
 console.log(`[SERVER] Giao diện Dashboard đang chạy tại: http://localhost:${CONFIG.WEB_PORT}`);
 });
}

// Bắt đầu tiến trình Server
startServer().catch(err => {
 console.error('[SERVER] Lỗi khởi động:', err);
 process.exit(1);
});
