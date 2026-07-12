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

const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || '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';
const MODEL = process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

function isLlmEnabled() {
  return !!BASE_URL && API_KEY !== 'none';
}

function extractJson(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return t;
}

async function chat({ system, messages, jsonMode, maxTokens = 150 }) {
  // Cap at 50 tokens to fit user's low credits (currently <100) and optimize response size
  const finalMaxTokens = Math.min(maxTokens, 50);
  
  // Inject conciseness instruction to model
  const concisenessSystem = jsonMode ? system : `${system}\nCRITICAL: Be extremely concise. Keep output under 2 sentences or short bullet points. Avoid introductory/concluding prose.`;

  const body = {
    model: MODEL,
    messages: [{ role: 'system', content: concisenessSystem }, ...messages],
    max_tokens: finalMaxTokens,
    temperature: 0.1,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://github.com/karthikj30/crimeintel-ai',
        'X-Title': 'CrimeScope AI',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 402 || !res.ok) {
      console.warn(`Primary model failed with status ${res.status}. Trying local Ollama fallback...`);
      return await callOllamaOrFreeModel(system, messages, jsonMode);
    }

    const j = await res.json();
    if (j.error && j.error.code === 402) {
      console.warn("OpenRouter returned 402 error in body. Trying local Ollama fallback...");
      return await callOllamaOrFreeModel(system, messages, jsonMode);
    }
    return j.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.warn("Primary model request failed. Trying local Ollama fallback...", err.message);
    return await callOllamaOrFreeModel(system, messages, jsonMode);
  }
}

async function callOllamaOrFreeModel(system, messages, jsonMode) {
  // Try local Ollama first (extremely low-load lightweight model: llama3.2)
  try {
    const concisenessSystem = jsonMode ? system : `${system}\nCRITICAL: Be extremely concise. Keep output under 2 sentences or short bullet points. Avoid introductory/concluding prose.`;
    const body = {
      model: 'llama3.2', // Lightweight 3B model (low RAM/GPU load)
      messages: [{ role: 'system', content: concisenessSystem }, ...messages],
      max_tokens: 250,
      temperature: 0.1,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const j = await res.json();
      const content = j.choices?.[0]?.message?.content;
      if (content) {
        console.log("Successfully answered using local Ollama (llama3.2).");
        return content;
      }
    }
  } catch (ollamaErr) {
    console.warn("Local Ollama fallback unavailable or model not found. Trying cloud free fallback...", ollamaErr.message);
  }

  // Fallback to the cloud free router (0 load on user PC)
  const freeModel = 'openrouter/free';
  const concisenessSystem = jsonMode ? system : `${system}\nCRITICAL: Be extremely concise. Keep output under 2 sentences or short bullet points. Avoid introductory/concluding prose.`;

  const body = {
    model: freeModel,
    messages: [{ role: 'system', content: concisenessSystem }, ...messages],
    max_tokens: 250, // Safe to request more tokens since the model is completely free
    temperature: 0.1,
  };
  
  // NOTE: We do not set response_format: json_object for the free model
  // because smaller free models (like Llama 3.2 3B) often do not support it.
  // Our extractJson parser is robust enough to extract JSON from plain text.

  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://github.com/karthikj30/crimeintel-ai',
      'X-Title': 'CrimeScope AI (Fallback)',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Free model LLM HTTP ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

// Structured planning call: returns JSON. Works on any OpenAI-compatible
// endpoint (uses json_object mode + tolerant JSON extraction).
async function planJson({ system, messages, maxTokens = 150 }) {
  const sys = `${system}

Respond with ONLY a single JSON object — no markdown, no prose — with EXACTLY these keys:
{"kind":"query|clarify|smalltalk","sql":"<a single read-only SELECT, or empty string>","explanation":"<one short sentence>","clarification":"<a question if the request is ambiguous, else empty>","followups":["<useful follow-up>","<useful follow-up>"],"chart":"none|bar|line|pie"}`;
  const text = await chat({ system: sys, messages, jsonMode: true, maxTokens });
  return JSON.parse(extractJson(text));
}

// Free-form answer generation (natural language, incl. Kannada).
async function answerText({ system, messages, maxTokens = 150 }) {
  return (await chat({ system, messages, jsonMode: false, maxTokens })).trim();
}

module.exports = { isLlmEnabled, planJson, answerText, MODEL };
