const CONFIG = require('../config/config');

// GIAO TIẾP REAL-TIME THÔNG QUA SOCKET.IO

const setupSockets = (io, mqttService, sensorHistory) => {
 io.on('connection', (socket) => {
 console.log(`[WEB] Client kết nối: ${socket.id}`);

// 1. Gửi trạng thái kết nối MQTT
 socket.emit('mqttStatus', { connected: mqttService.isMqttConnected() });

// 2. Gửi danh sách thiết bị và trạng thái Online/Offline ban đầu
 const devicesInfo = CONFIG.DEVICES.map(d => ({
 id: d.id,
 name: d.name,
 online: mqttService.isDeviceOnline(d.id),
 }));
 socket.emit('devicesConfig', devicesInfo);

// 3. Gửi dữ liệu cảm biến mới nhất (nếu có)
 CONFIG.DEVICES.forEach(d => {
 const latest = mqttService.getLatestData(d.id);
 if (latest) socket.emit('fireAlarmData', latest);
 });

// 4. Gửi mảng lịch sử (để vẽ biểu đồ)
 socket.emit('history', sensorHistory);

 // NHẬN LỆNH TỪ TRÌNH DUYỆT (DASHBOARD)

// ĐIỀU KHIỂN CỬA
 // payload: { deviceId, action } (action = 'OPEN' hoặc 'CLOSE')
 socket.on('controlDoor', ({ deviceId, action } = {}) => {
 if (!isValidDevice(deviceId)) {
 socket.emit('controlError', { message: 'Lỗi: Thiết bị không hợp lệ!' });
 return;
 }
 const actionStr = String(action);
 console.log(`[WEB] [${deviceId}] Lệnh điều khiển cửa: ${actionStr}`);
 mqttService.publish(deviceId, actionStr);
 });

// KÍCH HOẠT KHẨN CẤP (BÁO CHÁY GIẢ LẬP)
 socket.on('triggerEmergency', ({ deviceId } = {}) => {
 if (!isValidDevice(deviceId)) {
 socket.emit('controlError', { message: 'Lỗi: Thiết bị không hợp lệ!' });
 return;
 }
 console.log(`[WEB] [${deviceId}] Lệnh kích hoạt báo cháy khẩn cấp!`);
 mqttService.publish(deviceId, 'EMERGENCY');
 });

// DỪNG BÁO ĐỘNG (RESET)
 socket.on('stopAlarm', ({ deviceId } = {}) => {
 if (!isValidDevice(deviceId)) {
 socket.emit('controlError', { message: 'Lỗi: Thiết bị không hợp lệ!' });
 return;
 }
 console.log(`[WEB] [${deviceId}] Lệnh dừng báo động (Reset)!`);
 mqttService.publish(deviceId, 'STOP_ALARM');
 });

// NGẮT KẾT NỐI
 socket.on('disconnect', () => {
 console.log(`[WEB] Client ngắt kết nối: ${socket.id}`);
 });
 });
};

// HÀM KIỂM TRA TÍNH HỢP LỆ THIẾT BỊ

function isValidDevice(deviceId) {
 return CONFIG.DEVICES.some(d => d.id === deviceId);
}

module.exports = { setupSockets };
