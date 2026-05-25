const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Configuración de conexión por defecto
const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

// Cargar .env de apps/api si existe
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
        if (key === 'DB_USER') dbConfig.user = value;
        if (key === 'DB_PASSWORD') dbConfig.password = value;
        if (key === 'DB_NAME') dbConfig.database = value;
      }
    });
  }
} catch (err) {
  console.log('No se pudo cargar el archivo .env, usando valores por defecto:', err.message);
}

async function runSeed() {
  const client = new Client(dbConfig);
  try {
    console.log(`Conectando a la base de datos ${dbConfig.database} en ${dbConfig.host}:${dbConfig.port}...`);
    await client.connect();
    console.log('¡Conexión exitosa!');

    const sqlPath = path.join(__dirname, '01_initial_seed.sql');
    console.log(`Leyendo archivo de seed en: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando sentencias SQL...');
    await client.query(sql);
    console.log('¡Datos de prueba (seed) cargados exitosamente!');
  } catch (error) {
    console.error('Error al ejecutar el seed:', error);
  } finally {
    await client.end();
  }
}

runSeed();
