const { Client } = require('pg');
const { execSync } = require('child_process');

const ENTRY_ID = 'a3b53510-0bff-439a-8250-36deb3c8432b';
const COMPETITION_ID = '5211fdf9-ee08-46fe-826a-63900cb40834';
const VET_IN_TIMING_ID = 'feac9ce5-8f6b-42e0-a091-08e994dd6e14';
const ADMIN_USER_ID = 'e1000000-0000-0000-0000-000000000003';
const REPAIR_REASON = 'Corrección de falso positivo ELIMINATED_TR en rechequeo aprobado (Art. 21/31 FEU)';

const sqlQueries = `
BEGIN;

-- 1. Rectificar la entrada del competidor #50 a estado IN_RACE
UPDATE competition_entries
SET 
  status = 'IN_RACE',
  disqualification_reason = NULL,
  disqualification_notes = NULL,
  disqualified_at_stage = NULL,
  updated_at = NOW()
WHERE id = '${ENTRY_ID}';

-- 2. Restablecer la aprobación del registro de tiempo VET_IN
UPDATE timing_records
SET 
  is_approved = true,
  elimination_type = NULL,
  elimination_reason = NULL,
  updated_at = NOW()
WHERE id = '${VET_IN_TIMING_ID}' OR (entry_id = '${ENTRY_ID}' AND record_type = 'VET_IN');

-- 3. Insertar registro de auditoría con la justificación reglamentaria FEU
INSERT INTO audit_logs (
  id,
  tenant_id,
  user_id,
  action,
  entity_name,
  entity_id,
  old_data,
  new_data,
  created_at
)
VALUES (
  gen_random_uuid(),
  (SELECT tenant_id FROM competition_entries WHERE id = '${ENTRY_ID}'),
  '${ADMIN_USER_ID}',
  'UPDATE',
  'competition_entries',
  '${ENTRY_ID}',
  jsonb_build_object('status', 'ELIMINATED_TR', 'reason', 'False Positive Cron Timeout'),
  jsonb_build_object('status', 'IN_RACE', 'notes', '${REPAIR_REASON}'),
  NOW()
);

COMMIT;
`;

async function repairLocal() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'equus_secure_pass_2026',
    database: process.env.DB_NAME || 'equuscronos',
  });

  await client.connect();
  try {
    await client.query(sqlQueries);
    console.log('✅ Local database repair completed successfully.');
  } finally {
    await client.end();
  }
}

function repairProd() {
  console.log('Executing repair query on production server via SSH...');
  try {
    const echoCmd = `echo "${sqlQueries.replace(/"/g, '\\"')}" | ssh -i "C:\\Users\\hp\\.ssh\\.ssh\\equuscronos\\id_ed25519_equus" -o StrictHostKeyChecking=no ubuntu@51.79.91.102 "docker exec -i equuscronos-db psql -U postgres -d equuscronos"`;
    const result = execSync(echoCmd).toString();
    console.log('Production DB Output:\n', result);
    console.log('✅ Production database repair completed successfully.');
  } catch (err) {
    console.error('❌ Production repair failed:', err.message);
  }
}

if (process.argv.includes('--prod')) {
  repairProd();
} else {
  repairLocal();
}
