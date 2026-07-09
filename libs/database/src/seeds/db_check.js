const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

async function runCheck() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected to database.');

    const pgStatRes = await client.query(`
      SELECT pid, state, query, wait_event_type, wait_event, query_start
      FROM pg_stat_activity
      WHERE state IS NOT NULL AND query NOT LIKE '%pg_stat_activity%'
    `);
    
    console.log('Active PostgreSQL queries:');
    pgStatRes.rows.forEach(r => {
      console.log(` - PID: ${r.pid}, State: ${r.state}, Wait Event: ${r.wait_event_type}/${r.wait_event}, Start: ${r.query_start}`);
      console.log(`   Query: ${r.query.substring(0, 150)}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

runCheck();
