
const mysql = require('mysql2/promise');

// Connection Pool Configuration
const pool = mysql.createPool({
  host: '34.93.93.125',
  port: 3306,
  user: 'root',
  password: 'k6A*tSYI3xQkIdQp',
  database: 'app-instuto-com', 
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  multipleStatements: true,
  connectTimeout: 20000 // 20 seconds timeout
});

// Immediate Ping to verify connection
pool.query('SELECT 1')
    .then(() => {
        console.log("SUCCESS: Connected to MySQL Database at 34.93.93.125 (app-instuto-com)");
    })
    .catch(err => {
        console.error("CRITICAL: Database connection failed on startup:", err.message);
    });

module.exports = pool;
