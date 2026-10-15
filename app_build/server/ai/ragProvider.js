// ============================================================
// CRIME INTELLIGENCE — RAG (Retrieval-Augmented Generation) Provider
// ------------------------------------------------------------
// Node.js port of the Python FastAPI EVBharat RAG backend,
// adapted for Crime Intelligence use-case with Gemini AI.
//
// Provides:
//   1. Free-form chat about FIRs, accused, hotspots, offenders
//   2. PDF/image upload + RAG-based Q&A over uploaded documents
//   3. Lazy-loaded dependencies — server starts instantly without them
//
// Dependencies (install with npm):
//   npm install @google/genai pdf-parse multer
// ============================================================

'use strict';

const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────
const DATA_DIR       = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'crimeintel-rag')   // only /tmp is writable on Vercel
  : path.join(__dirname, '..', 'data', 'rag');
const SESSIONS_DIR   = path.join(DATA_DIR, 'sessions');
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// Ensure directories exist
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// ── In-memory session store ───────────────────────────────────
/** @type {Map<string, {chunks: string[], createdAt: number, fileName: string}>} */
const activeSessions = new Map();

// OpenRouter is used as the AI backend.

// ── System prompt ────────────────────────────────────────────
const CRIME_SYSTEM_PROMPT = `You are **CrimeScope AI** — an expert crime intelligence analyst for the Karnataka State Police.

Your knowledge spans:
- **FIR (First Information Report)** analysis: CaseMaster, sections, crime heads, accused details
- **Criminal network analysis**: co-accused links, gang detection, repeat offenders
- **Geographic & temporal crime patterns**: district hotspots, near-repeat events, serial crimes
- **Offender profiling**: habitual offenders, risk scores, behavioral patterns
- **Financial intelligence**: suspicious transactions, mule detection, money trails
- **Legal framework**: IPC sections, CrPC procedures, BNS/BNSS provisions
- **Investigative intelligence**: cold-case re-openers, solvability triage, MARAC safeguarding
- **Karnataka-specific context**: district police structures, SCRB, PS jurisdictions

**Response guidelines:**
1. Cite specific FIR numbers (CrimeNo), section numbers, or district names when applicable.
2. Clearly distinguish between confirmed facts and analytical inferences.
3. For compliance/procedure questions, present a clear step-by-step checklist.
4. Flag sensitive data handling requirements where relevant.
5. Keep answers structured with headings, bullet points and numbered lists.
6. Be factual, concise and investigative in tone.
7. Do NOT hallucinate FIR numbers, names, or statistics.`;

// ── Free-form chat (no document) ─────────────────────────────

/**
 * Answer a free-form crime intelligence question using Gemini.
 * @param {string} question
 * @param {string[]} [priorMessages]   Flat array alternating user/model content
 * @returns {Promise<{answer:string, mode:string, model:string}>}
 */
async function freeChat(question, priorMessages = []) {
  const messages = [];
  messages.push({ role: 'system', content: CRIME_SYSTEM_PROMPT });

  for (let i = 0; i < priorMessages.length; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: priorMessages[i],
    });
  }
  messages.push({ role: 'user', content: question });

  return await fetchWithFallback(messages, 150, 0.6);
}

// ── Text chunking ─────────────────────────────────────────────

function chunkText(text, chunkSize = 2000) {
  const words  = text.split(/\s+/);
  const chunks = [];
  let current  = [];
  let size     = 0;

  for (const word of words) {
    current.push(word);
    size += word.length + 1;
    if (size >= chunkSize) {
      chunks.push(current.join(' '));
      current = [];
      size    = 0;
    }
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks.length ? chunks : [text.slice(0, 2000)];
}

// ── PDF extraction ────────────────────────────────────────────

async function extractPdfText(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer   = fs.readFileSync(filePath);
    const data     = await pdfParse(buffer);
    return (data.text || '').trim();
  } catch (err) {
    throw new Error(`PDF extraction failed: ${err.message}`);
  }
}

// ── Image extraction via Gemini Vision ───────────────────────

async function extractImageContent(filePath, mimeType) {
  const apiKey = process.env.OPENROUTER_API_KEY || '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';
  const primaryModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

  const imgBytes = fs.readFileSync(filePath);
  const base64 = imgBytes.toString('base64');

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analyze this image in the context of crime intelligence / law enforcement. ' +
                'Extract all visible text, describe charts, tables, maps, or data. ' +
                'Focus on: FIR details, accused/victim information, crime statistics, locations, timestamps, or any investigative data. ' +
                'Be thorough and structured.',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
          },
        },
      ],
    },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/karthikj30/crimeintel-ai',
        'X-Title': 'CrimeScope AI Vision',
      },
      body: JSON.stringify({
        model: primaryModel,
        messages,
        temperature: 0.3,
        max_tokens: 80, // Cap to 80 to fit the credit limits
      }),
    });

    if (response.status === 402 || !response.ok) {
      console.warn(`Primary vision model failed with status ${response.status}. Falling back to free vision model...`);
      return await callFreeVisionModel(apiKey, messages);
    }

    const data = await response.json();
    if (data.error && data.error.code === 402) {
      console.warn("OpenRouter returned 402 error in vision body. Falling back to free vision model...");
      return await callFreeVisionModel(apiKey, messages);
    }

    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.warn("Primary vision model request failed. Falling back to free vision model...", err.message);
    return await callFreeVisionModel(apiKey, messages);
  }
}

// ── Simple keyword-based retrieval (no external vector DB needed) ─

function retrieveRelevantChunks(chunks, query, k = 6) {
  if (!chunks || !chunks.length) return [];
  const queryTokens = new Set(
    query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  );

  const scored = chunks.map((chunk, idx) => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      // Count occurrences with bonus for exact word boundaries
      const re  = new RegExp(`\\b${token}\\b`, 'g');
      const hits = (chunkLower.match(re) || []).length;
      score += hits * 2;
      if (chunkLower.includes(token)) score += 1;
    }
    return { idx, score, chunk };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k).filter((s) => s.score > 0);
  // if nothing scored, return first k chunks as fallback
  return (top.length ? top : scored.slice(0, k)).map((s) => s.chunk);
}

// ── Build session (process document) ─────────────────────────

/**
 * Process a PDF or image and store chunks in a session.
 * @param {string} sessionId
 * @param {string} filePath
 * @param {string} fileName
 * @param {boolean} isImage
 * @param {string} [mimeType]
 * @returns {Promise<{chunks:number, sessionId:string, fileName:string}>}
 */
async function buildSession(sessionId, filePath, fileName, isImage, mimeType) {
  let fullText = '';

  if (isImage) {
    fullText = await extractImageContent(filePath, mimeType || 'image/jpeg');
    if (!fullText.trim()) {
      fullText = `Image file: ${fileName}\nNo extractable text content found.`;
    }
  } else {
    fullText = await extractPdfText(filePath);
    if (!fullText.trim()) {
      fullText = `PDF file: ${fileName}\nNo extractable text content found (possibly image-based or encrypted).`;
    }
  }

  const chunks = chunkText(fullText, 2000);

  // Persist session metadata
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  const sessionData = { sessionId, fileName, chunks, createdAt: Date.now() };
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');

  activeSessions.set(sessionId, sessionData);
  return { chunks: chunks.length, sessionId, fileName };
}

// ── Restore session from disk ─────────────────────────────────

function restoreSession(sessionId) {
  if (activeSessions.has(sessionId)) return true;
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (!fs.existsSync(sessionFile)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    activeSessions.set(sessionId, data);
    return true;
  } catch {
    return false;
  }
}

// ── RAG chat (document-grounded) ─────────────────────────────

/**
 * Answer a question grounded in a previously uploaded document.
 * @param {string} sessionId
 * @param {string} question
 * @param {string[]} [priorMessages]
 * @returns {Promise<{answer:string, mode:string, model:string, context:string[]}>}
 */
async function ragChat(sessionId, question, priorMessages = []) {
  if (!restoreSession(sessionId)) {
    throw new Error(`Session ${sessionId} not found. Upload a document first.`);
  }

  const session = activeSessions.get(sessionId);
  const relevant = retrieveRelevantChunks(session.chunks, question, 6);
  const context = relevant.join('\n\n---\n\n');

  const systemPrompt = `${CRIME_SYSTEM_PROMPT}

---
DOCUMENT CONTEXT (from: ${session.fileName}):
${context}
---

Answer the user's question using ONLY the document context above. 
If the answer is not in the document, say so clearly.
Cite relevant sections from the document.`;

  const messages = [];
  messages.push({ role: 'system', content: systemPrompt });

  for (let i = 0; i < priorMessages.length; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: priorMessages[i],
    });
  }
  messages.push({ role: 'user', content: question });

  const result = await fetchWithFallback(messages, 150, 0.4);
  return {
    answer: result.answer,
    session_id: sessionId,
    mode: result.mode,
    model: result.model,
    context: relevant
  };
}

// ── Delete session ────────────────────────────────────────────

function deleteSession(sessionId) {
  activeSessions.delete(sessionId);
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
}

// ── Session status ────────────────────────────────────────────

function getSessionStatus(sessionId) {
  if (!restoreSession(sessionId)) return null;
  const s = activeSessions.get(sessionId);
  return { exists: true, fileName: s.fileName, chunks: s.chunks.length, createdAt: s.createdAt };
}

// ── File hash ────────────────────────────────────────────────

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function fetchWithFallback(messages, maxTokens = 150, temperature = 0.5) {
  const apiKey = process.env.OPENROUTER_API_KEY || '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';
  const primaryModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  
  // Cap tokens to 50 to fit the credit limits
  const finalMaxTokens = Math.min(maxTokens, 50);

  // Add conciseness instruction to the system prompt (first message)
  if (messages.length > 0 && messages[0].role === 'system') {
    messages[0].content = `${messages[0].content}\nCRITICAL: Be extremely concise. Keep output under 2 sentences or short bullet points. Avoid introductory/concluding prose.`;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/karthikj30/crimeintel-ai',
        'X-Title': 'CrimeScope AI RAG',
      },
      body: JSON.stringify({
        model: primaryModel,
        messages,
        temperature,
        max_tokens: finalMaxTokens,
      }),
    });

    if (response.status === 402 || !response.ok) {
      console.warn(`Primary model failed with status ${response.status}. Trying local Ollama fallback...`);
      return await callOllamaOrFreeRAGModel(apiKey, messages, temperature);
    }

    const data = await response.json();
    if (data.error && data.error.code === 402) {
      console.warn("OpenRouter returned 402 error in body. Trying local Ollama fallback...");
      return await callOllamaOrFreeRAGModel(apiKey, messages, temperature);
    }

    return {
      answer: data.choices?.[0]?.message?.content?.trim() || 'No response generated.',
      model: primaryModel,
      mode: 'openrouter'
    };
  } catch (err) {
    console.warn("Primary model RAG request failed. Trying local Ollama fallback...", err.message);
    return await callOllamaOrFreeRAGModel(apiKey, messages, temperature);
  }
}

async function callOllamaOrFreeRAGModel(apiKey, messages, temperature) {
  // Try local Ollama first (extremely low-load lightweight model: llama3.2)
  try {
    const response = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        messages,
        temperature,
        max_tokens: 250,
      }),
    });

    if (response.ok) {
      const j = await response.json();
      const content = j.choices?.[0]?.message?.content?.trim();
      if (content) {
        console.log("Successfully answered RAG using local Ollama (llama3.2).");
        return {
          answer: content,
          model: 'llama3.2',
          mode: 'ollama-local-fallback'
        };
      }
    }
  } catch (ollamaErr) {
    console.warn("Local Ollama RAG fallback unavailable or model not found. Trying cloud free fallback...", ollamaErr.message);
  }

  // Fallback to the cloud free router
  const fallbackModel = 'openrouter/free';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/karthikj30/crimeintel-ai',
      'X-Title': 'CrimeScope AI RAG Fallback',
    },
    body: JSON.stringify({
      model: fallbackModel,
      messages,
      temperature,
      max_tokens: 250, // Request up to 250 tokens for the free model fallback
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Fallback RAG API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    answer: data.choices?.[0]?.message?.content?.trim() || 'No response generated.',
    model: fallbackModel,
    mode: 'openrouter-free-fallback'
  };
}

async function callFreeVisionModel(apiKey, messages) {
  const fallbackModel = 'nvidia/nemotron-nano-12b-v2-vl:free';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/karthikj30/crimeintel-ai',
      'X-Title': 'CrimeScope AI Vision Fallback',
    },
    body: JSON.stringify({
      model: fallbackModel,
      messages,
      temperature: 0.3,
      max_tokens: 80,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Fallback Vision API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}


module.exports = {
  freeChat,
  buildSession,
  ragChat,
  deleteSession,
  getSessionStatus,
  hashFile,
  DATA_DIR,
  MAX_FILE_BYTES,
  ALLOWED_PDF_EXTS: ['.pdf'],
  ALLOWED_IMAGE_EXTS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'],
};
