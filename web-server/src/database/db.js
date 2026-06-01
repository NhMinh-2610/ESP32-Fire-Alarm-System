const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');

let db = null;

// Lưu CSDL xuống ổ đĩa
function saveToDisk() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

// Khởi tạo CSDL
async function initDB() {
  const SQL = await initSqlJs();

  try {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
      console.log('[DB] ✅ Đã tải CSDL từ file!');
    } else {
      db = new SQL.Database();
      console.log('[DB] ✅ Tạo CSDL mới!');
    }
  } catch (err) {
    db = new SQL.Database();
    console.log('[DB] ⚠️ Tạo CSDL mới (không đọc được file cũ)');
  }

  // Tạo bảng nếu chưa có
  db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL,
    humidity REAL,
    smoke REAL,
    flame INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  saveToDisk();

  return db;
}

// Chèn dữ liệu
function run(sql, params = []) {
  if (!db) return;
  db.run(sql, params);
  saveToDisk();
}

// Truy vấn danh sách
function all(sql, params = []) {
  if (!db) return [];
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

module.exports = { initDB, run, all };
