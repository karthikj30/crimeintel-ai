// ============================================================
// Cold-case re-opener
// Re-scan Closed-Undetected FIRs against current linkage series &
// prolific MO matches → fresh leads on dormant files
// ============================================================
const { getFirDb } = require('../fir/db');
const { findLinkages } = require('./linkage');
const { prolificWatchlist } = require('./prolific');
const { dataNowIsoDate } = require('./helpers');

function reopenColdCases({ limit = 25 } = {}) {
  const db = getFirDb();
  const anchor = dataNowIsoDate(db);
  const { clusters } = findLinkages({ minCluster: 3, limit: 30 });
  const iom = prolificWatchlist({ limit: 60 });

  // Index series by crime sub-head
  const bySub = new Map();
  for (const c of clusters) {
    if (!bySub.has(c.crimeSubHead)) bySub.set(c.crimeSubHead, []);
    bySub.get(c.crimeSubHead).push(c);
  }

  const cold = db.prepare(`
    SELECT c.CaseMasterID id, c.CrimeNo, c.BriefFacts facts, c.CrimeRegisteredDate registered,
           c.latitude lat, c.longitude lng,
           sh.CrimeHeadName subhead, h.CrimeGroupName head,
           u.UnitName station, d.DistrictName district,
           CAST(julianday(?) - julianday(c.CrimeRegisteredDate) AS INTEGER) ageDays
    FROM CaseMaster c
    JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
    JOIN CrimeHead h ON h.CrimeHeadID=c.CrimeMajorHeadID
    JOIN Unit u ON u.UnitID=c.PoliceStationID
    JOIN District d ON d.DistrictID=u.DistrictID
    WHERE st.CaseStatusName = 'Closed - Undetected'
    ORDER BY c.CrimeRegisteredDate DESC
    LIMIT 300
  `.replace('WHERE st.CaseStatusName', `JOIN CaseStatusMaster st ON st.CaseStatusID=c.CaseStatusID
    WHERE st.CaseStatusName`)).all(anchor);

  const leads = [];
  for (const fir of cold) {
    const seriesHits = (bySub.get(fir.subhead) || []).filter((s) => {
      const sameDistrict = (s.districts || []).includes(fir.district);
      const stationHit = (s.stations || []).includes(fir.station);
      return sameDistrict || stationHit || s.size >= 5;
    });

    const bestSeries = seriesHits
      .map((s) => {
        let geoBoost = (s.districts || []).includes(fir.district) ? 20 : 0;
        if ((s.stations || []).includes(fir.station)) geoBoost += 15;
        if (fir.lat != null && s.centroid) {
          const { haversineKm } = require('./helpers');
          const d = haversineKm(fir.lat, fir.lng, s.centroid.lat, s.centroid.lng);
          if (d <= 8) geoBoost += 25;
          else if (d <= 20) geoBoost += 10;
        }
        return { series: s, score: s.strength + geoBoost + Math.min(15, s.size) };
      })
      .sort((a, b) => b.score - a.score)[0];

    // Strong MO match only (exact sub-head) + prefer same district
    const moSuspects = iom.watchlist.filter((o) => {
      const moHit = (o.modus || []).some((m) => m.toLowerCase() === fir.subhead.toLowerCase());
      if (!moHit) return false;
      if (o.district && o.district === fir.district) return true;
      return (o.risk || 0) >= 85;
    }).slice(0, 3);

    // Require a real hook: series with district/geo boost, or MO+district suspect
    const seriesCredible = bestSeries && (
      (bestSeries.series.districts || []).includes(fir.district)
      || (bestSeries.series.stations || []).includes(fir.station)
      || bestSeries.score >= 90
    );
    if (!seriesCredible && !moSuspects.length) continue;

    const reasons = [];
    if (seriesCredible) {
      reasons.push(`Matches active series "${bestSeries.series.label}" (${bestSeries.series.strength}% link strength)`);
    }
    if (moSuspects.length) {
      reasons.push(`MO-aligned prolific offenders: ${moSuspects.map((s) => s.name).join(', ')}`);
    }
    if (fir.ageDays > 180) reasons.push(`Cold file — ${fir.ageDays} days closed undetected`);

    const leadScore = (seriesCredible ? bestSeries.score : 0) + moSuspects.length * 12;
    if (leadScore < 70) continue;

    leads.push({
      CrimeNo: fir.CrimeNo,
      subhead: fir.subhead,
      station: fir.station,
      district: fir.district,
      registered: fir.registered,
      ageDays: fir.ageDays,
      seriesId: seriesCredible ? bestSeries.series.id : null,
      seriesLabel: seriesCredible ? bestSeries.series.label : null,
      seriesStrength: seriesCredible ? bestSeries.series.strength : null,
      suggestedSuspects: moSuspects.map((s) => ({ id: s.id, name: s.name, risk: s.risk, tier: s.tier })),
      leadScore,
      reasons,
      action: seriesCredible
        ? `Re-open and fold into series ${bestSeries.series.id}; cross-check with IO at ${(bestSeries.series.stations || []).slice(0, 3).join(', ')}.`
        : `Re-open for MO review against prolific watchlist (${moSuspects[0]?.name || 'n/a'}).`,
    });
  }

  leads.sort((a, b) => b.leadScore - a.leadScore);

  return {
    framing: 'Cold-case re-opener — undetected FIRs re-scored against live linkage + IOM MO matches',
    asOf: anchor,
    summary: {
      scanned: cold.length,
      freshLeads: leads.length,
      withSeries: leads.filter((l) => l.seriesId).length,
      withSuspect: leads.filter((l) => l.suggestedSuspects.length).length,
    },
    leads: leads.slice(0, limit),
  };
}

module.exports = { reopenColdCases };
