const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

const TARGET_COMPETITION_ID = '9c9f5da0-8f52-4441-833f-9aa9e8664e7b';

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

// Helper to run query on prod via SSH and return parsed JSON
function fetchProdData(query) {
  const tempFile = path.join(__dirname, `temp_query_${Date.now()}.sql`);
  const jsonQuery = `SELECT coalesce(json_agg(t), '[]'::json) FROM (${query}) t;`;
  fs.writeFileSync(tempFile, jsonQuery, 'utf8');

  try {
    const cmd = `ssh -i "C:\\Users\\hp\\.ssh\\.ssh\\equuscronos\\id_ed25519_equus" ubuntu@51.79.91.102 "docker exec -i equuscronos-db psql -U postgres -d equuscronos -A -t -q" < "${tempFile}"`;
    const result = execSync(cmd, { maxBuffer: 1024 * 1024 * 100 }).toString().trim();
    return JSON.parse(result);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

async function insertRows(client, tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`- Table [${tableName}]: 0 rows to insert`);
    return 0;
  }

  // Get all columns from the first row keys
  const columns = Object.keys(rows[0]);
  const columnsStr = columns.map(c => `"${c}"`).join(', ');

  for (const row of rows) {
    const values = columns.map(c => {
      const val = row[c];
      // Convert objects/arrays to JSON strings for Postgres representation
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });
    
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // We update all columns except 'id' on conflict
    const updateCols = columns.filter(c => c !== 'id');
    const updateStr = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

    let query = `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${placeholders})`;
    if (updateStr) {
      query += ` ON CONFLICT (id) DO UPDATE SET ${updateStr}`;
    } else {
      query += ` ON CONFLICT (id) DO NOTHING`;
    }

    await client.query(query, values);
  }
  console.log(`- Table [${tableName}]: Successfully imported/updated ${rows.length} rows`);
  return rows.length;
}

async function runMigration() {
  console.log('=== Starting Selective Data Hot Migration (Prod -> Local Dev) ===');
  console.log(`Target Competition ID: ${TARGET_COMPETITION_ID}`);

  const client = new Client(dbConfig);
  await client.connect();
  console.log('Connected to local database successfully.');

  try {
    // Disable RLS temporarily for the superuser script if needed, though with DB_USER=postgres it is bypassed anyway.
    // However, to be absolutely safe and keep schema clean, we just run the queries normally.

    // 1. Fetch data from production
    console.log('\nFetching data from production...');

    console.log('Fetching master catalogs...');
    
    // Tenants
    const tenantsQuery = `
      SELECT * FROM tenants 
      WHERE id IN (SELECT tenant_id FROM competitions WHERE id = '${TARGET_COMPETITION_ID}')
         OR id IN (SELECT tenant_id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
         OR id IN (SELECT represented_tenant_id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}' AND represented_tenant_id IS NOT NULL)
    `;
    const tenants = fetchProdData(tenantsQuery);
    console.log(`- Fetched ${tenants.length} tenants`);

    // Users
    const usersQuery = `
      SELECT * FROM users 
      WHERE tenant_id IN (
        SELECT tenant_id FROM competitions WHERE id = '${TARGET_COMPETITION_ID}'
      )
    `;
    const users = fetchProdData(usersQuery);
    console.log(`- Fetched ${users.length} users`);

    // Competition Types
    const compTypesQuery = `
      SELECT * FROM competition_types 
      WHERE id IN (SELECT competition_type_id FROM competitions WHERE id = '${TARGET_COMPETITION_ID}')
    `;
    const compTypes = fetchProdData(compTypesQuery);
    console.log(`- Fetched ${compTypes.length} competition types`);

    // Riders
    const ridersQuery = `
      SELECT * FROM riders 
      WHERE id IN (SELECT rider_id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
    `;
    const riders = fetchProdData(ridersQuery);
    console.log(`- Fetched ${riders.length} riders`);

    // Horses
    const horsesQuery = `
      SELECT * FROM horses 
      WHERE id IN (SELECT horse_id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
    `;
    const horses = fetchProdData(horsesQuery);
    console.log(`- Fetched ${horses.length} horses`);

    // Owners
    const ownersQuery = `
      SELECT * FROM owners 
      WHERE id IN (
        SELECT owner_id FROM horses 
        WHERE id IN (SELECT horse_id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
          AND owner_id IS NOT NULL
      )
    `;
    const owners = fetchProdData(ownersQuery);
    console.log(`- Fetched ${owners.length} owners`);

    console.log('Fetching competition structure and transactions...');

    // Competitions
    const competitionsQuery = `
      SELECT * FROM competitions WHERE id = '${TARGET_COMPETITION_ID}'
    `;
    const competitions = fetchProdData(competitionsQuery);
    console.log(`- Fetched ${competitions.length} competitions`);

    // Stages
    const stagesQuery = `
      SELECT * FROM stages WHERE competition_id = '${TARGET_COMPETITION_ID}'
    `;
    const stages = fetchProdData(stagesQuery);
    console.log(`- Fetched ${stages.length} stages`);

    // Competition Entries
    const entriesQuery = `
      SELECT * FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}'
    `;
    const entries = fetchProdData(entriesQuery);
    console.log(`- Fetched ${entries.length} competition entries`);

    // Timing Records
    const timingRecordsQuery = `
      SELECT * FROM timing_records 
      WHERE entry_id IN (SELECT id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
    `;
    const timingRecords = fetchProdData(timingRecordsQuery);
    console.log(`- Fetched ${timingRecords.length} timing records`);

    // Vet Inspections
    const vetInspectionsQuery = `
      SELECT * FROM vet_inspections WHERE competence_id = '${TARGET_COMPETITION_ID}'
    `;
    const vetInspections = fetchProdData(vetInspectionsQuery);
    console.log(`- Fetched ${vetInspections.length} vet inspections`);

    // Weight Controls
    const weightControlsQuery = `
      SELECT * FROM weight_controls 
      WHERE entry_id IN (SELECT id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
    `;
    const weightControls = fetchProdData(weightControlsQuery);
    console.log(`- Fetched ${weightControls.length} weight controls`);

    // Penalties
    const penaltiesQuery = `
      SELECT * FROM penalties 
      WHERE entry_id IN (SELECT id FROM competition_entries WHERE competition_id = '${TARGET_COMPETITION_ID}')
    `;
    const penalties = fetchProdData(penaltiesQuery);
    console.log(`- Fetched ${penalties.length} penalties`);

    // 2. Insert data locally in proper dependency order
    console.log('\nInserting records into local database...');
    
    await insertRows(client, 'tenants', tenants);
    await insertRows(client, 'users', users);
    await insertRows(client, 'owners', owners);
    await insertRows(client, 'riders', riders);
    await insertRows(client, 'horses', horses);
    await insertRows(client, 'competition_types', compTypes);
    await insertRows(client, 'competitions', competitions);
    await insertRows(client, 'stages', stages);
    await insertRows(client, 'competition_entries', entries);
    await insertRows(client, 'timing_records', timingRecords);
    await insertRows(client, 'vet_inspections', vetInspections);
    await insertRows(client, 'weight_controls', weightControls);
    await insertRows(client, 'penalties', penalties);

    console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
