// ============================================================
// 1. Serial-Crime Linkage Engine (ViCAP/ViCLAS-style)
// Clusters unsolved FIRs by MO similarity + geo/time + shared phones
// ============================================================
const { getFirDb } = require('../fir/db');
const { haversineKm, tokenize, jaccard, UnionFind } = require('./helpers');

function loadCases(db) {
  return db.prepare(`
    SELECT c.CaseMasterID id, c.CrimeNo, c.BriefFacts facts, c.latitude lat, c.longitude lng,
           c.IncidentFromDate incident, c.CrimeRegisteredDate registered,
           sh.CrimeHeadName subhead, h.CrimeGroupName head,
           st.CaseStatusName status, u.UnitName station, d.DistrictName district,
           g.LookupValue gravity
    FROM CaseMaster c
    JOIN CrimeSubHead sh ON sh.CrimeSubHeadID = c.CrimeMinorHeadID
    JOIN CrimeHead h ON h.CrimeHeadID = c.CrimeMajorHeadID
    JOIN CaseStatusMaster st ON st.CaseStatusID = c.CaseStatusID
    JOIN Unit u ON u.UnitID = c.PoliceStationID
    JOIN District d ON d.DistrictID = u.DistrictID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID = c.GravityOffenceID
    WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND st.CaseStatusName IN ('Under Investigation', 'Pending Trial', 'Closed - Undetected')
    ORDER BY c.CrimeRegisteredDate DESC
    LIMIT 500
  `).all();
}

function phoneLinks(db) {
  const rows = db.prepare(`
    SELECT DISTINCT a1.CaseMasterID c1, a2.CaseMasterID c2
    FROM PhoneNumber p1
    JOIN PhoneNumber p2 ON p1.Number = p2.Number AND p1.PersonMasterID < p2.PersonMasterID
    JOIN Accused a1 ON a1.PersonMasterID = p1.PersonMasterID
    JOIN Accused a2 ON a2.PersonMasterID = p2.PersonMasterID
    WHERE a1.CaseMasterID <> a2.CaseMasterID
  `).all();
  const set = new Set();
  for (const r of rows) {
    set.add(`${Math.min(r.c1, r.c2)}:${Math.max(r.c1, r.c2)}`);
  }
  return set;
}

function pairScore(a, b, tokensA, tokensB, phoneSet) {
  // Hard gate: same crime sub-head (ViCAP-style MO class)
  if (a.subhead !== b.subhead) return { score: 0, reasons: [] };

  let score = 0.25; // base for matching sub-head
  const reasons = ['same crime sub-head / MO class'];
  let signals = 1; // count corroborating signals beyond sub-head

  const jac = jaccard(tokensA, tokensB);
  if (jac >= 0.2) { score += Math.min(0.35, jac); reasons.push(`MO text similarity ${(jac * 100).toFixed(0)}%`); signals += 1; }

  let km = Infinity;
  if (a.lat != null && b.lat != null) {
    km = haversineKm(a.lat, a.lng, b.lat, b.lng);
    if (km <= 3) { score += 0.28; reasons.push(`${km.toFixed(1)} km apart`); signals += 1; }
    else if (km <= 8) { score += 0.14; reasons.push(`${km.toFixed(1)} km apart`); signals += 1; }
    else if (km <= 20) { score += 0.05; reasons.push(`${km.toFixed(1)} km apart`); }
    else return { score: 0, reasons: [] }; // too far for a serial series
  }

  const da = Date.parse(a.incident || a.registered || '');
  const db_ = Date.parse(b.incident || b.registered || '');
  if (Number.isFinite(da) && Number.isFinite(db_)) {
    const days = Math.abs(da - db_) / 86400000;
    if (days > 120) return { score: 0, reasons: [] }; // different campaign window
    if (days <= 14) { score += 0.18; reasons.push(`${Math.round(days)} days apart`); signals += 1; }
    else if (days <= 45) { score += 0.1; reasons.push(`${Math.round(days)} days apart`); signals += 1; }
    else if (days <= 90) { score += 0.04; reasons.push(`${Math.round(days)} days apart`); }
  }

  const key = `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;
  if (phoneSet.has(key)) { score += 0.35; reasons.push('shared phone between accused'); signals += 2; }

  if (a.station !== b.station) { score += 0.08; reasons.push('cross-station'); }

  // Need at least one corroborating signal beyond same sub-head
  if (signals < 2) return { score: 0, reasons: [] };

  return { score: Math.min(1, score), reasons };
}

function findLinkages({ minCluster = 3, threshold = 0.55, limit = 12, maxCluster = 15 } = {}) {
  const db = getFirDb();
  const cases = loadCases(db);
  const phones = phoneLinks(db);
  const tokens = cases.map((c) => tokenize(`${c.facts || ''} ${c.subhead || ''}`));

  // Group by sub-head first — never union across MO classes
  const bySub = new Map();
  cases.forEach((c, idx) => {
    if (!bySub.has(c.subhead)) bySub.set(c.subhead, []);
    bySub.get(c.subhead).push(idx);
  });

  const uf = new UnionFind();
  const edgeMeta = new Map();

  for (const [, idxs] of bySub) {
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        const ii = idxs[i]; const jj = idxs[j];
        const { score, reasons } = pairScore(cases[ii], cases[jj], tokens[ii], tokens[jj], phones);
        if (score >= threshold) {
          uf.union(cases[ii].id, cases[jj].id);
          edgeMeta.set(`${Math.min(cases[ii].id, cases[jj].id)}:${Math.max(cases[ii].id, cases[jj].id)}`, { score, reasons });
        }
      }
    }
  }

  const groups = new Map();
  for (const c of cases) {
    const r = uf.find(c.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c);
  }

  const clusters = [];
  for (const [, members] of groups) {
    if (members.length < minCluster) continue;
    // Cap runaway clusters — keep the densest geo core
    let core = members;
    if (members.length > maxCluster) {
      const clat = members.reduce((s, m) => s + m.lat, 0) / members.length;
      const clng = members.reduce((s, m) => s + m.lng, 0) / members.length;
      core = [...members]
        .sort((a, b) => haversineKm(a.lat, a.lng, clat, clng) - haversineKm(b.lat, b.lng, clat, clng))
        .slice(0, maxCluster);
    }

    const stations = new Set(core.map((m) => m.station));
    const districts = new Set(core.map((m) => m.district));
    let sum = 0; let n = 0; const allReasons = new Set();
    for (let i = 0; i < core.length; i++) {
      for (let j = i + 1; j < core.length; j++) {
        const key = `${Math.min(core[i].id, core[j].id)}:${Math.max(core[i].id, core[j].id)}`;
        const e = edgeMeta.get(key);
        if (e) { sum += e.score; n += 1; e.reasons.forEach((r) => allReasons.add(r)); }
      }
    }
    const strength = n ? sum / n : 0;
    // Prefer cross-station series (the KSP pain point)
    if (stations.size < 2 && strength < 0.7) continue;

    clusters.push({
      id: `series-${core[0].id}`,
      label: `${core.length} linked ${core[0].subhead} cases across ${stations.size} station(s)`,
      size: core.length,
      stations: [...stations],
      districts: [...districts],
      crimeSubHead: core[0].subhead,
      crimeHead: core[0].head,
      strength: Math.round(strength * 100),
      reasons: [...allReasons].slice(0, 6),
      cases: core.map((m) => ({
        CrimeNo: m.CrimeNo,
        station: m.station,
        district: m.district,
        date: m.incident || m.registered,
        subhead: m.subhead,
        status: m.status,
        lat: m.lat,
        lng: m.lng,
        facts: (m.facts || '').slice(0, 160),
      })).sort((a, b) => String(b.date).localeCompare(String(a.date))),
      centroid: {
        lat: core.reduce((s, m) => s + m.lat, 0) / core.length,
        lng: core.reduce((s, m) => s + m.lng, 0) / core.length,
      },
    });
  }

  clusters.sort((a, b) => (b.stations.length - a.stations.length) || b.size - a.size || b.strength - a.strength);
  return {
    summary: {
      scanned: cases.length,
      clusters: clusters.length,
      largest: clusters[0]?.size || 0,
      method: 'Same MO class + BriefFacts Jaccard + ≤20 km + ≤120 days + shared phones (ViCAP-style)',
    },
    clusters: clusters.slice(0, limit),
  };
}

module.exports = { findLinkages };
