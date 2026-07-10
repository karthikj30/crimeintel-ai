// ============================================================
// Serverless API handlers — shared by Next.js route handlers
// (Vercel) and Catalyst Functions. Uses sql.js + HF dataset.
// ============================================================

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../fir/getDb');
const { isLlmEnabled, planJson, answerText, MODEL } = require('../ai/provider');
const { buildSchemaContext } = require('../ai/schemaContext');
const { runReadOnly } = require('../ai/sqlGuard');
const offline = require('../ai/offlineEngine');
const { buildGraph, listGangs, personEgo } = require('../graph/networkBuilder');
const { overviewStats } = require('../fir/queries');
const A = require('../fir/analytics');

const sessions = new Map();

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'sql', 'explanation', 'clarification', 'followups', 'chart'],
  properties: {
    kind: { type: 'string', enum: ['query', 'clarify', 'smalltalk'] },
    sql: { type: 'string' },
    explanation: { type: 'string' },
    clarification: { type: 'string' },
    followups: { type: 'array', items: { type: 'string' } },
    chart: { type: 'string', enum: ['none', 'bar', 'line', 'pie'] },
  },
};

const ANSWER_SYSTEM = `You are the KSP Crime Intelligence assistant for Karnataka State Police investigators.
Answer ONLY from the DATA rows provided — never invent names, numbers, or FIRs.
Be concise, factual and investigative in tone. Cite specific FIR numbers (CrimeNo) as evidence where relevant.
If the DATA is empty, clearly say no matching records were found.
Respond in the SAME language as the user's question (reply in Kannada if the question is in Kannada).`;

function crimeNoEvidence(rows) {
  return rows.map((r) => r.CrimeNo).filter(Boolean).slice(0, 12).map((c) => `FIR ${c}`);
}

function getSession(id) {
  if (id && sessions.has(id)) return sessions.get(id);
  const s = { id: id || uuidv4(), createdAt: new Date().toISOString(), turns: [], messages: [] };
  sessions.set(s.id, s);
  return s;
}

function getSessionHistory(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  return { sessionId: s.id, createdAt: s.createdAt, turns: s.turns };
}

async function llmAnswerWithDb(question, priorTurns, db) {
  const system = buildSchemaContext();
  const messages = [...priorTurns, { role: 'user', content: question }];
  let plan = await planJson({ system, messages, schema: PLAN_SCHEMA, maxTokens: 1200 });

  if (plan.kind === 'clarify' && plan.clarification) {
    return { mode: 'llm', model: MODEL, answer: plan.clarification, sql: null, rows: [], columns: [], evidence: [], followups: plan.followups || [], needsClarification: true };
  }
  if (plan.kind === 'smalltalk' || !plan.sql) {
    return { mode: 'llm', model: MODEL, answer: plan.explanation || 'How can I help you query the crime database?', sql: null, rows: [], columns: [], evidence: [], followups: plan.followups || [] };
  }

  let result;
  try {
    result = runReadOnly(db, plan.sql, { limit: 200 });
  } catch (err) {
    try {
      const repair = await planJson({
        system,
        messages: [
          ...messages,
          { role: 'assistant', content: JSON.stringify({ sql: plan.sql }) },
          { role: 'user', content: `That SQL failed with error: "${err.message}". Return corrected JSON with a valid single read-only SELECT.` },
        ],
        schema: PLAN_SCHEMA, maxTokens: 1200,
      });
      plan = repair;
      result = runReadOnly(db, repair.sql, { limit: 200 });
    } catch (err2) {
      return {
        mode: 'llm', model: MODEL,
        answer: `I could not run that query safely (${err2.message}). Try rephrasing.`,
        sql: plan.sql, rows: [], columns: [], evidence: [], followups: plan.followups || [], error: err2.message,
      };
    }
  }

  const rows = result.rows;
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const dataForModel = JSON.stringify(rows.slice(0, 40));
  let answer;
  try {
    answer = await answerText({
      system: ANSWER_SYSTEM,
      messages: [{ role: 'user', content: `Question: ${question}\n\nSQL:\n${result.sql}\n\nDATA:\n${dataForModel}` }],
      maxTokens: 1400,
    });
  } catch {
    answer = rows.length ? `Query returned ${rows.length} row(s).` : 'No matching records were found.';
  }

  return {
    mode: 'llm', model: MODEL, answer,
    sql: result.sql, rows, columns,
    evidence: crimeNoEvidence(rows).length ? crimeNoEvidence(rows) : [`${rows.length} record(s)`],
    followups: plan.followups || [],
    chart: plan.chart && plan.chart !== 'none' ? { type: plan.chart } : null,
    truncated: result.truncated,
  };
}

async function answerChat(question, priorTurns = []) {
  const db = await getDb();
  if (isLlmEnabled()) {
    try {
      return await llmAnswerWithDb(question, priorTurns, db);
    } catch (err) {
      const off = offline.handle(question, db);
      off.notice = `LLM unavailable (${err.message}); answered with the offline engine.`;
      return off;
    }
  }
  return offline.handle(question, db);
}

async function handleChatPost(body) {
  const { message, sessionId } = body || {};
  if (!message?.trim()) return { status: 400, body: { error: 'message is required' } };

  const s = getSession(sessionId);
  const ts = new Date().toISOString();
  const priorTurns = s.messages.slice(-8);
  const result = await answerChat(message.trim(), priorTurns);

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
  s.messages.push({ role: 'user', content: message.trim() });
  s.messages.push({ role: 'assistant', content: (result.answer || '').slice(0, 600) });

  return { status: 200, body: { sessionId: s.id, ...assistantTurn } };
}

async function handleNetworkGraph(max) {
  const db = await getDb();
  return buildGraph({ maxNodes: max, db });
}

async function handleNetworkGangs() {
  const db = await getDb();
  return { gangs: listGangs({ db }) };
}

async function handleNetworkPerson(id) {
  const db = await getDb();
  const ego = personEgo(parseInt(id, 10), db);
  if (!ego) return { status: 404, body: { error: 'person not found' } };
  return { status: 200, body: ego };
}

async function handleFirOverview() {
  const db = await getDb();
  return overviewStats(db);
}

module.exports = {
  getSession,
  getSessionHistory,
  answerChat,
  handleChatPost,
  handleNetworkGraph,
  handleNetworkGangs,
  handleNetworkPerson,
  handleFirOverview,
  chatStatus: () => ({
    llm: isLlmEnabled(),
    brain: isLlmEnabled() ? MODEL : 'offline rule engine',
    dataSource: process.env.HF_DATASET_REPO || 'sleepingbeauty11/Datathon_CodeWars',
    deployment: process.env.VERCEL ? 'vercel' : (process.env.CATALYST_ENV ? 'catalyst' : 'local'),
  }),
  firHandlers: {
    stations: () => A.stations(),
    heatmap: async () => { const db = await getDb(); return A.heatmapPoints(db); },
    districts: async () => { const db = await getDb(); return A.districtAgg(db); },
    temporal: async () => { const db = await getDb(); return A.temporal(db); },
    categories: async () => { const db = await getDb(); return A.categories(db); },
    demographics: async () => { const db = await getDb(); return A.demographics(db); },
    hourly: async () => { const db = await getDb(); return A.hourly(db); },
    forecast: async () => { const db = await getDb(); return A.forecast(db); },
    offenders: async () => { const db = await getDb(); return A.offenders(db); },
    overview: handleFirOverview,
  },
};
