
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'instutouser',
  password: 'P@ssw0rd$123D',
  database: 'app_instuto_com',
  connectTimeout: 10000
};

async function testConnection() {
  console.log('----------------------------------------');
  console.log(`Testing connection to ${dbConfig.host}...`);
  console.log('----------------------------------------');

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connection Successful!');
    
    const [rows] = await connection.query('SELECT DATABASE() as db');
    console.log(`Connected to database: ${rows[0].db}`);
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection Failed:');
    console.error(`Error Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
    process.exit(1);
  }
}

testConnection();