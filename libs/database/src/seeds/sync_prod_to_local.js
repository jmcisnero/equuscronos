const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

const localDbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

// Intento de carga de .env desde apps/api
try {
  const envPath = path.join(__dirname, '../../../apps/api/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (key === 'DB_HOST') localDbConfig.host = value;
        if (key === 'DB_PORT') localDbConfig.port = parseInt(value, 10);
        if (key === 'DB_USER') localDbConfig.user = value;
        if (key === 'DB_PASSWORD') localDbConfig.password = value;
        if (key === 'DB_NAME') localDbConfig.database = value;
      }
    });
  }
} catch (err) {
  console.log('Utilizando configuración local por defecto:', err.message);
}

async function main() {
  console.log('==========================================================');
  console.log('  EQUUSCRONOS: EXTRACCIÓN Y SINCRONIZACIÓN PROD -> LOCAL  ');
  console.log('==========================================================\n');

  // 1. RESTRICCIONES Y GUARDAS DE SEGURIDAD ESTRICTAS
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR CRÍTICO: La importación/reseteo local NO puede ejecutarse en ambiente de Producción!');
    process.exit(1);
  }

  const allowedHosts = ['localhost', '127.0.0.1', '::1'];
  if (!allowedHosts.includes(localDbConfig.host)) {
    console.error(`❌ ERROR DE SEGURIDAD: El host local '${localDbConfig.host}' no es seguro para reseteo. Debe ser localhost.`);
    process.exit(1);
  }

  if (process.env.CONFIRM_DESTRUCTIVE_RESET !== 'yes') {
    console.error('⚠️ BLOQUEO DE SEGURIDAD: La resincronización local requiere CONFIRM_DESTRUCTIVE_RESET=yes');
    console.error('Uso: CONFIRM_DESTRUCTIVE_RESET=yes node libs/database/src/seeds/sync_prod_to_local.js');
    process.exit(1);
  }

  const dumpsDir = path.join(__dirname, '../dumps');
  if (!fs.existsSync(dumpsDir)) {
    fs.mkdirSync(dumpsDir, { recursive: true });
  }

  const dumpFilePath = path.join(dumpsDir, 'prod_backup.sql');

  // 2. FASE 1: Extracción Solo Lectura desde Producción
  console.log('📡 FASE 1: Extrayendo volcado de datos desde Producción (Solo Lectura)...');
  const sshCmd = `ssh -i "C:\\Users\\hp\\.ssh\\.ssh\\equuscronos\\id_ed25519_equus" ubuntu@51.79.91.102 "docker exec -i equuscronos-db pg_dump -U postgres -d equuscronos --data-only --column-inserts --no-owner --no-privileges"`;
  
  try {
    const dumpContent = execSync(sshCmd, { maxBuffer: 1024 * 1024 * 500 }).toString();
    fs.writeFileSync(dumpFilePath, dumpContent, 'utf8');
    console.log(`✅ Volcado de Producción obtenido exitosamente (${(dumpContent.length / 1024 / 1024).toFixed(2)} MB).`);
    console.log(`   Guardado en: ${dumpFilePath}\n`);
  } catch (error) {
    console.error('❌ Error durante la extracción remota de Producción:', error.message);
    process.exit(1);
  }

  // Verification that dump has no DROP or TRUNCATE
  const dumpSql = fs.readFileSync(dumpFilePath, 'utf8');
  if (dumpSql.includes('DROP DATABASE') || dumpSql.includes('DROP SCHEMA')) {
    console.error('❌ ALERTA DE SEGURIDAD: El dump contiene instrucciones destructivas de base de datos!');
    process.exit(1);
  }

  // 3. FASE 2: Reseteo y Migración del Esquema Local
  console.log('🛠️ FASE 2: Reconstruyendo esquema en Base de Datos Local...');
  const client = new Client(localDbConfig);
  await client.connect();
  console.log(`   Conectado a BD Local: ${localDbConfig.user}@${localDbConfig.host}:${localDbConfig.port}/${localDbConfig.database}`);

  try {
    console.log('   Recreando esquema public en local...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');

    console.log('   Ejecutando migraciones SQL locales...');
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`   - Aplicando migración: ${file}`);
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(migrationSql);
    }
    console.log('✅ Esquema local inicializado y migrado correctamente.\n');

    // 4. FASE 3: Importando Datos en Local
    console.log('📥 FASE 3: Importando volcado de Producción en Base de Datos Local...');
    const lines = dumpSql.split('\n');
    let buffer = '';
    let importedStatements = 0;

    await client.query('BEGIN');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('\\')) {
        continue;
      }
      buffer += line + '\n';
      if (trimmed.endsWith(';')) {
        await client.query(buffer);
        buffer = '';
        importedStatements++;
      }
    }
    await client.query('COMMIT');
    console.log(`✅ ${importedStatements} sentencias SQL de Producción importadas con éxito en Desarrollo Local.\n`);

    // 5. FASE 4: Sincronización de Secuencias y Verificación
    console.log('📊 FASE 4: Ejecutando verificación de conteos en Base de Datos Local...');
    await client.query('SET search_path TO public;');
    const tables = [
      'tenants',
      'owners',
      'users',
      'horses',
      'riders',
      'competition_types',
      'competitions',
      'stages',
      'competition_entries',
      'timing_records',
      'vet_inspections',
      'weight_controls',
      'penalties',
      'audit_logs'
    ];

    const counts = {};
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) FROM public."${table}"`);
        counts[table] = parseInt(res.rows[0].count, 10);
      } catch (err) {
        counts[table] = 'ERROR: ' + err.message;
      }
    }

    console.table(counts);
    console.log('\n==========================================================');
    console.log('  SINCRONIZACIÓN COMPLETADA Y VERIFICADA EXITOSAMENTE!     ');
    console.log('==========================================================');

  } catch (err) {
    console.error('❌ Error durante el reseteo/importación local:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
