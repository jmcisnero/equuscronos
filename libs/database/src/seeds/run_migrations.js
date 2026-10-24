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

    // Asegurar tabla de control de migraciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Marcar 001, 002, 003 si las tablas base ya existen
    const tableRes = await client.query(`SELECT to_regclass('public.users') as exists;`);
    if (tableRes.rows[0].exists) {
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ('001_init_schema.sql'), ('002_add_disqualification_columns.sql'), ('003_production_least_privilege_setup.sql') ON CONFLICT DO NOTHING;`);
    }

    const res = await client.query(`SELECT filename FROM schema_migrations;`);
    const appliedFiles = new Set(res.rows.map(r => r.filename));

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`⏭️  Skipping already applied migration: ${file}`);
        continue;
      }
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1);`, [file]);
      console.log(`✅ Applied: ${file}`);
    }

    console.log('\nAll pending migrations executed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
