# Datathon_CodeWars — KSP Crime Intelligence Dataset

Karnataka State Police FIR crime database for the CrimeScope AI platform.

## Files

| File | Description |
|------|-------------|
| `ksp_crime.db` | SQLite database — full KSP FIR ER schema (~1,200 synthetic FIRs) |
| `ksp_police_stations.json` | Real Karnataka police stations from OpenStreetMap (Overpass) |

## Schema

Based on the Karnataka Police FIR System ER diagram:
`CaseMaster`, `Accused`, `Victim`, `ComplainantDetails`, `ArrestSurrender`,
`ActSectionAssociation`, `ChargesheetDetails` + lookup masters.

Analytics extensions: `PersonMaster`, `PhoneNumber`, `BankAccount`, `FinancialTransaction`.

## Usage

```
HF_DATASET_REPO=sleepingbeauty11/Datathon_CodeWars
HF_DATASET_FILE=ksp_crime.db
```

Fetched at cold start by Vercel/Catalyst serverless functions.

## Regenerate

```bash
cd app_build
npm run seed
npm run fetch:police
npm run prepare:hf
```

Generated: 2026-07-10T08:19:17.266Z
