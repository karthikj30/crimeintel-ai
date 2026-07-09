// ============================================================
// KSP CRIME INTELLIGENCE — Read-only SQL Guard
// ------------------------------------------------------------
// Executes ONLY safe, single-statement SELECT/WITH queries against
// the FIR database. Defense in depth: keyword ban + better-sqlite3's
// statement.readonly guarantee + forced row LIMIT. Used to run LLM-
// authored SQL without any risk of mutation or schema access.
// ============================================================

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|truncate|grant|revoke)\b/i;

function validate(rawSql) {
  if (!rawSql || typeof rawSql !== 'string') {
    return { ok: false, reason: 'empty query' };
  }
  // strip trailing semicolons / whitespace
  let sql = rawSql.trim().replace(/;+\s*$/g, '').trim();

  if (sql.includes(';')) {
    return { ok: false, reason: 'only a single statement is allowed' };
  }
  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, reason: 'only SELECT / WITH queries are allowed' };
  }
  if (FORBIDDEN.test(sql)) {
    return { ok: false, reason: 'query contains a forbidden keyword' };
  }
  if (/sqlite_/i.test(sql)) {
    return { ok: false, reason: 'access to internal tables is not allowed' };
  }
  return { ok: true, sql };
}

// db: better-sqlite3 handle. Returns { rows, sql, truncated }.
function runReadOnly(db, rawSql, { limit = 200 } = {}) {
  const v = validate(rawSql);
  if (!v.ok) {
    const err = new Error(v.reason);
    err.code = 'UNSAFE_SQL';
    throw err;
  }

  let sql = v.sql;
  const hasLimit = /\blimit\s+\d+/i.test(sql);
  if (!hasLimit) sql = `${sql} LIMIT ${limit}`;

  const stmt = db.prepare(sql);
  // better-sqlite3 guarantees: readonly === true means the statement
  // performs no writes; reader === true means it returns rows.
  if (!stmt.readonly) {
    const err = new Error('query is not read-only');
    err.code = 'UNSAFE_SQL';
    throw err;
  }
  const rows = stmt.reader ? stmt.all() : [];
  return { rows, sql, truncated: !hasLimit && rows.length >= limit };
}

module.exports = { validate, runReadOnly };
