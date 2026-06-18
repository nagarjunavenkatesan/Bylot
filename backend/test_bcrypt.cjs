const bcrypt = require('bcrypt');

const password = '@bvnd4014BV';
const hash = '$2b$12$BLmzY0FD8CVC/ZW8tGPlOusJsV3f9fq8Tlg2edVaf/sMm8J0Y8xx.';

async function test() {
  const match = await bcrypt.compare(password, hash);
  console.log('Password match:', match);
}

test();
