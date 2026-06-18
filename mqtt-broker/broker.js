// Load file .env để lấy các biến môi trường (như User, Password, Port)
// Giúp bảo mật thông tin, không bị lộ khi up code lên Github
require('dotenv').config();

// Khởi tạo thư viện 'aedes'. 
// Aedes là lõi của MQTT Broker. Nó giúp chúng ta không phải tự code các quy tắc phức tạp 
// của giao thức MQTT (như gói tin CONNECT, PUBLISH, cờ QoS, v.v.).
const aedes = require('aedes')();

// Tạo một máy chủ TCP (chuẩn mạng) và gắn bộ xử lý (handle) của Aedes vào.
// Khi có thiết bị kết nối vào cổng TCP này, Aedes sẽ đứng ra tiếp đón và xử lý theo chuẩn MQTT.
const server = require('net').createServer(aedes.handle);

// Thư viện 'chalk' dùng để tô màu chữ trên Terminal giúp dễ nhìn hơn
const chalk = require('chalk'); 

// Khai báo cấu hình cổng và tài khoản mặc định (Nếu file .env không có thì dùng giá trị này)
const PORT = process.env.PORT || 1883;
const BROKER_USERNAME = process.env.BROKER_USERNAME || 'admin';
const BROKER_PASSWORD = process.env.BROKER_PASSWORD || '1234';

// ============================================================
//  AUTHENTICATION (Bảo mật - Chốt chặn gác cổng)
// ============================================================
// Hàm này được Aedes tự động gọi mỗi khi có một thiết bị (ESP32 hoặc Web Server) xin kết nối.
aedes.authenticate = (client, username, password, callback) => {
  // Lấy password người dùng gửi lên. (Mặc định nó là dạng Buffer nên phải toString).
  const suppliedPass = password ? password.toString() : '';

  // Kiểm tra: Nếu đúng User và Pass thì cho phép vào
  if (username === BROKER_USERNAME && suppliedPass === BROKER_PASSWORD) {
    console.log(chalk.green(`[AUTH] ✅ Client được cấp quyền truy cập: ${client.id}`));
    // callback(null, true) báo cho Aedes biết là "Hợp lệ, cho phép kết nối"
    callback(null, true);
  } else {
    // Nếu sai User/Pass, từ chối kết nối
    console.log(chalk.red(`[AUTH] ❌ Từ chối truy cập: ${client.id} (Sai User/Pass)`));
    // callback(null, false) báo cho Aedes biết là "Đuổi ra, ngắt kết nối ngay"
    callback(null, false);
  }
};

// ============================================================
//  EVENTS (Giám sát và Logging)
// ============================================================

// Sự kiện: Bắn ra mỗi khi có một Client vượt qua bài kiểm tra User/Pass và kết nối thành công.
aedes.on('client', (client) => {
  console.log(chalk.cyan(`[CLIENT_CONNECTED] 🔗 Client ID: ${client.id}`));
});

// Sự kiện: Bắn ra mỗi khi có một Client chủ động ngắt kết nối hoặc rớt mạng.
aedes.on('clientDisconnect', (client) => {
  console.log(chalk.yellow(`[CLIENT_DISCONNECTED] 🔌 Client ID: ${client.id}`));
});

// Sự kiện (Đang tắt): Bắn ra khi có ai đó gửi một tin nhắn (Publish) lên Broker.
// Hiện tại đang đóng lại (comment) để màn hình log đỡ bị nhiễu do ESP32 gửi dữ liệu liên tục 2s/lần.
/*
aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[PUBLISH] ${client.id} → Topic: ${packet.topic}`);
  }
});
*/

// ============================================================
//  START SERVER (Khởi động hệ thống)
// ============================================================
// Yêu cầu máy chủ TCP mở cửa (listen) ở cổng 1883 để đón thiết bị kết nối.
server.listen(PORT, function () {
  console.log(chalk.magenta('========================================'));
  console.log(chalk.bold.green(`🚀 MQTT Broker đang chạy tại cổng ${PORT}`));
  console.log(chalk.magenta('========================================'));
  console.log(chalk.dim(`User đang dùng: ${BROKER_USERNAME}`));
  console.log(chalk.dim(`Pass đang dùng: ${BROKER_PASSWORD}`));
});

// Bắt lỗi toàn cục của các Client (Vd: Gửi data bị rác, hoặc lỗi mạng bất ngờ).
// Việc bắt lỗi này giúp Server KHÔNG bị crash (sập) khi có thiết bị lỗi.
aedes.on('clientError', (client, err) => {
  console.log(chalk.red(`[ERROR] Lỗi từ client ${client.id}: ${err.message}`));
});

// Bắt lỗi toàn cục của Server (Vd: Lỗi trùng cổng 1883 do đã có ứng dụng khác chiếm dụng).
server.on('error', (err) => {
  console.log(chalk.red(`[SERVER_ERROR] Lỗi Broker: ${err.message}`));
});
