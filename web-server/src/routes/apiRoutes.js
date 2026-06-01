const express = require('express');
const router = express.Router();

const setupRoutes = (mqttService, sensorHistory) => {
  router.get('/latest', (req, res) => {
    res.json(mqttService.getLatestData() || {});
  });

  router.get('/history', (req, res) => {
    res.json(sensorHistory);
  });

  router.get('/status', (req, res) => {
    res.json({
      mqtt_connected: mqttService.isMqttConnected(),
      total_readings: sensorHistory.length,
      uptime: process.uptime(),
    });
  });

  return router;
};

module.exports = { setupRoutes };
