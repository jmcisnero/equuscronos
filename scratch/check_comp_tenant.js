const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

async function check() {
  const client = new Client(dbConfig);
  await client.connect();
  try {
    const res = await client.query(`
      SELECT c.id, c.name, c.tenant_id, t.name as tenant_name
      FROM competitions c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      WHERE c.id = 'c88eacaf-d206-418b-a2ff-224115490470';
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
