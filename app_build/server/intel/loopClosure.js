// ============================================================
// Loop closure: Linkage series → Rossmo hunt zone → suspect fit
// End-to-end: "these 8 thefts → one neighbourhood → suggested offender"
// ============================================================
const { haversineKm } = require('./helpers');
const { findLinkages } = require('./linkage');
const { profileSeries } = require('./geographic');
const { prolificWatchlist } = require('./prolific');

function scoreSuspectFit(offender, series, hunt) {
  let score = 0;
  const reasons = [];

  // MO overlap with series crime sub-head
  const modus = (offender.modus || []).map((m) => m.toLowerCase());
  const sub = (series.crimeSubHead || '').toLowerCase();
  if (modus.some((m) => m === sub || m.includes(sub) || sub.includes(m.split(' ')[0]))) {
    score += 40;
    reasons.push(`MO match: ${series.crimeSubHead}`);
  } else if (modus.some((m) => /theft|burglar|robbery|vehicle/.test(m) && /theft|burglar|robbery|vehicle/.test(sub))) {
    score += 22;
    reasons.push('Related property-crime MO');
  }

  // Home / base inside hunt zone
  const center = hunt?.center || (hunt?.lat != null ? { lat: hunt.lat, lng: hunt.lng } : null);
  const radiusKm = hunt?.radiusKm ?? hunt?.huntRadiusKm ?? 2;
  if (offender.lat != null && center) {
    const d = haversineKm(offender.lat, offender.lng, center.lat, center.lng);
    if (d <= radiusKm) {
      score += 35;
      reasons.push(`Residence ${d.toFixed(1)} km from hunt-zone peak (inside ${radiusKm} km)`);
    } else if (d <= radiusKm * 2.5) {
      score += 15;
      reasons.push(`Residence ${d.toFixed(1)} km from peak (near hunt zone)`);
    }
  }

  // District overlap with series
  if (offender.district && (series.districts || []).includes(offender.district)) {
    score += 12;
    reasons.push(`Operates in ${offender.district}`);
  }

  // Prolific / risk
  if (offender.tier === 'tier1') { score += 10; reasons.push('Tier-1 prolific offender'); }
  else if (offender.risk >= 70) { score += 6; reasons.push(`High risk score (${offender.risk})`); }

  if (offender.habitual) { score += 5; reasons.push('Habitual offender flag'); }

  return { fit: Math.min(100, score), reasons };
}

function solveSeries(seriesId) {
  const { clusters } = findLinkages({ minCluster: 3, limit: 20 });
  const series = seriesId
    ? clusters.find((c) => c.id === seriesId)
    : clusters[0];
  if (!series) return { error: 'No linkage series available' };

  const geo = profileSeries(series.id);
  if (geo.error) return { error: geo.error };

  const iom = prolificWatchlist({ limit: 80 });
  const suspects = iom.watchlist
    .map((o) => {
      const { fit, reasons } = scoreSuspectFit(o, series, geo.huntZone || geo.peak);
      return {
        id: o.id,
        name: o.name,
        risk: o.risk,
        tier: o.tier,
        cases: o.cases,
        district: o.district,
        modus: o.modus,
        fit,
        reasons,
        lat: o.lat,
        lng: o.lng,
      };
    })
    .filter((s) => s.fit >= 30)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 8);

  const top = suspects[0] || null;

  return {
    chain: 'linkage → Rossmo hunt zone → prolific MO/home fit',
    series: {
      id: series.id,
      label: series.label,
      size: series.size,
      crimeSubHead: series.crimeSubHead,
      stations: series.stations,
      districts: series.districts,
      strength: series.strength,
      cases: series.cases.slice(0, 10),
    },
    huntZone: geo.peak,
    geographic: {
      narrative: geo.peak?.narrative,
      huntZone: geo.huntZone,
      peak: geo.peak,
    },
    suspects,
    verdict: top
      ? {
          summary: `End-to-end lead: ${series.size} linked ${series.crimeSubHead} FIRs across ${series.stations.length} stations → hunt zone ${geo.peak.huntRadiusKm} km near ${geo.peak.nearestStation || geo.peak.nearestDistrict} → top suspect ${top.name} (fit ${top.fit}%).`,
          topSuspect: top,
          ethicsNote: 'Suggested investigative lead only — corroborate with IO inquiry; not an identification or charge recommendation.',
        }
      : {
          summary: `Series linked and hunt zone computed, but no prolific offender currently fits MO + home-zone strongly. Expand canvass within ${geo.peak?.huntRadiusKm} km.`,
          topSuspect: null,
          ethicsNote: 'Geographic lead only — no named suspect suggested.',
        },
    availableSeries: clusters.slice(0, 8).map((c) => ({
      id: c.id, label: c.label, size: c.size, strength: c.strength, crimeSubHead: c.crimeSubHead,
    })),
  };
}

module.exports = { solveSeries, scoreSuspectFit };
