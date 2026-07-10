// ============================================================
// Unified DB accessor — better-sqlite3 locally, sql.js on Vercel
// ============================================================
const { getFirDb } = require('./db');

function isServerless() {
  return !!(process.env.VERCEL || process.env.CATALYST_ENV || process.env.USE_SQLJS);
}

/** Returns a DB handle (native SQLite locally, WASM on serverless). */
async function getDb() {
  if (isServerless()) {
    const { getFirDbAsync } = require('./dbServerless');
    return getFirDbAsync();
  }
  return getFirDb();
}

module.exports = { getDb, isServerless };
