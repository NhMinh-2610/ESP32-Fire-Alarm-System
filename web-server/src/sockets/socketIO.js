const CONFIG = require('../config/config');

const setupSockets = (io, mqttService, sensorHistory) => {
  io.on('connection', (socket) => {
    console.log(`[WEB] 🌐 Client kết nối: ${socket.id}`);

    socket.emit('mqttStatus', { connected: mqttService.isMqttConnected() });
    
    const latestData = mqttService.getLatestData();
    if (latestData) socket.emit('fireAlarmData', latestData);
    socket.emit('history', sensorHistory);

    socket.on('controlDoor', (action) => {
      console.log(`[WEB] 🚪 Điều khiển cửa: ${action}`);
      mqttService.publish(CONFIG.TOPICS.CONTROL_DOOR, String(action));
    });

    socket.on('triggerEmergency', () => {
      console.log(`[WEB] 🚨 Kích hoạt khẩn cấp!`);
      mqttService.publish(CONFIG.TOPICS.TRIGGER_EMERGENCY, 'EMERGENCY');
    });

    socket.on('disconnect', () => {
      console.log(`[WEB] 🔌 Client ngắt kết nối: ${socket.id}`);
    });
  });
};

module.exports = { setupSockets };
