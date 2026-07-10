// ============================================================
// HuggingFace Dataset Loader
// ------------------------------------------------------------
// Fetches the KSP crime SQLite database and auxiliary JSON from
// the HuggingFace dataset repo (sleepingbeauty11/Datathon_CodeWars).
// Used by Vercel serverless routes and Catalyst Functions at cold start.
//
// Env:
//   HF_DATASET_REPO   default: sleepingbeauty11/Datathon_CodeWars
//   HF_DATASET_FILE   default: ksp_crime.db
//   HF_TOKEN          optional (for private repos)
// ============================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_REPO = 'sleepingbeauty11/Datathon_CodeWars';
const DEFAULT_DB_FILE = 'ksp_crime.db';
const DEFAULT_STATIONS_FILE = 'ksp_police_stations.json';

let cachedDbBuffer = null;
let cachedStations = null;

function hfResolveUrl(repo, file, revision = 'main') {
  return `https://huggingface.co/datasets/${repo}/resolve/${revision}/${file}`;
}

function httpGetBuffer(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const proto = u.startsWith('https') ? https : require('http');
      proto.get(u, { headers }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} fetching ${u}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    };
    follow(url);
  });
}

function authHeaders() {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchDbFromHF(options = {}) {
  if (cachedDbBuffer) return cachedDbBuffer;

  const repo = options.repo || process.env.HF_DATASET_REPO || DEFAULT_REPO;
  const file = options.file || process.env.HF_DATASET_FILE || DEFAULT_DB_FILE;
  const url = options.url || process.env.HF_DATASET_URL || hfResolveUrl(repo, file);

  console.log(`  [HF] Fetching ${file} from ${repo}…`);
  const buf = await httpGetBuffer(url, authHeaders());
  cachedDbBuffer = buf;
  return buf;
}

async function fetchStationsFromHF(options = {}) {
  if (cachedStations) return cachedStations;

  const repo = options.repo || process.env.HF_DATASET_REPO || DEFAULT_REPO;
  const file = options.stationsFile || DEFAULT_STATIONS_FILE;
  const url = hfResolveUrl(repo, file);

  try {
    const buf = await httpGetBuffer(url, authHeaders());
    const json = JSON.parse(buf.toString('utf8'));
    cachedStations = Array.isArray(json) ? json : (json.stations || json);
    return cachedStations;
  } catch {
    // Fall back to local file
    const local = path.join(__dirname, '..', 'data', 'ksp_police_stations.json');
    if (fs.existsSync(local)) {
      const json = JSON.parse(fs.readFileSync(local, 'utf8'));
      cachedStations = Array.isArray(json) ? json : (json.stations || json);
      return cachedStations;
    }
    return [];
  }
}

async function saveDbLocally(targetPath) {
  const buf = await fetchDbFromHF();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buf);
  return targetPath;
}

module.exports = {
  DEFAULT_REPO,
  DEFAULT_DB_FILE,
  hfResolveUrl,
  fetchDbFromHF,
  fetchStationsFromHF,
  saveDbLocally,
};
