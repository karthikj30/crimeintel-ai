// ============================================================
// KSP CRIME INTELLIGENCE — AI Provider (free / OpenAI-compatible)
// ------------------------------------------------------------
// The reasoning "brain" behind the conversational assistant.
//
//   * DEFAULT: no configuration -> the deterministic OFFLINE engine
//     runs (zero keys, zero cost, fully free).
//   * OPTIONAL: set LLM_BASE_URL / LLM_API_KEY / LLM_MODEL to any
//     OpenAI-compatible endpoint for free-form natural language:
//       - Ollama  (100% local & free): http://localhost:11434/v1
//       - Groq    (free cloud tier)   : https://api.groq.com/openai/v1
//       - HF router / OpenRouter / LM Studio, etc.
//
// No proprietary SDK and no paid API are required.
//   isLlmEnabled() -> boolean
//   planJson({ system, messages, schema }) -> parsed JSON object
//   answerText({ system, messages })        -> string
// ============================================================

const BASE_URL = process.env.LLM_BASE_URL || '';
const API_KEY = process.env.LLM_API_KEY || 'none';
const MODEL = process.env.LLM_MODEL || 'offline rule engine';

function isLlmEnabled() {
  return !!BASE_URL;
}

function extractJson(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return t;
}

async function chat({ system, messages, jsonMode, maxTokens = 1400 }) {
  const body = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: maxTokens,
    temperature: 0.2,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

// Structured planning call: returns JSON. Works on any OpenAI-compatible
// endpoint (uses json_object mode + tolerant JSON extraction).
async function planJson({ system, messages, maxTokens = 1200 }) {
  const sys = `${system}

Respond with ONLY a single JSON object — no markdown, no prose — with EXACTLY these keys:
{"kind":"query|clarify|smalltalk","sql":"<a single read-only SELECT, or empty string>","explanation":"<one short sentence>","clarification":"<a question if the request is ambiguous, else empty>","followups":["<useful follow-up>","<useful follow-up>"],"chart":"none|bar|line|pie"}`;
  const text = await chat({ system: sys, messages, jsonMode: true, maxTokens });
  return JSON.parse(extractJson(text));
}

// Free-form answer generation (natural language, incl. Kannada).
async function answerText({ system, messages, maxTokens = 1400 }) {
  return (await chat({ system, messages, jsonMode: false, maxTokens })).trim();
}

module.exports = { isLlmEnabled, planJson, answerText, MODEL };
