// ============================================================
// KSP CRIME INTELLIGENCE — Criminal Network Builder
// ------------------------------------------------------------
// Derives an entity-link graph from the FIR database:
//   nodes  = persons (accused)
//   edges  = CO_ACCUSED (same FIR), SHARED_PHONE, MONEY_TRAIL
// Runs union-find community detection (gang clusters) and degree
// centrality (key players) over the derived graph.
// ============================================================

const { getFirDb } = require('../fir/db');

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

function rawEdges(db) {
  const coAccused = db.prepare(`
    SELECT a1.PersonMasterID p1, a2.PersonMasterID p2, COUNT(DISTINCT a1.CaseMasterID) w
    FROM Accused a1 JOIN Accused a2
      ON a1.CaseMasterID = a2.CaseMasterID AND a1.PersonMasterID < a2.PersonMasterID
    WHERE a1.PersonMasterID IS NOT NULL AND a2.PersonMasterID IS NOT NULL
    GROUP BY a1.PersonMasterID, a2.PersonMasterID`).all();

  const sharedPhone = db.prepare(`
    SELECT DISTINCT ph1.PersonMasterID p1, ph2.PersonMasterID p2
    FROM PhoneNumber ph1 JOIN PhoneNumber ph2
      ON ph1.Number = ph2.Number AND ph1.PersonMasterID < ph2.PersonMasterID`).all();

  const money = db.prepare(`
    SELECT fa.PersonMasterID p1, ta.PersonMasterID p2, COUNT(*) w, SUM(ft.Amount) amt
    FROM FinancialTransaction ft
    JOIN BankAccount fa ON fa.AccountID = ft.FromAccountID
    JOIN BankAccount ta ON ta.AccountID = ft.ToAccountID
    WHERE fa.PersonMasterID IS NOT NULL AND ta.PersonMasterID IS NOT NULL
      AND fa.PersonMasterID <> ta.PersonMasterID
    GROUP BY fa.PersonMasterID, ta.PersonMasterID`).all();

  const edges = [];
  for (const e of coAccused) edges.push({ source: e.p1, target: e.p2, type: 'co_accused', weight: e.w });
  for (const e of sharedPhone) edges.push({ source: e.p1, target: e.p2, type: 'shared_phone', weight: 1 });
  for (const e of money) edges.push({ source: e.p1, target: e.p2, type: 'money', weight: e.w, amount: e.amt });
  return edges;
}

function personMeta(db, ids) {
  if (!ids.length) return new Map();
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT p.PersonMasterID id, p.FullName name, p.Gender gender, p.AgeYear age,
           p.IsHabitualOffender habitual, p.RiskScore risk, d.DistrictName district,
           (SELECT COUNT(*) FROM Accused a WHERE a.PersonMasterID = p.PersonMasterID) firCount
    FROM PersonMaster p LEFT JOIN District d ON d.DistrictID = p.DistrictID
    WHERE p.PersonMasterID IN (${ph})`).all(...ids);
  return new Map(rows.map((r) => [r.id, r]));
}

// Build a visualization-ready graph, capped to the most-connected nodes.
function buildGraph({ maxNodes = 110 } = {}) {
  const db = getFirDb();
  const edges = rawEdges(db);

  // degree across all edge types
  const degree = new Map();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  // keep the top-degree nodes
  const keep = new Set([...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxNodes).map((e) => e[0]));
  const keptEdges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));

  // communities via union-find over kept edges
  const uf = new UnionFind();
  for (const id of keep) uf.find(id);
  for (const e of keptEdges) uf.union(e.source, e.target);
  const compIndex = new Map();
  let ci = 0;
  const community = new Map();
  for (const id of keep) {
    const root = uf.find(id);
    if (!compIndex.has(root)) compIndex.set(root, ci++);
    community.set(id, compIndex.get(root));
  }

  const meta = personMeta(db, [...keep]);
  const nodes = [...keep].map((id) => {
    const m = meta.get(id) || {};
    return {
      id, name: m.name || `Person ${id}`, gender: m.gender, age: m.age,
      habitual: !!m.habitual, risk: m.risk || 0, district: m.district,
      firCount: m.firCount || 0, degree: degree.get(id) || 0, community: community.get(id),
    };
  });

  return {
    nodes,
    edges: keptEdges,
    stats: {
      totalLinkedPersons: degree.size,
      shownNodes: nodes.length,
      shownEdges: keptEdges.length,
      communities: ci,
    },
  };
}

// Detected gangs = connected components of the CO_ACCUSED graph (size >= 3).
function listGangs({ minSize = 3, limit = 12 } = {}) {
  const db = getFirDb();
  const co = db.prepare(`
    SELECT a1.PersonMasterID p1, a2.PersonMasterID p2
    FROM Accused a1 JOIN Accused a2
      ON a1.CaseMasterID = a2.CaseMasterID AND a1.PersonMasterID < a2.PersonMasterID
    WHERE a1.PersonMasterID IS NOT NULL AND a2.PersonMasterID IS NOT NULL`).all();

  const uf = new UnionFind();
  for (const e of co) uf.union(e.p1, e.p2);
  const groups = new Map();
  for (const e of co) {
    const r = uf.find(e.p1);
    if (!groups.has(r)) groups.set(r, new Set());
    groups.get(r).add(e.p1); groups.get(r).add(e.p2);
  }

  const gangs = [];
  for (const [root, members] of groups) {
    if (members.size < minSize) continue;
    const ids = [...members];
    const meta = personMeta(db, ids);
    const ph = ids.map(() => '?').join(',');
    const agg = db.prepare(`
      SELECT COUNT(DISTINCT a.CaseMasterID) cases,
             SUM(CASE WHEN c.GravityOffenceID = 1 THEN 1 ELSE 0 END) heinous
      FROM Accused a JOIN CaseMaster c ON c.CaseMasterID = a.CaseMasterID
      WHERE a.PersonMasterID IN (${ph})`).get(...ids);
    const memberList = ids.map((id) => meta.get(id)).filter(Boolean).sort((a, b) => b.risk - a.risk);
    gangs.push({
      id: `gang-${root}`,
      size: members.size,
      cases: agg.cases || 0,
      heinous: agg.heinous || 0,
      kingpin: memberList[0] ? memberList[0].name : null,
      topRisk: memberList[0] ? memberList[0].risk : 0,
      members: memberList.map((m) => ({ id: m.id, name: m.name, risk: m.risk, firCount: m.firCount })),
    });
  }
  gangs.sort((a, b) => b.heinous - a.heinous || b.size - a.size);
  return gangs.slice(0, limit);
}

// Ego network + full profile for one person (investigator drill-down).
function personEgo(personId) {
  const db = getFirDb();
  const person = db.prepare(`
    SELECT p.*, d.DistrictName district, ca.caste_master_name caste, rl.ReligionName religion, o.OccupationName occupation
    FROM PersonMaster p
    LEFT JOIN District d ON d.DistrictID = p.DistrictID
    LEFT JOIN CasteMaster ca ON ca.caste_master_id = p.CasteID
    LEFT JOIN ReligionMaster rl ON rl.ReligionID = p.ReligionID
    LEFT JOIN OccupationMaster o ON o.OccupationID = p.OccupationID
    WHERE p.PersonMasterID = ?`).get(personId);
  if (!person) return null;

  const cases = db.prepare(`
    SELECT c.CrimeNo, c.CrimeRegisteredDate date, sh.CrimeHeadName crime, g.LookupValue gravity,
           st.CaseStatusName status, u.UnitName station
    FROM Accused a JOIN CaseMaster c ON c.CaseMasterID = a.CaseMasterID
    LEFT JOIN CrimeSubHead sh ON sh.CrimeSubHeadID = c.CrimeMinorHeadID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID = c.GravityOffenceID
    LEFT JOIN CaseStatusMaster st ON st.CaseStatusID = c.CaseStatusID
    LEFT JOIN Unit u ON u.UnitID = c.PoliceStationID
    WHERE a.PersonMasterID = ? ORDER BY c.CrimeRegisteredDate DESC`).all(personId);

  const coAccused = db.prepare(`
    SELECT DISTINCT p2.PersonMasterID id, p2.FullName name, p2.RiskScore risk, COUNT(DISTINCT a1.CaseMasterID) shared
    FROM Accused a1 JOIN Accused a2 ON a1.CaseMasterID = a2.CaseMasterID AND a2.PersonMasterID <> a1.PersonMasterID
    JOIN PersonMaster p2 ON p2.PersonMasterID = a2.PersonMasterID
    WHERE a1.PersonMasterID = ? GROUP BY p2.PersonMasterID ORDER BY shared DESC LIMIT 20`).all(personId);

  const phones = db.prepare('SELECT Number FROM PhoneNumber WHERE PersonMasterID = ?').all(personId).map((r) => r.Number);
  const accounts = db.prepare('SELECT BankName, AccountNo, IsFlagged FROM BankAccount WHERE PersonMasterID = ?').all(personId);

  return { person, cases, coAccused, phones, accounts };
}

module.exports = { buildGraph, listGangs, personEgo };
