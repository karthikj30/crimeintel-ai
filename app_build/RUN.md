# 🏃 Running the KSP Crime Intelligence Platform

**No paid APIs. No Anthropic. Runs fully free** on the built-in offline engine.
An optional free LLM upgrade (Ollama / Groq) is at the bottom.

---

## Prerequisites
- **Node.js 20+** (tested on 22) — https://nodejs.org
- A modern browser (Chrome/Edge recommended for voice & Kannada speech)

All commands run from the app folder:
```bash
cd crimeintel-ai/crimescope_ai/app_build
```

---

## Step 1 — Install dependencies
```bash
npm install
```

## Step 2 — Build the crime database (once)
```bash
npm run seed
```
Creates `server/ksp_crime.db` — ~1,200 synthetic Karnataka FIRs on the real KSP FIR
schema, with repeat offenders, co-offending gangs and money trails. Deterministic
(same data every time). Re-run any time to regenerate.

## Step 3 — Start the backend API  →  http://localhost:3000
```bash
npm run backend
```
Leave this terminal running.

## Step 4 — Start the frontend  →  http://localhost:3001  *(new terminal)*
```bash
npm run build
npm run serve
```
Open **http://localhost:3001**.

> **Important:** Keep `npm run backend` running in the other terminal. The production
> frontend (`npm run serve`) proxies `/api/*` requests to Express on `:3000`.
> Without the backend, chat, map, network and analytics will return 500/503 errors.

> **Hot-reload alternative:** `npm run dev` (port 3001). On some Windows setups the
> Turbopack dev server can crash on a slow filesystem — if that happens, use
> `npm run build && npm run serve` (stable production server).

---

## What you'll see
| View | What it does |
|---|---|
| **Assistant** | Ask about FIRs, accused, hotspots, offenders & money links in plain English/Kannada. Evidence trails + SQL, voice, PDF export. |
| **Network** | Criminal network graph, gang detection, offender drill-down. |
| **Map** | Karnataka hotspots — real police stations + FIR heat + district clusters. |
| **Analytics** | Trends, categories, socio-demographics, predicted hotspots, top offenders. |

---

## Optional — free-form conversational AI (still free, no Anthropic)
The Assistant answers a wide set of questions on the **offline engine** with zero setup.
To handle *any* open-ended question, plug in a free OpenAI-compatible LLM by creating
`app_build/.env`:

### Option A — Ollama (100% local, totally free)
```bash
# install Ollama from https://ollama.com, then:
ollama pull llama3.2
```
`.env`:
```
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.2
```

### Option B — Groq (free cloud tier, very fast)
Get a free key at https://console.groq.com — `.env`:
```
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_your_free_key
LLM_MODEL=llama-3.3-70b-versatile
```

Then restart the backend (`npm run backend`). The Assistant's brain badge will show the
model instead of "Offline engine". See `.env.example` for more options (Hugging Face router).

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| A view says *"backend running on :3000?"* | Start `npm run backend`. |
| Port already in use | Stop the old `node`/close the terminal, then retry. |
| Want fresh data | `npm run seed`. |
| Voice button does nothing | Use Chrome or Edge (Web Speech API). |

**Ports:** backend `3000`, frontend `3001` (the frontend proxies `/api` → 3000).
