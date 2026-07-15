const fs = require('fs');
const path = require('path');
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
  console.log('Error loading .env:', err.message);
}

async function verify() {
  console.log('=== Running Post-Migration Consistency Verification ===\n');
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Table Counts for Target Competition
    console.log('1. Verifying Table Counts for Target Competition:');
    const counts = {};
    
    counts.competitions = (await client.query(`SELECT COUNT(*) FROM competitions WHERE id = $1`, [TARGET_COMPETITION_ID])).rows[0].count;
    counts.stages = (await client.query(`SELECT COUNT(*) FROM stages WHERE competition_id = $1`, [TARGET_COMPETITION_ID])).rows[0].count;
    counts.entries = (await client.query(`SELECT COUNT(*) FROM competition_entries WHERE competition_id = $1`, [TARGET_COMPETITION_ID])).rows[0].count;
    counts.timing = (await client.query(`SELECT COUNT(*) FROM timing_records WHERE entry_id IN (SELECT id FROM competition_entries WHERE competition_id = $1)`, [TARGET_COMPETITION_ID])).rows[0].count;
    counts.vet = (await client.query(`SELECT COUNT(*) FROM vet_inspections WHERE competence_id = $1`, [TARGET_COMPETITION_ID])).rows[0].count;
    counts.weight = (await client.query(`SELECT COUNT(*) FROM weight_controls WHERE entry_id IN (SELECT id FROM competition_entries WHERE competition_id = $1)`, [TARGET_COMPETITION_ID])).rows[0].count;
    counts.penalties = (await client.query(`SELECT COUNT(*) FROM penalties WHERE entry_id IN (SELECT id FROM competition_entries WHERE competition_id = $1)`, [TARGET_COMPETITION_ID])).rows[0].count;

    console.table(counts);

    // 2. Relational Integrity: Competitions -> Stages -> Entries
    console.log('\n2. Checking Competitions -> Stages -> Entries hierarchy:');
    const hierarchyQuery = `
      SELECT 
        c.name AS competition_name,
        s.stage_number,
        COUNT(ce.id) AS registered_entries_count
      FROM competitions c
      JOIN stages s ON s.competition_id = c.id
      LEFT JOIN competition_entries ce ON ce.competition_id = c.id
      WHERE c.id = $1
      GROUP BY c.name, s.stage_number
      ORDER BY s.stage_number;
    `;
    const hierarchyRes = await client.query(hierarchyQuery, [TARGET_COMPETITION_ID]);
    console.table(hierarchyRes.rows);

    // 3. Relational Integrity: Vet Inspections -> Timing Records (VET_IN)
    console.log('\n3. Checking Vet Inspections -> Timing Records (VET_IN) mapping:');
    const mappingQuery = `
      SELECT 
        vi.rider_dorsal,
        vi.vet_gate_number,
        vi.vet_in_time,
        tr.id AS timing_record_id,
        tr.recorded_at AS timing_record_time,
        CASE WHEN tr.id IS NOT NULL THEN 'MATCHED' ELSE 'MISSING' END AS status
      FROM vet_inspections vi
      JOIN competition_entries ce ON ce.competition_id = vi.competence_id AND ce.bib_number::text = vi.rider_dorsal
      JOIN stages s ON s.competition_id = vi.competence_id AND s.stage_number = vi.vet_gate_number
      LEFT JOIN timing_records tr ON tr.entry_id = ce.id AND tr.stage_id = s.id AND tr.record_type = 'VET_IN' AND tr.recorded_at = vi.vet_in_time
      WHERE vi.competence_id = $1
      ORDER BY vi.vet_gate_number, vi.rider_dorsal;
    `;
    const mappingRes = await client.query(mappingQuery, [TARGET_COMPETITION_ID]);
    console.table(mappingRes.rows);

    const missingMatches = mappingRes.rows.filter(r => r.status === 'MISSING');
    if (missingMatches.length === 0) {
      console.log('✅ Success: All vet inspections are correctly linked to their VET_IN timing records!');
    } else {
      console.log(`❌ Warning: Found ${missingMatches.length} vet inspections without matching VET_IN timing records.`);
    }

    // 4. Checking overall integrity status for Entries
    console.log('\n4. Checking participant status distribution:');
    const statusQuery = `
      SELECT status, COUNT(*) AS count 
      FROM competition_entries 
      WHERE competition_id = $1 
      GROUP BY status;
    `;
    const statusRes = await client.query(statusQuery, [TARGET_COMPETITION_ID]);
    console.table(statusRes.rows);

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await client.end();
  }
}

verify();
