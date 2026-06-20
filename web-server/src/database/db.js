const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');
let db = null;

// KHỞI TẠO CƠ SỞ DỮ LIỆU

async function initDB() {
 // Mở kết nối đến file SQLite (Tự động tạo file nếu chưa tồn tại)
 db = new Database(dbPath);
 console.log('[DB] CSDL SQLite chuẩn (better-sqlite3) đã sẵn sàng!');

 // Khởi tạo Schema cho bảng lịch sử cảm biến (sensor_data)
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

// THỰC THI TRUY VẤN (INSERT/UPDATE/DELETE)

function run(sql, params = []) {
 if (!db) return;
 const stmt = db.prepare(sql);
 stmt.run(...params);
}

// TRUY VẤN LẤY DỮ LIỆU (SELECT)

function all(sql, params = []) {
 if (!db) return [];
 const stmt = db.prepare(sql);
 return stmt.all(...params); // Trả về mảng JSON kết quả
}

module.exports = { initDB, run, all };
