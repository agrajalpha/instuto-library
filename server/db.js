
const mysql = require('mysql2/promise');

// Connection Pool Configuration
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'instutouser',
  password: 'P@ssw0rd$123D',
  database: 'app_instuto_com', 
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  multipleStatements: true,
  connectTimeout: 20000 // 20 seconds timeout
});

// Immediate Ping to verify connection
pool.query('SELECT 1')
    .then(() => {
        console.log("SUCCESS: Connected to MySQL Database at localhost (app_instuto_com)");
    })
    .catch(err => {
        console.error("CRITICAL: Database connection failed on startup:", err.message);
    });

module.exports = pool;