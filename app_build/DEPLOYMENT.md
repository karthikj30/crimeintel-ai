# Deployment Guide — KSP Crime Intelligence

The app currently runs as **two processes**: a Next.js 16 frontend (`:3001`) and an Express +
SQLite backend (`:3000`), with the frontend proxying `/api/*` to the backend
(`next.config.js` → `rewrites`). Below are the paths to production.

---

## Option A — Hugging Face (data) + Vercel (demo)   ← your plan

Vercel is serverless, so the standalone Express server and the native `better-sqlite3` module
won't run there as-is. Two changes make it Vercel-native:

1. **Port the API to Next.js Route Handlers.** Move each Express route to
   `src/app/api/**/route.js` (e.g. `src/app/api/chat/route.js`). The query/AI logic in
   `server/fir/*` and `server/ai/*` is plain Node and can be imported directly — only the
   Express `router` wrappers get replaced. Then `next.config.js` needs **no** proxy rewrite.
2. **Serverless-friendly data access.** `better-sqlite3` is a native addon; on Vercel use one of:
   - **`sql.js` (SQLite compiled to WASM)** — bundle `ksp_crime.db` (or load it from a Hugging
     Face dataset URL at cold start) and query it in-memory. Best fit for the NL→SQL engine.
   - Precomputed **static JSON** for the analytics/graph endpoints (they're read-only aggregates).

**Hugging Face as the data store.** Host the seed database / derived JSON as a HF **dataset**
(e.g. `sleepingbeauty11/Datathon_CodeWars`). At cold start, fetch the file from
`https://huggingface.co/datasets/<user>/<repo>/resolve/main/<file>` into memory. Regenerate the
dataset any time with `npm run seed` and push it to the HF repo.

**Vercel env vars (all optional):** `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `HF_DATASET_URL` (if loading data from HF). No Anthropic key needed.

> This port is the main remaining deployment task — the query/AI/graph/analytics logic is already
> framework-agnostic, so it's a mechanical move of ~6 route files into `app/api/`.

---

## Option B — Zoho Catalyst   (mandatory per the challenge)

The challenge mandates Catalyst deployment. The architecture maps cleanly:

| App component | Catalyst service |
|---|---|
| Express API routes (`/api/chat`, `/api/network`, `/api/fir`) | **Catalyst Serverless (Functions)** or **AppSail** (managed Node runtime) |
| Next.js frontend | **Catalyst Web Client Hosting** / **Slate** |
| FIR relational database (SQLite) | **Catalyst Data Store** (relational; the schema ports directly) |
| Conversational NL→SQL / RAG brain | **Catalyst QuickML** (LLM Serving / RAG) — swap in via `server/ai/provider.js` |
| Kannada speech (STT/TTS) + translation | **Catalyst Zia Services** (speech, translation) |
| PDF conversation export | **Catalyst SmartBrowz** (server-side) or the current client-side export |
| Auth / RBAC | **Catalyst Authentication** + **API Gateway** |
| Object storage (datasets, exports) | **Catalyst Stratus** |
| Scheduled hotspot/early-warning jobs | **Catalyst Cron** |

`provider.js` already isolates the LLM call, so pointing the brain at QuickML is a config change.

> **Note on the conflict:** the datathon lists Catalyst as *mandatory*. Hugging Face + Vercel is
> great for a fast public demo mirror, but confirm whether the official submission must run on
> Catalyst — if so, use HF only for dataset storage and deploy compute on Catalyst.

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
