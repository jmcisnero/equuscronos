const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'equus_secure_pass_2026',
    database: 'equuscronos',
  });

  try {
    await client.connect();
    console.log('--- CONNECTED TO POSTGRES ---');

    console.log('\n--- COMPETITION ENTRIES ---');
    const entryRes = await client.query('SELECT id, bib_number, status, ballast_weight FROM competition_entries;');
    console.table(entryRes.rows);

    console.log('\n--- RECENT TIMING RECORDS ---');
    const timingRes = await client.query('SELECT id, entry_id, stage_id, record_type, recorded_at, is_approved, is_void FROM timing_records ORDER BY created_at DESC;');
    console.table(timingRes.rows);

    console.log('\n--- RECENT WEIGHT CONTROLS ---');
    const weightRes = await client.query('SELECT id, entry_id, stage_id, weight_recorded, control_type FROM weight_controls ORDER BY id DESC;');
    console.table(weightRes.rows);

  } catch (err) {
    console.error('Error connecting to database:', err);
  } finally {
    await client.end();
  }
}

main();
