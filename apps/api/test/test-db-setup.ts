// 1. Forzar entorno de test
process.env.NODE_ENV = 'test';

// 2. Definir base de datos de pruebas aislada
const primaryDbName = process.env.PRIMARY_DB_NAME || 'equuscronos';
const testDbName = process.env.DB_NAME_TEST || 'equuscronos_test';

// Si DB_NAME no está explícitamente configurada a test, forzar equuscronos_test
if (!process.env.DB_NAME || process.env.DB_NAME === primaryDbName) {
  process.env.DB_NAME = testDbName;
}

// 3. Guarda de seguridad: Abortar si la base de datos es la primaria de desarrollo u operacional
if (process.env.DB_NAME === primaryDbName) {
  console.error(`❌ CRITICAL SECURITY ERROR: E2E Tests attempted to target primary database '${primaryDbName}'!`);
  console.error(`E2E tests must target isolated test database '${testDbName}'. Aborting test execution.`);
  process.exit(1);
}

/**
 * Asegura que la base de datos de test ('equuscronos_test') exista.
 * Si no existe, la crea dinámicamente conectándose a postgres.
 */
export async function ensureTestDatabaseExists(): Promise<void> {
  const { Client } = require('pg');
  const adminClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'equus_secure_pass_2026',
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [testDbName],
    );
    if (res.rowCount === 0) {
      console.log(`[Test Setup] Creating isolated test database '${testDbName}'...`);
      await adminClient.query(`CREATE DATABASE "${testDbName}";`);
    }
  } catch (err) {
    console.warn(`[Test Setup] Warning verifying test database '${testDbName}':`, (err as Error).message);
  } finally {
    await adminClient.end();
  }
}
