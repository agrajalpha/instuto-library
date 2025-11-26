
const mysql = require('mysql2/promise');

const dbConfig = {
  host: '34.93.93.125',
  port: 3306,
  user: 'root',
  password: 'k6A*tSYI3xQkIdQp',
  database: 'app-instuto-com',
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
