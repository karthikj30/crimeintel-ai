// ============================================================
// 5. Case-Solvability Triage Score
// Rank open FIRs by likelihood investigator hours will pay off
// ============================================================
const { getFirDb } = require('../fir/db');

function scoreCase(row) {
  let score = 10; // base
  const factors = [];

  if (row.accusedCount > 0) {
    score += 18;
    factors.push({ key: 'named_accused', label: 'Named / linked accused', points: 18 });
  }
  if (row.arrested) {
    score += 20;
    factors.push({ key: 'arrest', label: 'Arrest / surrender recorded', points: 20 });
  }
  if (row.habitualAccused) {
    score += 12;
    factors.push({ key: 'network', label: 'Accused linked to known / habitual network', points: 12 });
  }
  const facts = (row.facts || '').toLowerCase();
  if (/cctv|camera|footage|video/.test(facts)) {
    score += 15;
    factors.push({ key: 'cctv', label: 'CCTV / footage mentioned in BriefFacts', points: 15 });
  }
  if (/witness|eyewitness|bystander|neighbour|neighbor/.test(facts)) {
    score += 10;
    factors.push({ key: 'witness', label: 'Witness mentioned', points: 10 });
  }
  if (/recover|seized|recovery|stolen property recovered/.test(facts)) {
    score += 10;
    factors.push({ key: 'property', label: 'Property recovery mentioned', points: 10 });
  }
  if (/phone|mobile|imei|vehicle|registration|number plate/.test(facts)) {
    score += 8;
    factors.push({ key: 'identifiers', label: 'Phone / vehicle identifiers mentioned', points: 8 });
  }
  if (row.hasPhone) {
    score += 6;
    factors.push({ key: 'phone_db', label: 'Accused phone on record', points: 6 });
  }
  if (row.hasTxn) {
    score += 8;
    factors.push({ key: 'money', label: 'Linked financial transaction', points: 8 });
  }
  if (row.gravity === 'Heinous') {
    score += 5;
    factors.push({ key: 'gravity', label: 'Heinous offence (priority)', points: 5 });
  }
  // Age of case — fresher is more solvable
  const ageDays = row.ageDays || 0;
  if (ageDays <= 7) { score += 8; factors.push({ key: 'fresh', label: 'Registered ≤7 days ago', points: 8 }); }
  else if (ageDays <= 30) { score += 4; factors.push({ key: 'recent', label: 'Registered ≤30 days ago', points: 4 }); }
  else if (ageDays > 180) { score -= 8; factors.push({ key: 'stale', label: 'Case older than 6 months (−)', points: -8 }); }

  score = Math.max(0, Math.min(100, score));
  const band = score >= 70 ? 'pursue' : score >= 40 ? 'develop' : 'screen';
  return { score, band, factors };
}

function solvabilityTriage({ limit = 80 } = {}) {
  const db = getFirDb();
  const { dataNowIsoDate } = require('./helpers');
  const anchor = dataNowIsoDate(db);

  const rows = db.prepare(`
    SELECT c.CaseMasterID id, c.CrimeNo, c.BriefFacts facts, c.CrimeRegisteredDate registered,
           sh.CrimeHeadName subhead, h.CrimeGroupName head,
           st.CaseStatusName status, u.UnitName station, d.DistrictName district,
           g.LookupValue gravity,
           CAST(julianday(?) - julianday(c.CrimeRegisteredDate) AS INTEGER) ageDays,
           (SELECT COUNT(*) FROM Accused a WHERE a.CaseMasterID=c.CaseMasterID) accusedCount,
           (SELECT COUNT(*) FROM ArrestSurrender ar WHERE ar.CaseMasterID=c.CaseMasterID) arrested,
           (SELECT COUNT(*) FROM Accused a
              JOIN PersonMaster p ON p.PersonMasterID=a.PersonMasterID
              WHERE a.CaseMasterID=c.CaseMasterID AND p.IsHabitualOffender=1) habitualAccused,
           (SELECT COUNT(*) FROM Accused a
              JOIN PhoneNumber ph ON ph.PersonMasterID=a.PersonMasterID
              WHERE a.CaseMasterID=c.CaseMasterID) hasPhone,
           (SELECT COUNT(*) FROM FinancialTransaction ft WHERE ft.CaseMasterID=c.CaseMasterID) hasTxn
    FROM CaseMaster c
    JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
    JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
    JOIN CaseStatusMaster st ON st.CaseStatusID=c.CaseStatusID
    JOIN Unit u ON u.UnitID=c.PoliceStationID
    JOIN District d ON d.DistrictID=u.DistrictID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID=c.GravityOffenceID
    WHERE st.CaseStatusName IN ('Under Investigation', 'Pending Trial', 'Closed - Undetected')
    ORDER BY c.CrimeRegisteredDate DESC
    LIMIT 1000
  `).all(anchor);

  const scored = rows.map((r) => {
    const s = scoreCase(r);
    return {
      CrimeNo: r.CrimeNo,
      subhead: r.subhead,
      head: r.head,
      station: r.station,
      district: r.district,
      status: r.status,
      gravity: r.gravity,
      ageDays: r.ageDays,
      registered: r.registered,
      solvability: s.score,
      band: s.band,
      factors: s.factors,
      factsPreview: (r.facts || '').slice(0, 140),
    };
  });

  scored.sort((a, b) => b.solvability - a.solvability);

  return {
    method: 'UK-style solvability factors over FIR text + linked entities (investigator prioritization — not conviction prediction)',
    asOf: anchor,
    summary: {
      openCases: rows.length,
      pursue: scored.filter((c) => c.band === 'pursue').length,
      develop: scored.filter((c) => c.band === 'develop').length,
      screen: scored.filter((c) => c.band === 'screen').length,
    },
    worklist: scored.slice(0, limit),
  };
}

module.exports = { solvabilityTriage, scoreCase };
