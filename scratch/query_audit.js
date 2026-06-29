const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

// Load env variables from apps/api/.env
try {
  const envPath = path.join(__dirname, '../apps/api/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (key === 'DB_HOST') dbConfig.host = value;
        if (key === 'DB_PORT') dbConfig.port = parseInt(value, 10);
        if (key === 'DB_NAME') dbConfig.database = value;
      }
    });
  }
} catch (err) {
  console.log('Could not load .env file, using defaults:', err.message);
}

async function queryData() {
  console.log(`Connecting to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}...`);
  const client = new Client(dbConfig);
  try {
    await client.connect();
    
    console.log('\n--- AUDIT LOGS (recent 20) ---');
    const logs = await client.query("SELECT id, action, entity_name, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20;");
    console.table(logs.rows);

  } catch (error) {
    console.error('Error during query:', error);
  } finally {
    await client.end();
  }
}

queryData();
