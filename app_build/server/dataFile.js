// ============================================================
// Locate a bundled reference-data file (server/data/*).
// ------------------------------------------------------------
// Under `npm run backend` the server runs from its own files, so
// __dirname finds them. On Vercel the server is bundled into the
// Next.js API routes, __dirname points inside the bundle, and the
// files are shipped beside the project root instead (see
// outputFileTracingIncludes in next.config.js). Try both.
// ============================================================
const fs = require('fs');
const path = require('path');

function dataFile(name) {
  const candidates = [
    path.join(__dirname, 'data', name),
    path.join(process.cwd(), 'server', 'data', name),
    path.join(process.cwd(), 'app_build', 'server', 'data', name),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

module.exports = { dataFile };
