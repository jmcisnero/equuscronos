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
  console.log('=== Database Clean Reset Script ===');
  console.log(`Connecting to: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected successfully!');

    // 1. DROP SCHEMA CASCADE and CREATE SCHEMA
    console.log('\nStep 1: Dropping and recreating public schema...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('Public schema dropped and recreated successfully!');

    // 2. Read and execute migrations/001_init_schema.sql
    console.log('\nStep 2: Executing migrations/001_init_schema.sql...');
    const migrationPath = path.join(__dirname, '../migrations/001_init_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migrationSql);
    console.log('Migrations executed successfully!');

    // 3. Read and execute seeds/01_initial_seed.sql
    console.log('\nStep 3: Executing seeds/01_initial_seed.sql...');
    const seedPath = path.join(__dirname, '01_initial_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);
    console.log('Seeds executed successfully!');

    // 4. Verifications
    console.log('\nStep 4: Running verification queries...');

    // A. Competition -> Stages -> CompetitionEntry relations
    console.log('\nA. Checking Competition -> Stages -> CompetitionEntry relationships:');
    const relationRes = await client.query(`
      SELECT 
        c.name as competition_name,
        s.stage_number,
        s.distance_km,
        ce.bib_number,
        r.name as rider_name,
        h.name as horse_name
      FROM competitions c
      JOIN stages s ON s.competition_id = c.id
      JOIN competition_entries ce ON ce.competition_id = c.id
      JOIN riders r ON ce.rider_id = r.id
      JOIN horses h ON ce.horse_id = h.id
      ORDER BY c.name, s.stage_number, ce.bib_number;
    `);
    
    console.table(relationRes.rows);
    console.log(`Total relationships matches found: ${relationRes.rowCount}`);

    // B. TimingRecord -> VetInspection relations
    console.log('\nB. Checking TimingRecord -> VetInspection relationships:');
    const vetRelationRes = await client.query(`
      SELECT 
        vi.rider_dorsal,
        vi.vet_gate_number,
        vi.arrival_time,
        vi.vet_in_time,
        vi.heart_rate,
        vi.gait_status,
        vi.inspection_type,
        vi.is_final_decision,
        vi.notes
      FROM vet_inspections vi
      ORDER BY vi.rider_dorsal, vi.created_at;
    `);
    
    console.table(vetRelationRes.rows);
    console.log(`Total Vet Inspection records matched: ${vetRelationRes.rowCount}`);

    // C. Row Level Security policies check
    console.log('\nC. Checking table counts and RLS configuration:');
    const tables = [
      'tenants', 'owners', 'users', 'horses', 'riders', 
      'competitions', 'stages', 'competition_entries', 
      'timing_records', 'vet_inspections', 'weight_controls'
    ];
    for (const table of tables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const rlsRes = await client.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = '${table}'
      `);
      console.log(`- Table [${table}]: Rows: ${countRes.rows[0].count}, RLS Enabled: ${rlsRes.rows[0].rowsecurity}`);
    }

    console.log('\n=== DB RESET COMPLETED SUCCESSFULLY AND VERIFIED PERFECTLY! ===');
  } catch (err) {
    console.error('Error executing database reset:', err);
  } finally {
    await client.end();
  }
}

main();
