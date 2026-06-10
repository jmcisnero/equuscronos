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

async function resetAndSeed() {
  console.log(`Connecting to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}...`);
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected successfully!');

    console.log('Dropping and recreating public schema...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('Schema reset complete.');

    const schemaPath = path.join(__dirname, '../libs/database/src/migrations/001_init_schema.sql');
    console.log(`Reading migration schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running migration schema...');
    await client.query(schemaSql);
    console.log('Migration schema executed successfully!');

    const seedPath = path.join(__dirname, '../libs/database/src/seeds/01_initial_seed.sql');
    console.log(`Reading seed data from: ${seedPath}`);
    let seedSql = fs.readFileSync(seedPath, 'utf8');

    // Remove TRUNCATE statements since schema is fresh
    seedSql = seedSql.replace(/TRUNCATE[\s\S]*?CASCADE;/i, '-- TRUNCATE removed');

    console.log('Inserting seed data...');
    await client.query(seedSql);
    console.log('Seed data inserted successfully!');

    console.log('Database reset and seed completed successfully!');
  } catch (error) {
    console.error('Error during database reset/seed:', error);
  } finally {
    await client.end();
  }
}

resetAndSeed();
