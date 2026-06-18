import mysql from 'mysql2/promise';

const commonPasswords = [
  '',
  'root',
  'password',
  '123456',
  'admin',
  'mysql'
];

async function testPasswords() {
  for (const pwd of commonPasswords) {
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: pwd
      });
      console.log(`SUCCESS: password is "${pwd}"`);
      await conn.end();
      process.exit(0);
    } catch (err) {
      console.log(`FAILED with password "${pwd}": ${err.message}`);
    }
  }
  console.log('ALL FAILED');
  process.exit(1);
}

testPasswords();
