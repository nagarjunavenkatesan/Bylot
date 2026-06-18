const bcrypt = require("bcrypt");
const env = require("../config/env");

async function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptSaltRounds);
}

async function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};
