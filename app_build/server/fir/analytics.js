// ============================================================
// KSP CRIME INTELLIGENCE — Analytics & Geospatial Queries
// Powers the Karnataka hotspot map and the analytics dashboards.
// Uses real OSM police-station coordinates + the FIR database.
// ============================================================

const fs = require('fs');
const path = require('path');
const { getFirDb } = require('./db');

function resolveDb(dbIn) {
  return dbIn || getFirDb();
}

let STATIONS = null;
function loadStationsJson() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ksp_police_stations.json'), 'utf8'));
    return Array.isArray(raw) ? raw : (raw.stations || []);
  } catch {
    return [];
  }
}
function stations() {
  if (!STATIONS) {
    STATIONS = loadStationsJson().map((s) => ({
      name: s.name,
      lat: s.lat,
      lon: s.lon ?? s.lng,
      nameKn: s.nameKn || null,
      osmId: s.osmId || null,
    }));
  }
  return STATIONS;
}

// FIR incident points for the heat layer.
function heatmapPoints(dbIn) {
  return resolveDb(dbIn).prepare(`
    SELECT ROUND(c.latitude, 5) lat, ROUND(c.longitude, 5) lng,
           h.CrimeGroupName head, g.LookupValue gravity
    FROM CaseMaster c
    LEFT JOIN CrimeHead h ON h.CrimeHeadID = c.CrimeMajorHeadID
    LEFT JOIN GravityOffence g ON g.GravityOffenceID = c.GravityOffenceID
    WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`).all();
}

// District-level aggregates with a centroid for map circles.
function districtAgg(dbIn) {
  return resolveDb(dbIn).prepare(`
    SELECT d.DistrictName district, COUNT(*) cases,
           ROUND(AVG(c.latitude), 5) lat, ROUND(AVG(c.longitude), 5) lng,
           SUM(CASE WHEN c.GravityOffenceID = 1 THEN 1 ELSE 0 END) heinous
    FROM CaseMaster c
    JOIN Unit u ON u.UnitID = c.PoliceStationID
    JOIN District d ON d.DistrictID = u.DistrictID
    GROUP BY d.DistrictName ORDER BY cases DESC`).all();
}

function temporal(dbIn) {
  return resolveDb(dbIn).prepare(`
    SELECT substr(CrimeRegisteredDate, 1, 7) month, COUNT(*) cases,
           SUM(CASE WHEN GravityOffenceID = 1 THEN 1 ELSE 0 END) heinous
    FROM CaseMaster WHERE CrimeRegisteredDate >= date('now', '-24 months')
    GROUP BY month ORDER BY month`).all();
}

function categories(dbIn) {
  const db = resolveDb(dbIn);
  return {
    heads: db.prepare(`SELECT h.CrimeGroupName name, COUNT(*) value
      FROM CaseMaster c JOIN CrimeHead h ON h.CrimeHeadID = c.CrimeMajorHeadID
      GROUP BY name ORDER BY value DESC`).all(),
    subheads: db.prepare(`SELECT sh.CrimeHeadName name, COUNT(*) value
      FROM CaseMaster c JOIN CrimeSubHead sh ON sh.CrimeSubHeadID = c.CrimeMinorHeadID
      GROUP BY name ORDER BY value DESC LIMIT 12`).all(),
    status: db.prepare(`SELECT st.CaseStatusName name, COUNT(*) value
      FROM CaseMaster c JOIN CaseStatusMaster st ON st.CaseStatusID = c.CaseStatusID
      GROUP BY name ORDER BY value DESC`).all(),
  };
}

// Socio-demographic insight (offenders via canonical PersonMaster).
function demographics(dbIn) {
  const db = resolveDb(dbIn);
  const q = (sql) => db.prepare(sql).all();
  return {
    byCaste: q(`SELECT ca.caste_master_name name, COUNT(*) value
      FROM Accused a JOIN PersonMaster p ON p.PersonMasterID = a.PersonMasterID
      JOIN CasteMaster ca ON ca.caste_master_id = p.CasteID GROUP BY name ORDER BY value DESC`),
    byReligion: q(`SELECT rl.ReligionName name, COUNT(*) value
      FROM Accused a JOIN PersonMaster p ON p.PersonMasterID = a.PersonMasterID
      JOIN ReligionMaster rl ON rl.ReligionID = p.ReligionID GROUP BY name ORDER BY value DESC`),
    byOccupation: q(`SELECT o.OccupationName name, COUNT(*) value
      FROM Accused a JOIN PersonMaster p ON p.PersonMasterID = a.PersonMasterID
      JOIN OccupationMaster o ON o.OccupationID = p.OccupationID GROUP BY name ORDER BY value DESC LIMIT 8`),
    byAge: q(`SELECT (CASE WHEN AgeYear < 18 THEN '<18' WHEN AgeYear < 26 THEN '18-25'
        WHEN AgeYear < 36 THEN '26-35' WHEN AgeYear < 46 THEN '36-45'
        WHEN AgeYear < 60 THEN '46-59' ELSE '60+' END) name, COUNT(*) value
      FROM Accused WHERE AgeYear IS NOT NULL GROUP BY name`),
    byGender: q(`SELECT (CASE GenderID WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Other' END) name, COUNT(*) value
      FROM Accused GROUP BY name`),
  };
}

// Time-of-day distribution (from incident datetime).
function hourly(dbIn) {
  return resolveDb(dbIn).prepare(`
    SELECT CAST(substr(IncidentFromDate, 12, 2) AS INTEGER) hour, COUNT(*) cases
    FROM CaseMaster WHERE IncidentFromDate IS NOT NULL
    GROUP BY hour ORDER BY hour`).all();
}

// Predictive-style next-month projection per district (simple moving trend).
function forecast(dbIn) {
  const rows = resolveDb(dbIn).prepare(`
    SELECT d.DistrictName district, substr(c.CrimeRegisteredDate, 1, 7) month, COUNT(*) cases
    FROM CaseMaster c JOIN Unit u ON u.UnitID = c.PoliceStationID JOIN District d ON d.DistrictID = u.DistrictID
    WHERE c.CrimeRegisteredDate >= date('now', '-4 months')
    GROUP BY district, month`).all();
  const byDist = {};
  for (const r of rows) (byDist[r.district] ||= []).push(r.cases);
  return Object.entries(byDist).map(([district, series]) => {
    const avg = series.reduce((a, b) => a + b, 0) / series.length;
    const trend = series.length > 1 ? series[series.length - 1] - series[0] : 0;
    return { district, projected: Math.max(0, Math.round(avg + trend * 0.3)), recentAvg: Math.round(avg) };
  }).sort((a, b) => b.projected - a.projected).slice(0, 8);
}

function offenders(dbIn) {
  return resolveDb(dbIn).prepare(`
    SELECT p.FullName name, p.RiskScore risk, d.DistrictName district,
           COUNT(a.CaseMasterID) cases,
           SUM(CASE WHEN c.GravityOffenceID = 1 THEN 1 ELSE 0 END) heinous
    FROM PersonMaster p JOIN Accused a ON a.PersonMasterID = p.PersonMasterID
    JOIN CaseMaster c ON c.CaseMasterID = a.CaseMasterID
    LEFT JOIN District d ON d.DistrictID = p.DistrictID
    WHERE p.IsHabitualOffender = 1
    GROUP BY p.PersonMasterID ORDER BY risk DESC, cases DESC LIMIT 12`).all();
}

module.exports = { stations, heatmapPoints, districtAgg, temporal, categories, demographics, hourly, forecast, offenders };
