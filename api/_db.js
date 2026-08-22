const { neon } = require('@neondatabase/serverless');

let client;
function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

module.exports = { db };
