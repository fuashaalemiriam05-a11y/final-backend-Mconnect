const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Princesse@localhost:5432/mconnect' });

pool.query('SELECT id, "fullName", email, password_hash FROM users ORDER BY id').then(async res => {
  for (const row of res.rows) {
    const match = await bcrypt.compare('password123', row.password_hash);
    console.log(`${row.email}: match=${match}, hash=${row.password_hash.substring(0,20)}...`);
  }
  pool.end();
}).catch(err => { console.error(err.message); pool.end(); });
