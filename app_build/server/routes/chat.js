// ============================================================
// KSP CRIME INTELLIGENCE — Conversational Chat API
// ------------------------------------------------------------
//   GET  /api/chat/status          -> which brain is active
//   POST /api/chat                 -> ask a question (context-aware)
//   GET  /api/chat/:sessionId      -> full conversation history (for PDF export)
// Sessions are kept in memory (demo-scale). Each assistant turn
// carries its answer, executed SQL, evidence trail, and result rows.
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { answer } = require('../ai/nlToSql');
const { isLlmEnabled, MODEL } = require('../ai/provider');

const router = express.Router();
const sessions = new Map(); // sessionId -> { id, createdAt, turns:[], messages:[] }

function getSession(id) {
  if (id && sessions.has(id)) return sessions.get(id);
  const s = { id: id || uuidv4(), createdAt: new Date().toISOString(), turns: [], messages: [] };
  sessions.set(s.id, s);
  return s;
}

router.get('/status', (req, res) => {
  res.json({
    llm: isLlmEnabled(),
    brain: isLlmEnabled() ? MODEL : 'offline rule engine',
    hint: isLlmEnabled() ? null : 'Optionally connect a free local LLM (Ollama) or Groq for open-ended queries — see RUN.md.',
  });
});

router.post('/', async (req, res) => {
  const { message, sessionId } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

  const s = getSession(sessionId);
  const ts = new Date().toISOString();
  try {
    const priorTurns = s.messages.slice(-8); // compact context window for follow-ups
    const result = await answer(message.trim(), priorTurns);

    const assistantTurn = {
      role: 'assistant', ts, mode: result.mode, model: result.model || null,
      content: result.answer, sql: result.sql || null,
      evidence: result.evidence || [], rows: (result.rows || []).slice(0, 100),
      columns: result.columns || [], followups: result.followups || [],
      chart: result.chart || null, detail: result.detail || null,
      needsClarification: !!result.needsClarification, notice: result.notice || null,
    };
    s.turns.push({ role: 'user', content: message.trim(), ts });
    s.turns.push(assistantTurn);

    // Compact history the model sees on the next turn.
    s.messages.push({ role: 'user', content: message.trim() });
    s.messages.push({ role: 'assistant', content: (result.answer || '').slice(0, 600) + (result.sql ? `\n[SQL] ${result.sql}` : '') });

    res.json({ sessionId: s.id, ...assistantTurn });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:sessionId', (req, res) => {
  const s = sessions.get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  res.json({ sessionId: s.id, createdAt: s.createdAt, turns: s.turns });
});

module.exports = router;
