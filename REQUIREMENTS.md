# KSP Crime Intelligence — Requirements Mapping

This document maps the **Datathon challenge requirements** to the implemented platform in `app_build/`.

## Data & Schema (ER Diagram)

| ER Entity | SQLite Table | Status |
|-----------|--------------|--------|
| CaseMaster | `CaseMaster` | ✅ Full schema |
| ComplainantDetails | `ComplainantDetails` | ✅ |
| Victim | `Victim` | ✅ |
| Accused | `Accused` | ✅ |
| ArrestSurrender | `ArrestSurrender` | ✅ |
| ActSectionAssociation | `ActSectionAssociation` | ✅ |
| ChargesheetDetails | `ChargesheetDetails` | ✅ |
| Act / Section | `Act`, `Section` | ✅ |
| CrimeHead / CrimeSubHead | `CrimeHead`, `CrimeSubHead` | ✅ |
| Unit (Police Station) | `Unit` + OSM coords | ✅ |
| Employee, Court, District, State | All masters | ✅ |
| Analytics extensions | `PersonMaster`, `PhoneNumber`, `BankAccount`, `FinancialTransaction` | ✅ |

Schema source: `server/fir/schema.js` — modeled on `Police_FIR_ER_Diagram.pdf`.

---

## 1. Conversational Crime Intelligence Interface

| Requirement | Implementation |
|-------------|----------------|
| NL chatbot (EN + Kannada) | `AssistantView.jsx` + `server/ai/nlToSql.js` |
| FIR / accused / victim / location queries | Offline engine + NL→SQL over full schema |
| Context-aware follow-ups | Session history (last 8 turns) in `routes/chat.js` |
| PDF export | Client-side in `AssistantView.jsx` |
| Voice Q&A | Web Speech API `en-IN` / `kn-IN` |
| Kannada corpus (production) | [OpenSLR SLR126](https://www.openslr.org/126/) + Catalyst Zia |

---

## 2. Criminal Network & Relationship Analysis

| Requirement | Implementation |
|-------------|----------------|
| Accused / victim / location links | `server/graph/networkBuilder.js` |
| Network visualization | `NetworkView.jsx` force graph |
| Gang detection | Union-find on co-accused graph |
| Repeat offender networks | `PersonMaster` cross-FIR identity |

---

## 3. Crime Pattern & Trend Analytics

| Requirement | Implementation |
|-------------|----------------|
| Temporal trends | `/api/fir/temporal` |
| Hotspots | `KarnatakaMap.jsx` + heat layer |
| Crime categories | `/api/fir/categories` |
| Seasonal / event trends | Monthly aggregation + forecast endpoint |

---

## 4. Sociological Crime Insights

| Requirement | Implementation |
|-------------|----------------|
| Age / gender / caste / religion | `/api/fir/demographics` |
| Social risk factors | Caste + occupation breakdowns |
| Urbanization correlation | District-level aggregates on map |

---

## 5. Criminology-Based Offender Profiling

| Requirement | Implementation |
|-------------|----------------|
| Repeat offenders | `PersonMaster.IsHabitualOffender` |
| Behavioral analysis | Case history in ego-network drill-down |
| Risk scoring | `PersonMaster.RiskScore` (0–100) |

---

## 6. Investigator Decision Support

| Requirement | Implementation |
|-------------|----------------|
| Case summaries | FIR detail via chat / `getCaseFull()` |
| Similar cases | Chat follow-ups + co-accused links |
| Investigative leads | Network graph + money trail edges |

---

## 7. Financial Crime & Transaction Link Analysis

| Requirement | Implementation |
|-------------|----------------|
| Suspicious transactions | `FinancialTransaction.IsSuspicious` |
| Money trails | `money` edges in network graph |
| Account networks | `BankAccount` + transaction joins |

---

## 8. Crime Forecasting & Early Warning

| Requirement | Implementation |
|-------------|----------------|
| Emerging patterns | `/api/fir/forecast` (trend projection) |
| Hotspot alerts | Analytics forecast + map clusters |
| Predictive hotspots | District `projected` case counts |

---

## 9. Explainable AI & Transparent Analytics

| Requirement | Implementation |
|-------------|----------------|
| Evidence trails | Every chat response includes `evidence[]` + `sql` |
| Reasoning paths | Expandable SQL/reasoning in Assistant UI |
| Accountability | Query audit trail in session history |

---

## 10. Secure Role-Based Access & Governance

| Requirement | Implementation |
|-------------|----------------|
| RBAC roles | Designed — wire with Catalyst Authentication |
| Audit logs | Session turns + SQL evidence |
| Data protection | Read-only SQL guard (`sqlGuard.js`) |

---

## External Data Sources

| Source | Purpose | Script / File |
|--------|---------|---------------|
| [Overpass Turbo](https://overpass-turbo.eu/) | Karnataka police station points | `npm run fetch:police` |
| [HuggingFace Dataset](https://huggingface.co/datasets/sleepingbeauty11/Datathon_CodeWars) | Crime DB hosting | `server/fir/hfData.js` |
| [OpenSLR 126](https://www.openslr.org/126/) | Kannada ASR training corpus | See DEPLOYMENT.md |

### Overpass query (Karnataka bbox)

```
[out:json][timeout:90];
nwr["amenity"="police"](11.5,74.0,18.6,78.6);
out center;
```

---

## Deployment

| Platform | Path | Catalyst Service |
|----------|------|------------------|
| **Vercel** (demo) | `vercel.json` + `src/app/api/**` | — |
| **Catalyst** (mandatory) | `catalyst/` | Functions, AppSail, QuickML, Zia, Data Store |
| **Local** | `npm run backend` + `npm run serve` | — |

---

## Quick Start

```bash
cd app_build
npm install
npm run fetch:police    # refresh OSM police stations
npm run seed            # build KSP FIR database
npm run prepare:hf      # package for HuggingFace upload
npm run backend         # Terminal 1 — :3000
npm run build && npm run serve  # Terminal 2 — :3001
```
