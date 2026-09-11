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

// Try to load .env from apps/api
try {
  const envPath = path.join(__dirname, '../../../apps/api/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (key === 'DB_HOST') dbConfig.host = value;
        if (key === 'DB_PORT') dbConfig.port = parseInt(value, 10);
        if (key === 'DB_USER') dbConfig.user = value;
        if (key === 'DB_PASSWORD') dbConfig.password = value;
        if (key === 'DB_NAME') dbConfig.database = value;
      }
    });
  }
} catch (err) {
  console.log('Using default DB config because .env could not be loaded:', err.message);
}

async function main() {
  console.log('=== Database Migration Runner ===');
  console.log(`Connecting to: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected successfully!');

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`✅ Applied: ${file}`);
    }

    console.log('\nAll migrations executed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
