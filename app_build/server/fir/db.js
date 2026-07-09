// ============================================================
// KSP CRIME INTELLIGENCE — FIR Database Bootstrap
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const { initFirSchema } = require('./schema');

const DB_PATH = path.join(__dirname, '..', 'ksp_crime.db');

let db;

function getFirDb() {
  if (!db) {
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
