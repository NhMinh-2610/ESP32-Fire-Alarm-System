const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');

let db = null;

// Khởi tạo CSDL
async function initDB() {
  // Mở (hoặc tự tạo) file database.sqlite
  db = new Database(dbPath);
  console.log('[DB] ✅ CSDL SQLite chuẩn (better-sqlite3) đã sẵn sàng!');

  // Tạo bảng nếu chưa có
  // Thêm cột deviceId và smoke_delta so với bản cũ
  db.exec(`CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT,
    temperature REAL,
    humidity REAL,
    smoke REAL,
    smoke_delta REAL,
    flame INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  return db;
}

// Chèn hoặc cập nhật dữ liệu
function run(sql, params = []) {
  if (!db) return;
  const stmt = db.prepare(sql);
  // Thực thi truy vấn với tham số
  stmt.run(...params);
}

// Truy vấn danh sách
function all(sql, params = []) {
  if (!db) return [];
  const stmt = db.prepare(sql);
  // Trả về mảng JSON kết quả
  return stmt.all(...params);
}

module.exports = { initDB, run, all };
