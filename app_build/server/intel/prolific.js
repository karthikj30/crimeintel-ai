// ============================================================
// 6. Prolific-Offender & Recidivism Management (IOM)
// Tiers from percentile RiskScore; days-since anchored to data MAX date
// ============================================================
const { getFirDb } = require('../fir/db');
const { dataNowIsoDate } = require('./helpers');

function prolificWatchlist({ limit = 30 } = {}) {
  const db = getFirDb();
  const anchor = dataNowIsoDate(db);

  const rows = db.prepare(`
    SELECT p.PersonMasterID id, p.FullName name, p.Gender gender, p.AgeYear age,
           p.RiskScore risk, p.IsHabitualOffender habitual, p.Address address,
           d.DistrictName district, p.latitude lat, p.longitude lng,
           COUNT(DISTINCT a.CaseMasterID) cases,
           SUM(CASE WHEN c.GravityOffenceID=1 THEN 1 ELSE 0 END) heinous,
           MAX(c.CrimeRegisteredDate) lastFir,
           MIN(c.CrimeRegisteredDate) firstFir,
           CAST(julianday(?) - julianday(MAX(c.CrimeRegisteredDate)) AS INTEGER) daysSinceLast,
           (SELECT GROUP_CONCAT(DISTINCT sh.CrimeHeadName)
              FROM Accused a2
              JOIN CaseMaster c2 ON c2.CaseMasterID=a2.CaseMasterID
              JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c2.CrimeMinorHeadID
              WHERE a2.PersonMasterID=p.PersonMasterID) modus,
           (SELECT COUNT(*) FROM PhoneNumber ph WHERE ph.PersonMasterID=p.PersonMasterID) phones,
           (SELECT COUNT(*) FROM BankAccount ba WHERE ba.PersonMasterID=p.PersonMasterID AND ba.IsFlagged=1) flaggedAccounts
    FROM PersonMaster p
    JOIN Accused a ON a.PersonMasterID=p.PersonMasterID
    JOIN CaseMaster c ON c.CaseMasterID=a.CaseMasterID
    LEFT JOIN District d ON d.DistrictID=p.DistrictID
    WHERE p.IsHabitualOffender=1 OR p.RiskScore >= 40 OR (
      SELECT COUNT(*) FROM Accused ax WHERE ax.PersonMasterID=p.PersonMasterID
    ) >= 2
    GROUP BY p.PersonMasterID
    ORDER BY p.RiskScore DESC, cases DESC
    LIMIT 80
  `).all(anchor);

  // Tier by rank within the IOM cohort (top 20% / next 30% / rest) so tiers always separate
  const n = rows.length;
  const watchlist = rows.map((r, i) => {
    const span = Date.parse(r.lastFir) - Date.parse(r.firstFir);
    const intervals = r.cases > 1 && Number.isFinite(span) ? span / 86400000 / (r.cases - 1) : null;
    let alert = null;
    if (intervals && r.daysSinceLast != null && r.daysSinceLast >= intervals * 0.8) {
      alert = {
        level: r.daysSinceLast >= intervals ? 'high' : 'watch',
        message: r.daysSinceLast >= intervals
          ? `Re-offense window open: typical gap ~${Math.round(intervals)} days; ${r.daysSinceLast} days since last FIR (as of ${anchor}).`
          : `Approaching re-offense window (typical gap ~${Math.round(intervals)} days; ${r.daysSinceLast} days since last FIR).`,
      };
    } else if ((r.daysSinceLast || 999) <= 30 && r.cases >= 3) {
      alert = {
        level: 'active',
        message: `Recently active prolific offender — last FIR ${r.daysSinceLast} days ago (as of ${anchor}).`,
      };
    }

    const tier = i < n * 0.2 ? 'tier1' : i < n * 0.5 ? 'tier2' : 'tier3';

    return {
      id: r.id,
      name: r.name,
      age: r.age,
      gender: r.gender,
      district: r.district,
      lat: r.lat,
      lng: r.lng,
      risk: r.risk,
      habitual: !!r.habitual,
      cases: r.cases,
      heinous: r.heinous,
      lastFir: r.lastFir,
      firstFir: r.firstFir,
      daysSinceLast: r.daysSinceLast,
      avgGapDays: intervals ? Math.round(intervals) : null,
      modus: (r.modus || '').split(',').filter(Boolean).slice(0, 5),
      phones: r.phones,
      flaggedAccounts: r.flaggedAccounts,
      tier,
      alert,
      ethicsNote: 'Investigator prioritization / IOM watch-list only — not a sentencing or bail score.',
    };
  });

  watchlist.sort((a, b) => {
    const alertRank = (x) => (x.alert?.level === 'high' ? 3 : x.alert?.level === 'active' ? 2 : x.alert ? 1 : 0);
    return alertRank(b) - alertRank(a) || b.risk - a.risk;
  });

  return {
    framing: 'UK Integrated Offender Management (IOM) style — manage the small % of offenders driving most volume. For investigation prioritization only.',
    asOf: anchor,
    summary: {
      onWatchlist: watchlist.length,
      tier1: watchlist.filter((w) => w.tier === 'tier1').length,
      tier2: watchlist.filter((w) => w.tier === 'tier2').length,
      tier3: watchlist.filter((w) => w.tier === 'tier3').length,
      reoffenseAlerts: watchlist.filter((w) => w.alert).length,
      highAlerts: watchlist.filter((w) => w.alert?.level === 'high').length,
    },
    watchlist: watchlist.slice(0, limit),
  };
}

module.exports = { prolificWatchlist };
