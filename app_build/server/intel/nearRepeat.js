// ============================================================
// 3. Near-Repeat Predictive Early-Warning (Ratcliffe)
// Time-anchored to MAX(CrimeRegisteredDate) so demos stay live
// ============================================================
const { getFirDb } = require('../fir/db');
const { haversineKm, dataNowMs, dataNowIsoDate } = require('./helpers');

const RADIUS_KM = 0.4;
const WINDOW_DAYS = 14;

function nearRepeatAlerts({ lookbackDays = 21, limit = 40 } = {}) {
  const db = getFirDb();
  const anchor = dataNowIsoDate(db);
  const anchorMs = dataNowMs(db);

  const seeds = db.prepare(`
    SELECT c.CaseMasterID id, c.CrimeNo, c.latitude lat, c.longitude lng,
           c.CrimeRegisteredDate registered, c.IncidentFromDate incident,
           sh.CrimeHeadName subhead, h.CrimeGroupName head,
           u.UnitName station, d.DistrictName district, g.LookupValue gravity
    FROM CaseMaster c
    JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
    JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
    JOIN Unit u ON u.UnitID=c.PoliceStationID
    JOIN District d ON d.DistrictID=u.DistrictID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID=c.GravityOffenceID
    WHERE c.latitude IS NOT NULL
      AND date(c.CrimeRegisteredDate) >= date(?, ?)
      AND date(c.CrimeRegisteredDate) <= date(?)
    ORDER BY c.CrimeRegisteredDate DESC
    LIMIT 200
  `).all(anchor, `-${lookbackDays} days`, anchor);

  const alerts = [];

  for (const seed of seeds) {
    const seedDate = Date.parse(seed.incident || seed.registered || '');
    if (!Number.isFinite(seedDate)) continue;
    const daysSince = (anchorMs - seedDate) / 86400000;
    if (daysSince < 0 || daysSince > WINDOW_DAYS) continue;

    const urgency = Math.max(0, 1 - daysSince / WINDOW_DAYS);
    const riskLevel = urgency > 0.7 ? 'critical' : urgency > 0.4 ? 'high' : 'elevated';
    const windowEnds = new Date(seedDate + WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

    alerts.push({
      id: `nr-${seed.id}`,
      seedCrimeNo: seed.CrimeNo,
      seedSubhead: seed.subhead,
      seedHead: seed.head,
      gravity: seed.gravity,
      station: seed.station,
      district: seed.district,
      seedLat: seed.lat,
      seedLng: seed.lng,
      daysSince: Math.round(daysSince * 10) / 10,
      windowEnds,
      radiusM: Math.round(RADIUS_KM * 1000),
      riskLevel,
      urgency: Math.round(urgency * 100),
      message: `Near-repeat risk: after ${seed.subhead} at ${seed.station} (${seed.CrimeNo}), properties within ${Math.round(RADIUS_KM * 1000)} m remain at elevated risk until ${windowEnds}. Notify beat officer.`,
      hotspot: { lat: seed.lat, lng: seed.lng, radiusKm: RADIUS_KM },
    });
  }

  alerts.sort((a, b) => b.urgency - a.urgency);
  const kept = [];
  for (const a of alerts) {
    const dup = kept.find((k) => k.seedSubhead === a.seedSubhead
      && haversineKm(k.seedLat, k.seedLng, a.seedLat, a.seedLng) < 0.2);
    if (!dup) kept.push(a);
  }

  const byStation = {};
  for (const a of kept) byStation[a.station] = (byStation[a.station] || 0) + 1;

  return {
    theory: 'Near-repeat victimization (Ratcliffe) — ~400 m / 14-day elevated risk window',
    asOf: anchor,
    active: kept.slice(0, limit),
    summary: {
      seeds: seeds.length,
      activeWindows: kept.length,
      critical: kept.filter((a) => a.riskLevel === 'critical').length,
      stationsOnAlert: Object.keys(byStation).length,
      topStations: Object.entries(byStation).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([station, count]) => ({ station, count })),
    },
  };
}

module.exports = { nearRepeatAlerts };
