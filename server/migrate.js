const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: '34.93.93.125',
  port: 3306,
  user: 'root',
  password: 'k6A*tSYI3xQkIdQp',
  database: 'app-instuto-com',
  multipleStatements: true,
  connectTimeout: 30000 // Increased timeout
};

async function migrate() {
  let connection;
  try {
    console.log(`Connecting to ${dbConfig.host} / ${dbConfig.database}...`);
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected.');

    console.log('Reading migration script...');
    // Updated to read .txt file
    const migrationPath = path.join(__dirname, '../database/migrations.txt');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing Schema & Seed Data...');
    // Execute the SQL file content
    await connection.query(sql);
    console.log('✅ SQL executed successfully.');

    // Verification step
    console.log('Verifying created tables...');
    const [rows] = await connection.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    
    if (tables.length === 0) {
        console.error('⚠️ WARNING: Migration ran but NO tables were found.');
    } else {
        console.log('✅ Found tables:', tables.join(', '));
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();