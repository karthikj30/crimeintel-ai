# Deployment Guide — KSP Crime Intelligence

The app runs as **Next.js 16** with integrated API routes for Vercel, plus an optional
**Express + Socket.io** backend for local development with hot WebSocket features.

---

## Option A — Hugging Face (data) + Vercel (demo)   ← implemented

### Architecture
- **Frontend + API:** Next.js `src/app/api/**` route handlers (no separate Express on Vercel)
- **Database:** `sql.js` (WASM SQLite) loads `ksp_crime.db` from HuggingFace at cold start
- **Data repo:** [sleepingbeauty11/Datathon_CodeWars](https://huggingface.co/datasets/sleepingbeauty11/Datathon_CodeWars)

### Deploy to Vercel
```bash
# From repo root (vercel.json points rootDirectory to app_build)
vercel --prod
```

### Environment variables (Vercel dashboard)
| Var | Value |
|-----|-------|
| `HF_DATASET_REPO` | `sleepingbeauty11/Datathon_CodeWars` |
| `HF_DATASET_FILE` | `ksp_crime.db` |
| `LLM_BASE_URL` | (optional) Groq / HF router for open-ended AI |
| `LLM_API_KEY` | (optional) |
| `LLM_MODEL` | (optional) e.g. `llama-3.3-70b-versatile` |

### Upload / refresh the HuggingFace dataset
```bash
cd app_build
npm run seed
npm run fetch:police      # refresh OSM police stations (Overpass)
npm run prepare:hf        # creates hf_upload/ bundle
# Upload hf_upload/* to your HF dataset repo
```

### Local dev (two-process mode with WebSocket)
```bash
npm run backend           # Express :3000 (proxied in dev)
npm run dev               # Next.js :3001
```
On Vercel, `next.config.js` skips the proxy — API routes run in-process.

---

## Option B — Zoho Catalyst   (mandatory per the challenge)

Deployment config lives in `catalyst/` at the repo root.

| App component | Catalyst service | File |
|---|---|---|
| API (`/api/chat`, `/api/network`, `/api/fir`) | **Serverless Functions** | `catalyst/functions/api/index.js` |
| Next.js frontend | **AppSail** (managed Node) | `catalyst/catalyst.json` |
| FIR database | **Data Store** (or HF dataset via `hfData.js`) | `server/fir/schema.js` |
| NL→SQL / RAG | **QuickML** LLM Serving | `server/ai/provider.js` |
| Kannada STT/TTS | **Zia Services** | See Kannada section below |
| PDF export | **SmartBrowz** | client-side fallback in Assistant |
| Auth / RBAC | **Authentication** + **API Gateway** | planned |
| Scheduled jobs | **Cron** | hotspot early-warning |

```bash
# Install Catalyst CLI, then from catalyst/ directory:
catalyst deploy
```

Set `CATALYST_ENV=1` and `HF_DATASET_REPO` so functions load data from HuggingFace.

> Use HF for dataset storage; deploy compute on Catalyst for the official submission.

---

## Option C — Docker (self-host, or Catalyst AppSail custom runtime)

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY app_build/package*.json ./
RUN npm ci
COPY app_build/ ./
RUN node server/fir/seed.js --force && npm run build
EXPOSE 3000 3001
CMD ["sh","-c","node server/index.js & npm run serve"]
```

---

## Kannada (ASR / TTS / NLU)

- **In-browser (already implemented):** Web Speech API `kn-IN` for STT/TTS + the EN/ಕನ್ನಡ toggle;
  the LLM is instructed to answer in the question's language.
- **Production ASR corpus:** **OpenSLR SLR126** (Kannada) and **AI4Bharat IndicVoices**
  (`ai4bharat/IndicVoices`) for fine-tuning a domain Kannada model.
- **Managed Indian-language speech/translation:** **Bhashini** (Govt. of India) or Catalyst Zia.
- **Pipeline:** Kannada voice/text → (ASR / IndicTrans2 translate) → NL→SQL → answer →
  (Kannada TTS) → spoken reply.

---

## Governance / RBAC (designed, next to wire)

Roles — **Investigator, Analyst, Supervisor, Policymaker** — gate views and query scope, with an
**audit log** of every query + evidence trail (the explainable-AI evidence is already in place).
Implement with Catalyst Authentication + API Gateway (Option B) or NextAuth (Option A).

## Environment variables

| Var | Purpose |
|---|---|
| `LLM_BASE_URL` | OpenAI-compatible endpoint for a **free** LLM (Ollama/Groq/HF). Unset = offline engine |
| `LLM_API_KEY` | Key for the above (`ollama` for local Ollama) |
| `LLM_MODEL` | Model id (e.g. `llama3.2`, `llama-3.3-70b-versatile`) |
| `PORT` | Backend port (default 3000) |
