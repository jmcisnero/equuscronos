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

async function rebuild() {
  // CRITICAL SECURITY CHECKS
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL SECURITY ALERT: Destructive database reset is BLOCKED in PRODUCTION environment!');
    process.exit(1);
  }
  if (process.env.CONFIRM_DESTRUCTIVE_RESET !== 'yes') {
    console.error('⚠️ SAFETY BLOCK: Destructive operation requires CONFIRM_DESTRUCTIVE_RESET=yes environment variable.');
    console.error('Usage: CONFIRM_DESTRUCTIVE_RESET=yes node libs/database/src/seeds/rebuild_db.js');
    process.exit(1);
  }

  const client = new Client(dbConfig);
  try {
    console.log(`Connecting to ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}...`);
    await client.connect();
    console.log('Connected successfully!');

    // 1. Drop and Recreate Schema
    console.log('Executing DROP SCHEMA public CASCADE; CREATE SCHEMA public;...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Schema dropped and recreated successfully!');

    // 2. Load Migrations
    console.log('Executing migrations...');
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`Executing migration: ${file}`);
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(migrationSql);
    }
    console.log('Migrations executed successfully!');

    // 3. Load Seed
    const seedPath = path.join(__dirname, '01_initial_seed.sql');
    console.log(`Reading seed script from: ${seedPath}`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('Executing seeds...');
    await client.query(seedSql);
    console.log('Seeds executed successfully!');

  } catch (error) {
    console.error('Rebuild failed with error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

rebuild();
