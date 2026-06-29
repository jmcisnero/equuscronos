const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'equus_app',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

async function test() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    
    // Set tenant ID to juez@melo.uy's tenant
    const juezTenant = 'a1000000-0000-0000-0000-000000000001';
    console.log(`Setting app.current_tenant_id to '${juezTenant}'...`);
    await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [juezTenant]);

    // Query competitions
    console.log("Querying competitions...");
    const comps = await client.query("SELECT id, tenant_id, name FROM competitions;");
    console.log("Competitions found:", comps.rows.length);
    console.table(comps.rows);

    // Query competition entries
    console.log("Querying competition entries...");
    const entries = await client.query("SELECT id, tenant_id, competition_id FROM competition_entries;");
    console.log("Entries found:", entries.rows.length);
    console.table(entries.rows);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

test();
