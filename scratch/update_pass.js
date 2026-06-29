const { Client } = require('pg');

const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'equus_secure_pass_2026',
  database: 'equuscronos',
};

async function run() {
  const client = new Client(dbConfig);
  await client.connect();
  const res = await client.query(`
    UPDATE users 
    SET password_hash = '$2b$10$gf0AiDPdNP4f7z4vvf9AneFTYJFrqarnpZxI/dRgkt1zOn4/1SlDG' 
    WHERE email = 'club2@melo.uy';
  `);
  console.log("Updated rows:", res.rowCount);
  await client.end();
}

run();
