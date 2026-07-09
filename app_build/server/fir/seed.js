// ============================================================
// KSP CRIME INTELLIGENCE — Seed Runner
//   node server/fir/seed.js           (seed if empty)
//   node server/fir/seed.js --force   (wipe + reseed)
// ============================================================
const fs = require('fs');
const { getFirDb, DB_PATH } = require('./db');
const { generateAndSeed } = require('./generator');

function seedFir(options = {}) {
  const { force = false, ...genOpts } = options;

  if (force) {
    // Remove existing DB files for a clean, deterministic reseed.
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(DB_PATH + suffix); } catch { /* not present */ }
    }
  }

  const db = getFirDb();
  const existing = db.prepare('SELECT COUNT(*) AS c FROM CaseMaster').get().c;
  if (existing > 0 && !force) {
    console.log(`   FIR database already has ${existing} cases. Skipping seed (use --force to reseed).`);
    return { skipped: true, existing };
  }

  const t0 = Date.now();
  const result = generateAndSeed(db, genOpts);
  const ms = Date.now() - t0;

  console.log('   ✓ KSP FIR database seeded in ' + ms + 'ms');
  console.table(result.counts);
  return result;
}

if (require.main === module) {
  seedFir({ force: process.argv.includes('--force') });
  process.exit(0);
}

module.exports = { seedFir };
