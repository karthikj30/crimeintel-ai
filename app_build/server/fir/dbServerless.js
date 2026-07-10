// ============================================================
// Serverless SQLite adapter (sql.js WASM)
// ------------------------------------------------------------
// Used on Vercel / Catalyst Functions where better-sqlite3 native
// addons are unavailable. Loads the DB from local file or HF URL.
// Exposes a better-sqlite3-compatible prepare().all()/.get() API.
// ============================================================

const path = require('path');
const { fetchDbFromHF } = require('./hfData');

let sqlJsModule = null;
let dbWrapper = null;
let initPromise = null;

function wrapStatement(stmt) {
  return {
    readonly: true,
    reader: true,
    all(...params) {
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.reset();
      return rows;
    },
    get(...params) {
      const rows = this.all(...params);
      return rows[0];
    },
  };
}

function wrapDb(sqlDb) {
  return {
    prepare(sql) {
      return wrapStatement(sqlDb.prepare(sql));
    },
    exec(sql) {
      sqlDb.run(sql);
    },
    pragma() { /* no-op on serverless */ },
    _raw: sqlDb,
  };
}

async function initSqlJsDb() {
  if (dbWrapper) return dbWrapper;

  const fs = require('fs');
  const initSqlJs = require('sql.js');

  // Load WASM binary directly — avoids broken locateFile paths in Next.js bundles
  let wasmBinary;
  try {
    wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  } catch {
    wasmBinary = fs.readFileSync(
      path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    );
  }

  const SQL = await initSqlJs({ wasmBinary });

  let buffer;
  const localPath = path.join(__dirname, '..', 'ksp_crime.db');
  if (fs.existsSync(localPath) && !process.env.HF_DATASET_URL && !process.env.HF_DATASET_REPO) {
    buffer = fs.readFileSync(localPath);
  } else {
    buffer = await fetchDbFromHF();
  }

  const sqlDb = new SQL.Database(buffer);
  dbWrapper = wrapDb(sqlDb);
  return dbWrapper;
}

function getFirDbAsync() {
  if (!initPromise) initPromise = initSqlJsDb();
  return initPromise;
}

function isServerless() {
  return !!(process.env.VERCEL || process.env.CATALYST_ENV || process.env.USE_SQLJS);
}

module.exports = { getFirDbAsync, isServerless, initSqlJsDb };
