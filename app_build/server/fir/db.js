// ============================================================
// KSP CRIME INTELLIGENCE — FIR Database Bootstrap (local native SQLite)
// ------------------------------------------------------------
// Local dev / npm run serve: better-sqlite3 (native, fast).
// Vercel / Catalyst: use getDb() from getDb.js → sql.js WASM path.
// ============================================================
const path = require('path');
const { initFirSchema } = require('./schema');

const DB_PATH = path.join(__dirname, '..', 'ksp_crime.db');

let db;

function getFirDb() {
  if (!db) {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initFirSchema(db);
  }
  return db;
}

function caseCount() {
  try {
    return getFirDb().prepare('SELECT COUNT(*) AS c FROM CaseMaster').get().c;
  } catch {
    return 0;
  }
}

module.exports = { getFirDb, caseCount, DB_PATH };
