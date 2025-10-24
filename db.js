
/*
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '12345',
  database: 'esportdle'
});

db.connect(err => {
  if (err) {
    console.error('Error de conexión: ', err.stack);
    return;
  }
  console.log('Conectado como id ' + db.threadId);
});

module.exports = db;




// routes/db.js
const mysql = require("mysql2/promise");

// Lee el CA desde una env en BASE64 (ideal para Render)
function buildSSL() {
  if (String(process.env.DB_SSL || "").toLowerCase() !== "true") return undefined;

  const b64 = process.env.DB_SSL_CA_BASE64 || "";
  if (!b64) return { rejectUnauthorized: true, minVersion: "TLSv1.2" };

  const ca = Buffer.from(b64, "base64").toString("utf8");
  return { ca, minVersion: "TLSv1.2" };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  ssl: buildSSL(),       // ← importante para Aiven
  timezone: "Z",
});

async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, q };

*/



// routes/db.js  (o ./db.js si lo importas así en el proyecto)
const mysql = require("mysql2/promise");

// --- SSL helper (Aiven) ---
function buildSSL() {
  if (String(process.env.DB_SSL || "").toLowerCase() !== "true") return undefined;
  const b64 = process.env.DB_SSL_CA_BASE64 || "";
  if (!b64) return { rejectUnauthorized: true, minVersion: "TLSv1.2" };
  const ca = Buffer.from(b64, "base64").toString("utf8");
  return { ca, minVersion: "TLSv1.2" };
}

// --- Pool de conexiones ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "12345",
  database: process.env.DB_NAME || "esportdle",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  ssl: buildSSL(),
  timezone: "Z",
});

// --- API promisificada: q(sql, params) -> rows ---
async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// --- Capa de compatibilidad con callback: db.query(sql, params, cb) ---
function query(sql, params, cb) {
  // params opcional
  if (typeof params === "function") {
    cb = params; params = [];
  }
  pool.execute(sql, params || [])
    .then(([rows]) => cb && cb(null, rows))
    .catch((err) => cb && cb(err));
}

// --- Cierre amable (por si un script lo requiere) ---
function end() {
  return pool.end();
}

module.exports = { pool, q, query, end };
