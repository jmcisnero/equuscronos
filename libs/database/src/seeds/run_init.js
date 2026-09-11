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

// Cargar .env de apps/api
try {
  const envPath = path.join(__dirname, '../../../../apps/api/.env');
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
  console.log('No se pudo cargar el archivo .env:', err.message);
}

async function runInit() {
  // CRITICAL SECURITY CHECKS
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL SECURITY ALERT: Destructive database reset is BLOCKED in PRODUCTION environment!');
    process.exit(1);
  }
  if (process.env.CONFIRM_DESTRUCTIVE_RESET !== 'yes') {
    console.error('⚠️ SAFETY BLOCK: Destructive operation requires CONFIRM_DESTRUCTIVE_RESET=yes environment variable.');
    console.error('Usage: CONFIRM_DESTRUCTIVE_RESET=yes node libs/database/src/seeds/run_init.js');
    process.exit(1);
  }

  const client = new Client(dbConfig);
  try {
    console.log(`Conectando a la base de datos ${dbConfig.database}...`);
    await client.connect();
    
    // Opcional: Limpiar esquema para poder re-ejecutar limpio
    console.log('Limpiando tablas, tipos y políticas existentes...');
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sqlPath = path.join(migrationsDir, file);
      console.log(`Ejecutando migración: ${file}`);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
    }
    console.log('¡Base de datos inicializada exitosamente!');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  } finally {
    await client.end();
  }
}

runInit();
