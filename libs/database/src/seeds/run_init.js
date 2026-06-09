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

    const sqlPath = path.join(__dirname, '../migrations/001_init_schema.sql');
    console.log(`Leyendo inicializador de esquema en: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando inicialización de esquema...');
    await client.query(sql);
    console.log('¡Base de datos inicializada exitosamente!');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  } finally {
    await client.end();
  }
}

runInit();
