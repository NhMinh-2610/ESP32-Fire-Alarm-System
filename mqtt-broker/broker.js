require('dotenv').config();
const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const chalk = require('chalk'); // Terminal colors

const PORT = process.env.PORT || 1883;
const BROKER_USERNAME = process.env.BROKER_USERNAME || 'admin';
const BROKER_PASSWORD = process.env.BROKER_PASSWORD || '1234';

// ============================================================
//  AUTHENTICATION (Bảo mật)
// ============================================================
aedes.authenticate = (client, username, password, callback) => {
  const isWebClient = client.id && client.id.startsWith('NodeServer_');
  const suppliedPass = password ? password.toString() : '';

  if (username === BROKER_USERNAME && suppliedPass === BROKER_PASSWORD) {
    console.log(chalk.green(`[AUTH] ✅ Client được cấp quyền truy cập: ${client.id}`));
    callback(null, true);
  } else {
    console.log(chalk.red(`[AUTH] ❌ Từ chối truy cập: ${client.id} (Sai User/Pass)`));
    callback(null, false);
  }
};

// ============================================================
//  EVENTS
// ============================================================

// Khi có client kết nối thành công
aedes.on('client', (client) => {
  console.log(chalk.cyan(`[CLIENT_CONNECTED] 🔗 Client ID: ${client.id}`));
});

// Khi có client ngắt kết nối
aedes.on('clientDisconnect', (client) => {
  console.log(chalk.yellow(`[CLIENT_DISCONNECTED] 🔌 Client ID: ${client.id}`));
});

// Bắt log publish (Bỏ comment nếu muốn thấy mọi message bay qua Broker)
/*
aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[PUBLISH] ${client.id} → Topic: ${packet.topic}`);
  }
});
*/

// ============================================================
//  START SERVER
// ============================================================
server.listen(PORT, function () {
  console.log(chalk.magenta('========================================'));
  console.log(chalk.bold.green(`🚀 MQTT Broker đang chạy tại cổng ${PORT}`));
  console.log(chalk.magenta('========================================'));
  console.log(chalk.dim(`User mặc định: ${BROKER_USERNAME}`));
  console.log(chalk.dim(`Pass mặc định: ${BROKER_PASSWORD}`));
});

// Bắt lỗi toàn cục để tránh sập server
aedes.on('clientError', (client, err) => {
  console.log(chalk.red(`[ERROR] Lỗi từ client ${client.id}: ${err.message}`));
});

server.on('error', (err) => {
  console.log(chalk.red(`[SERVER_ERROR] Lỗi Broker: ${err.message}`));
});
