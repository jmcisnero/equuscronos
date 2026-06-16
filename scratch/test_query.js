const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'equus_app',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

async function main() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected as equus_app');
    
    console.log('Setting config...');
    await client.query("SELECT set_config('app.current_tenant_id', '', false)");
    console.log('Config set.');

    console.log('Running select query...');
    const res = await client.query(`
      SELECT "CompetitionEntry"."id" AS "CompetitionEntry_id"
      FROM "competition_entries" "CompetitionEntry"
      WHERE (("CompetitionEntry"."status" = 'RESTING'))
    `);
    console.log('Query finished. Results:', res.rows);

  } catch (err) {
    console.error('Error during query:', err);
  } finally {
    await client.end();
  }
}

main();
