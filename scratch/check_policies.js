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
  console.log('Error loading .env:', err.message);
}

async function queryData() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const res = await client.query("SELECT * FROM pg_policies;");
    console.table(res.rows.map(r => ({ tablename: r.tablename, policyname: r.policyname, cmd: r.cmd, qual: r.qual })));
  } catch (error) {
    console.error('Error during query:', error);
  } finally {
    await client.end();
  }
}

queryData();
