# 🛡️ KSP Conversational Crime Intelligence Platform

An intelligent conversational AI + crime-analytics platform for the **Karnataka State
Police (KSP) / State Crime Records Bureau (SCRB)** — query the FIR crime database in plain
language (English/Kannada), uncover criminal networks, and surface predictive/preventive
insights. Built for the KSP Datathon.

---

## ✨ Features

| Area | What it does |
|---|---|
| **Conversational AI** | Natural-language → safe read-only SQL over the FIR database, with **evidence trails** (cited FIR numbers), context-aware follow-ups, and an expandable reasoning/SQL trail. Answers in **English or Kannada**. |
| **Voice** | In-browser speech-to-text & text-to-speech via the Web Speech API (`en-IN` / `kn-IN`). |
| **PDF export** | Save the full conversation history to a PDF locally (Kannada-safe). |
| **Criminal Network** | Force-directed graph of accused ↔ co-accused ↔ shared-phone ↔ money-trail links, **gang-cluster detection**, and an investigator ego-network drill-down (profile, history, associates, accounts). |
| **Hotspot Map** | Karnataka map with **real OSM police stations**, FIR heat layer, and district risk clusters. |
| **Analytics** | Temporal trends, crime categories, case-disposal status, **socio-demographic insights**, time-of-day patterns, **predictive hotspot forecasting**, and risk-scored repeat offenders. |
| **Explainable AI** | Every answer references its data source and the exact query used. |

## 🧠 The AI brain (swappable)

- **Default:** a deterministic **offline intent engine** — zero keys, zero cost, always works.
- **Optional (free):** any OpenAI-compatible LLM for open-ended natural language — **Ollama**
  (100% local), **Groq** (free tier), etc. Configure `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.
- The provider (`server/ai/provider.js`) is abstracted so the reasoning layer can also point at
  **Zoho Catalyst QuickML** without touching the rest of the app. **No proprietary SDK, no paid API.**

## 🗃️ Data

- **Schema:** the real Karnataka Police FIR model (`CaseMaster`, `Accused`, `Victim`,
  `ComplainantDetails`, `ActSectionAssociation`, `ArrestSurrender`, `ChargesheetDetails` + masters),
  plus documented analytics extensions (`PersonMaster`, phones, bank accounts, transactions).
- **Synthetic data:** ~1,200 interconnected FIRs across 16 real Karnataka districts, with repeat
  offenders, co-offending gangs, and money trails — deterministic (seed = 42) so FIR numbers are stable.
- **Real geography:** 333 police stations fetched from **OpenStreetMap / Overpass** (`amenity=police`,
  Karnataka boundary) → `server/data/ksp_police_stations.json`.

## 🏗️ Architecture

```
Next.js 16 frontend (:3001)  ──/api proxy──►  Express + Socket.io backend (:3000)
  Assistant · Network · Map · Analytics            ├─ /api/chat     NL->SQL conversational engine
  (glassmorphism command-center UI)                ├─ /api/network  graph + gang detection
                                                   ├─ /api/fir      geo + analytics
                                                   └─ SQLite (better-sqlite3)  ← KSP FIR schema
```

## 🚀 Run locally

```bash
cd app_build
npm install
npm run seed          # build the KSP FIR database (once)

# Terminal 1 — backend API on :3000
npm run backend

# Terminal 2 — frontend
npm run build && npm run serve   # stable production server on :3001
#   (or `npm run dev` for hot-reload)
```

Open **http://localhost:3001**.

### Enable free-form AI (optional, free)
```bash
cp .env.example .env      # set a FREE LLM: Ollama (local) or Groq (free tier)
npm run backend           # restart
```
Without any config the platform runs fully on the offline engine. See **RUN.md**.

## 🔌 API (backend :3000, proxied under `/api`)

```
POST /api/chat                 ask a question (context-aware)
GET  /api/chat/status          which brain is active
GET  /api/chat/:id             conversation history (PDF export source)
GET  /api/network/graph        entity-link graph (nodes + edges)
GET  /api/network/gangs        detected gang clusters
GET  /api/network/person/:id   ego network + offender profile
GET  /api/fir/stations         real Karnataka police stations
GET  /api/fir/heatmap          FIR incident points
GET  /api/fir/districts        district aggregates
GET  /api/fir/{overview|temporal|categories|demographics|hourly|forecast|offenders}
```

## 🌐 Kannada & voice

In-browser voice + the EN/ಕನ್ನಡ toggle work with no setup. For production-grade Kannada ASR/TTS,
see **DEPLOYMENT.md → Kannada** (AI4Bharat IndicVoices, OpenSLR SLR126, Bhashini).

## ☁️ Deployment

See **DEPLOYMENT.md** for the Vercel + Hugging Face path and the Zoho Catalyst service mapping.

---
*Built for the Karnataka State Police Datathon — a safer, smarter Karnataka.*
