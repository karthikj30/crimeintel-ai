#!/usr/bin/env node
// ============================================================
// Prepare dataset files for HuggingFace upload
// ------------------------------------------------------------
// After seeding, packages ksp_crime.db + police stations JSON
// into hf_upload/ with a README for the HF dataset repo.
//
// Usage:
//   npm run seed && npm run prepare:hf
//   # Then upload hf_upload/* to sleepingbeauty11/Datathon_CodeWars
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'hf_upload');
const DB = path.join(ROOT, 'server', 'ksp_crime.db');
const STATIONS = path.join(ROOT, 'server', 'data', 'ksp_police_stations.json');

function main() {
  if (!fs.existsSync(DB)) {
    console.error('  ✗ ksp_crime.db not found. Run: npm run seed');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(DB, path.join(OUT, 'ksp_crime.db'));

  if (fs.existsSync(STATIONS)) {
    fs.copyFileSync(STATIONS, path.join(OUT, 'ksp_police_stations.json'));
  }

  const readme = `# Datathon_CodeWars — KSP Crime Intelligence Dataset

Karnataka State Police FIR crime database for the CrimeScope AI platform.

## Files

| File | Description |
|------|-------------|
| \`ksp_crime.db\` | SQLite database — full KSP FIR ER schema (~1,200 synthetic FIRs) |
| \`ksp_police_stations.json\` | Real Karnataka police stations from OpenStreetMap (Overpass) |

## Schema

Based on the Karnataka Police FIR System ER diagram:
\`CaseMaster\`, \`Accused\`, \`Victim\`, \`ComplainantDetails\`, \`ArrestSurrender\`,
\`ActSectionAssociation\`, \`ChargesheetDetails\` + lookup masters.

Analytics extensions: \`PersonMaster\`, \`PhoneNumber\`, \`BankAccount\`, \`FinancialTransaction\`.

## Usage

\`\`\`
HF_DATASET_REPO=sleepingbeauty11/Datathon_CodeWars
HF_DATASET_FILE=ksp_crime.db
\`\`\`

Fetched at cold start by Vercel/Catalyst serverless functions.

## Regenerate

\`\`\`bash
cd app_build
npm run seed
npm run fetch:police
npm run prepare:hf
\`\`\`

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(OUT, 'README.md'), readme, 'utf8');

  const stats = fs.statSync(path.join(OUT, 'ksp_crime.db'));
  console.log(`  ✓ Prepared HF upload bundle in ${OUT}`);
  console.log(`    ksp_crime.db — ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('  Upload to: https://huggingface.co/datasets/sleepingbeauty11/Datathon_CodeWars');
}

main();
