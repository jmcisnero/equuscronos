const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

async function checkAndAlter() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    
    console.log('Current user_role enum values in DB:');
    const res = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'user_role';
    `);
    console.log(res.rows.map(r => r.enumlabel));

    console.log('Adding CLUB_ADMIN to user_role enum if it does not exist...');
    await client.query("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLUB_ADMIN';");
    console.log('Enum altered successfully.');

    const resNew = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'user_role';
    `);
    console.log('New user_role enum values in DB:');
    console.log(resNew.rows.map(r => r.enumlabel));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkAndAlter();
