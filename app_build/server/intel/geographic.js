// ============================================================
// 2. Geographic Offender Profiling — Rossmo's formula
// Hunt zone = smallest top-probability cells covering ~10% mass
// ============================================================
const { getFirDb } = require('../fir/db');
const { haversineKm } = require('./helpers');
const { findLinkages } = require('./linkage');

/**
 * Rossmo (1995) criminal geographic targeting:
 * P(x) ∝ Σ_i  φ / d_i^f          when d_i > B
 *         (1-φ)(B^{f-g})/(2B-d)^g when d_i ≤ B
 */
function rossmoPoint(gx, gy, crimes, { B = 0.5, f = 1.2, g = 1.2, phi = 0.5 } = {}) {
  let p = 0;
  for (const c of crimes) {
    const dLat = (gx - c.lat) * 111.32;
    const dLng = (gy - c.lng) * 111.32 * Math.cos((c.lat * Math.PI) / 180);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d < 0.05) continue;
    if (d > B) p += phi / (d ** f);
    else p += ((1 - phi) * (B ** (f - g))) / ((2 * B - d) ** g);
  }
  return p;
}

function buildSurface(crimes, opts = {}) {
  if (!crimes.length) return { grid: [], peak: null, crimes: [], huntZone: null };

  const pad = opts.pad ?? 0.022;
  const lats = crimes.map((c) => c.lat);
  const lngs = crimes.map((c) => c.lng);
  // Shrink study area around crime centroid when crimes span > ~8 km
  // (keeps Rossmo peak local instead of city-wide for multi-station series)
  const centroid = {
    lat: lats.reduce((s, v) => s + v, 0) / lats.length,
    lng: lngs.reduce((s, v) => s + v, 0) / lngs.length,
  };
  const spanKm = Math.max(
    haversineKm(Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)),
    1,
  );
  let minLat = Math.min(...lats) - pad;
  let maxLat = Math.max(...lats) + pad;
  let minLng = Math.min(...lngs) - pad;
  let maxLng = Math.max(...lngs) + pad;
  if (spanKm > 8) {
    const window = opts.windowDeg ?? 0.04; // ~4.4 km
    minLat = centroid.lat - window;
    maxLat = centroid.lat + window;
    minLng = centroid.lng - window;
    maxLng = centroid.lng + window;
  }

  const steps = opts.steps || 32;
  const grid = [];
  let peak = { lat: 0, lng: 0, p: -1 };

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lat = minLat + (i / steps) * (maxLat - minLat);
      const lng = minLng + (j / steps) * (maxLng - minLng);
      const p = rossmoPoint(lat, lng, crimes, opts);
      grid.push({ lat, lng, p });
      if (p > peak.p) peak = { lat, lng, p };
    }
  }

  const maxP = peak.p || 1;
  for (const cell of grid) cell.intensity = cell.p / maxP;

  // Hunt zone: smallest set of top cells *near the peak* covering ~10% of probability mass.
  // Restricting to a local window keeps multi-station series from reporting city-scale radii.
  const sorted = [...grid].sort((a, b) => b.intensity - a.intensity);
  const total = sorted.reduce((s, c) => s + c.intensity, 0) || 1;
  const massTarget = opts.huntMass ?? 0.10;
  const localKm = opts.localKm ?? 5;
  const local = sorted.filter((c) => haversineKm(peak.lat, peak.lng, c.lat, c.lng) <= localKm);
  const pool = local.length >= 8 ? local : sorted;

  let cum = 0;
  const huntCells = [];
  for (const cell of pool) {
    huntCells.push(cell);
    cum += cell.intensity;
    if (cum / total >= massTarget) break;
    if (huntCells.length >= 24) break; // hard cap — actionable neighbourhood
  }

  // Radius = median distance of hunt cells to peak (robust vs outliers), then clamp 0.6–3 km
  const dists = huntCells
    .map((c) => haversineKm(peak.lat, peak.lng, c.lat, c.lng))
    .sort((a, b) => a - b);
  const mid = dists[Math.floor(dists.length / 2)] || 0.8;
  let huntRadiusKm = Math.min(3.0, Math.max(0.6, mid * 1.35 || 0.8));

  const huntAreaKm2 = +(Math.PI * huntRadiusKm * huntRadiusKm).toFixed(1);
  const massPct = Math.round((cum / total) * 100);

  const db = getFirDb();
  const districts = db.prepare(`
    SELECT DistrictName name, AVG(c.latitude) lat, AVG(c.longitude) lng
    FROM CaseMaster c JOIN Unit u ON u.UnitID=c.PoliceStationID
    JOIN District d ON d.DistrictID=u.DistrictID
    WHERE c.latitude IS NOT NULL GROUP BY d.DistrictName`).all();
  let nearest = null; let bestD = Infinity;
  for (const d of districts) {
    const dist = haversineKm(peak.lat, peak.lng, d.lat, d.lng);
    if (dist < bestD) { bestD = dist; nearest = d.name; }
  }

  // Nearest police station to peak
  let nearestStation = null;
  try {
    const stations = JSON.parse(
      require('fs').readFileSync(require('../dataFile').dataFile('ksp_police_stations.json'), 'utf8'),
    );
    const list = Array.isArray(stations) ? stations : (stations.stations || []);
    let best = Infinity;
    for (const s of list) {
      const d = haversineKm(peak.lat, peak.lng, s.lat, s.lon ?? s.lng);
      if (d < best) { best = d; nearestStation = s.name; }
    }
  } catch { /* optional */ }

  return {
    method: "Rossmo's Criminal Geographic Targeting (CGT) — hunt zone = top ~10% probability mass",
    peak: {
      lat: +peak.lat.toFixed(5),
      lng: +peak.lng.toFixed(5),
      huntRadiusKm: +huntRadiusKm.toFixed(2),
      huntAreaKm2,
      massPct,
      nearestDistrict: nearest,
      nearestStation,
      narrative: `Hunt zone: ~${huntRadiusKm.toFixed(1)} km radius (${huntAreaKm2} km²) around [${peak.lat.toFixed(4)}, ${peak.lng.toFixed(4)}]${nearestStation ? ` near ${nearestStation}` : nearest ? ` near ${nearest}` : ''} — top ${massPct}% of the Rossmo probability mass. Narrows the manhunt from city-scale to a neighbourhood.`,
    },
    huntZone: {
      center: { lat: +peak.lat.toFixed(5), lng: +peak.lng.toFixed(5) },
      radiusKm: +huntRadiusKm.toFixed(2),
      areaKm2: huntAreaKm2,
      cells: huntCells.length,
    },
    bounds: { minLat, maxLat, minLng, maxLng },
    grid: grid.filter((c) => c.intensity > 0.12).map((c) => ({
      lat: +c.lat.toFixed(5),
      lng: +c.lng.toFixed(5),
      intensity: +c.intensity.toFixed(3),
      inHuntZone: huntCells.includes(c),
    })),
    crimes: crimes.map((c) => ({
      CrimeNo: c.CrimeNo,
      lat: c.lat,
      lng: c.lng,
      station: c.station,
      date: c.date,
      subhead: c.subhead,
    })),
  };
}

function profileSeries(seriesId) {
  const { clusters } = findLinkages({ minCluster: 3, limit: 20 });
  let cluster = seriesId
    ? clusters.find((c) => c.id === seriesId)
    : clusters[0];
  if (!cluster) {
    const db = getFirDb();
    const rows = db.prepare(`
      SELECT c.CrimeNo, c.latitude lat, c.longitude lng, u.UnitName station,
             c.CrimeRegisteredDate date, sh.CrimeHeadName subhead
      FROM CaseMaster c
      JOIN Unit u ON u.UnitID=c.PoliceStationID
      JOIN CrimeSubHead sh ON sh.CrimeSubHeadID=c.CrimeMinorHeadID
      WHERE c.latitude IS NOT NULL AND sh.CrimeHeadName LIKE '%Theft%'
      ORDER BY c.CrimeRegisteredDate DESC LIMIT 8`).all();
    if (rows.length < 3) return { error: 'Need at least 3 linked crime locations' };
    return { series: { id: 'ad-hoc-theft', label: 'Recent theft series (ad-hoc)', size: rows.length }, ...buildSurface(rows) };
  }
  const crimes = cluster.cases.filter((c) => c.lat != null);
  return {
    series: {
      id: cluster.id,
      label: cluster.label,
      size: cluster.size,
      crimeSubHead: cluster.crimeSubHead,
      stations: cluster.stations,
      strength: cluster.strength,
    },
    availableSeries: clusters.slice(0, 8).map((c) => ({
      id: c.id, label: c.label, size: c.size, strength: c.strength, crimeSubHead: c.crimeSubHead,
    })),
    ...buildSurface(crimes),
  };
}

module.exports = { profileSeries, buildSurface };
