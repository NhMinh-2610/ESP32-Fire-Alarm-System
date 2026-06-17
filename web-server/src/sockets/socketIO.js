const CONFIG = require('../config/config');

const setupSockets = (io, mqttService, sensorHistory) => {
  io.on('connection', (socket) => {
    console.log(`[WEB] 🌐 Client kết nối: ${socket.id}`);

    // ── Gửi trạng thái MQTT ──────────────────────────────────
    socket.emit('mqttStatus', { connected: mqttService.isMqttConnected() });

    // ── Gửi danh sách thiết bị + trạng thái ──────────────────
    const devicesInfo = CONFIG.DEVICES.map(d => ({
      id:     d.id,
      name:   d.name,
      online: mqttService.isDeviceOnline(d.id),
    }));
    socket.emit('devicesConfig', devicesInfo);

    // ── Gửi dữ liệu mới nhất cho từng kit ────────────────────
    CONFIG.DEVICES.forEach(d => {
      const latest = mqttService.getLatestData(d.id);
      if (latest) socket.emit('fireAlarmData', latest);
    });

    // ── Gửi lịch sử ──────────────────────────────────────────
    socket.emit('history', sensorHistory);

    // ── ĐIỀU KHIỂN CỬA ───────────────────────────────────────
    // payload: { deviceId, action }  action = 'OPEN' | 'CLOSE'
    socket.on('controlDoor', ({ deviceId, action } = {}) => {
      if (!isValidDevice(deviceId)) {
        socket.emit('controlError', { message: 'Thiết bị không hợp lệ' });
        return;
      }
      const actionStr = String(action);
      console.log(`[WEB] 🚪 [${deviceId}] Điều khiển cửa: ${actionStr}`);
      mqttService.publish(deviceId, actionStr);
    });

    // ── KÍCH HOẠT KHẨN CẤP ───────────────────────────────────
    // payload: { deviceId }
    socket.on('triggerEmergency', ({ deviceId } = {}) => {
      if (!isValidDevice(deviceId)) {
        socket.emit('controlError', { message: 'Thiết bị không hợp lệ' });
        return;
      }
      console.log(`[WEB] 🚨 [${deviceId}] Kích hoạt khẩn cấp!`);
      mqttService.publish(deviceId, 'EMERGENCY');
    });

    // ── DỪNG BÁO ĐỘNG ────────────────────────────────────────
    // payload: { deviceId }
    socket.on('stopAlarm', ({ deviceId } = {}) => {
      if (!isValidDevice(deviceId)) {
        socket.emit('controlError', { message: 'Thiết bị không hợp lệ' });
        return;
      }
      console.log(`[WEB] 🛑 [${deviceId}] Dừng báo động!`);
      mqttService.publish(deviceId, 'STOP_ALARM');
    });

    // ── NGẮT KẾT NỐI ─────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[WEB] 🔌 Client ngắt kết nối: ${socket.id}`);
    });
  });
};

// Validate deviceId có trong danh sách cấu hình
function isValidDevice(deviceId) {
  return CONFIG.DEVICES.some(d => d.id === deviceId);
}

module.exports = { setupSockets };
