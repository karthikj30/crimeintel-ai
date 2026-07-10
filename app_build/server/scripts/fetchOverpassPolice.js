#!/usr/bin/env node
// ============================================================
// Fetch Karnataka police stations from OpenStreetMap via Overpass
// ------------------------------------------------------------
// Uses the same query as overpass-turbo.eu:
//   nwr["amenity"="police"]({{bbox}});
//
// Karnataka bounding box (south, west, north, east):
//   11.5, 74.0, 18.6, 78.6
//
// Usage:
//   node server/scripts/fetchOverpassPolice.js
//   npm run fetch:police
// ============================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const KARNATAKA_BBOX = '11.5,74.0,18.6,78.6';
const OUT_PATH = path.join(__dirname, '..', 'data', 'ksp_police_stations.json');

const OVERPASS_QUERY = `
[out:json][timeout:90];
(
  nwr["amenity"="police"](${KARNATAKA_BBOX});
);
out center;
`.trim();

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function postOverpass(query) {
  return new Promise((resolve, reject) => {
    const tryEndpoint = (idx) => {
      if (idx >= OVERPASS_ENDPOINTS.length) {
        return reject(new Error('All Overpass endpoints failed'));
      }
      const endpoint = new URL(OVERPASS_ENDPOINTS[idx]);
      const body = `data=${encodeURIComponent(query)}`;
      const req = https.request({
        hostname: endpoint.hostname,
        path: endpoint.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'KSP-CrimeIntel/1.0 (overpass-turbo compatible)',
        },
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.warn(`  Overpass ${endpoint.hostname} returned ${res.statusCode}, trying next…`);
            return tryEndpoint(idx + 1);
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON from Overpass: ${e.message}`));
          }
        });
      });
      req.on('error', () => tryEndpoint(idx + 1));
      req.setTimeout(180000, () => { req.destroy(); tryEndpoint(idx + 1); });
      req.write(body);
      req.end();
    };
    tryEndpoint(0);
  });
}

function elementToStation(el) {
  const tags = el.tags || {};
  const name = tags.name || tags['name:en'] || tags['name:kn'] || 'Police Station';
  let lat = el.lat;
  let lon = el.lon;
  if (lat == null && el.center) {
    lat = el.center.lat;
    lon = el.center.lon;
  }
  if (lat == null || lon == null) return null;
  return {
    osmId: `${el.type}/${el.id}`,
    name,
    nameKn: tags['name:kn'] || null,
    lat: +lat.toFixed(6),
    lon: +lon.toFixed(6),
    operator: tags.operator || null,
    addr: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || null,
  };
}

async function main() {
  console.log('  Fetching Karnataka police stations from Overpass API…');
  console.log(`  Bbox: ${KARNATAKA_BBOX}`);
  console.log('  Query: nwr["amenity"="police"](bbox);');

  const json = await postOverpass(OVERPASS_QUERY);
  const elements = json.elements || [];
  const stations = elements
    .map(elementToStation)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  // De-dupe very close points (same name within ~50m)
  const seen = new Set();
  const unique = [];
  for (const s of stations) {
    const key = `${s.name.toLowerCase()}|${s.lat.toFixed(3)}|${s.lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }

  const payload = {
    source: 'OpenStreetMap / Overpass API',
    query: 'nwr["amenity"="police"](bbox)',
    bbox: KARNATAKA_BBOX,
    fetchedAt: new Date().toISOString(),
    count: unique.length,
    stations: unique,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`  ✓ Wrote ${unique.length} stations → ${OUT_PATH}`);

  // Also write a flat array for backward compatibility with analytics.js
  const flatPath = path.join(__dirname, '..', 'data', 'ksp_police_stations_flat.json');
  const flat = unique.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon }));
  fs.writeFileSync(flatPath, JSON.stringify(flat, null, 2), 'utf8');
  console.log(`  ✓ Flat array (${flat.length}) → ${flatPath}`);
}

main().catch((e) => {
  console.error('  ✗ Overpass fetch failed:', e.message);
  if (fs.existsSync(OUT_PATH)) {
    console.log(`  ℹ Keeping existing ${OUT_PATH}`);
    process.exit(0);
  }
  process.exit(1);
});
