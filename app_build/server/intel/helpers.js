// ============================================================
// KSP INTEL — Shared geospatial / text helpers
// ============================================================

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

const STOP = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'been', 'been',
  'complainant', 'accused', 'reports', 'police', 'station', 'case', 'fir',
  'about', 'after', 'before', 'under', 'over', 'when', 'where', 'which',
  'their', 'there', 'been', 'been', 'being', 'into', 'also', 'said',
]);

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

class UnionFind {
  constructor() { this.p = new Map(); }
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; }
    return r;
  }
  union(a, b) { this.p.set(this.find(a), this.find(b)); }
}

/** Demo-proof "now": latest FIR registration date in the DB (falls back to wall clock). */
function dataNowMs(db) {
  try {
    const row = db.prepare('SELECT MAX(CrimeRegisteredDate) AS d FROM CaseMaster').get();
    const t = Date.parse(row?.d || '');
    if (Number.isFinite(t)) return t;
  } catch { /* empty db */ }
  return Date.now();
}

function dataNowIsoDate(db) {
  return new Date(dataNowMs(db)).toISOString().slice(0, 10);
}

module.exports = { haversineKm, tokenize, jaccard, UnionFind, dataNowMs, dataNowIsoDate };
