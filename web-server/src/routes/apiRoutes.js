const express = require('express');
const router  = express.Router();
const CONFIG  = require('../config/config');

const setupRoutes = (mqttService, sensorHistory) => {

  // GET /api/status — tổng quan server
  router.get('/status', (req, res) => {
    res.json({
      mqtt_connected:  mqttService.isMqttConnected(),
      total_readings:  sensorHistory.length,
      uptime:          process.uptime(),
      devices:         CONFIG.DEVICES.map(d => ({
        id:     d.id,
        name:   d.name,
        online: mqttService.isDeviceOnline(d.id),
      })),
    });
  });

  // GET /api/devices — danh sách thiết bị + trạng thái + dữ liệu mới nhất
  router.get('/devices', (req, res) => {
    const result = CONFIG.DEVICES.map(d => ({
      id:     d.id,
      name:   d.name,
      online: mqttService.isDeviceOnline(d.id),
      latest: mqttService.getLatestData(d.id) || null,
    }));
    res.json(result);
  });

  // GET /api/devices/:id/latest — dữ liệu mới nhất của kit cụ thể
  router.get('/devices/:id/latest', (req, res) => {
    const device = CONFIG.DEVICES.find(d => d.id === req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(mqttService.getLatestData(device.id) || {});
  });

  // GET /api/history — toàn bộ lịch sử (tất cả kit)
  router.get('/history', (req, res) => {
    res.json(sensorHistory);
  });

  // GET /api/devices/:id/history — lịch sử của kit cụ thể
  router.get('/devices/:id/history', (req, res) => {
    const deviceId = req.params.id;
    if (!CONFIG.DEVICES.find(d => d.id === deviceId)) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(sensorHistory.filter(r => r.deviceId === deviceId));
  });

  return router;
};

module.exports = { setupRoutes };
