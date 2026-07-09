// ============================================================
// KSP CRIME INTELLIGENCE — Conversational NL->SQL Engine
// ------------------------------------------------------------
// Orchestrates: (1) LLM plans a safe read-only SQL query from the
// question + conversation context, (2) sqlGuard executes it, (3) LLM
// explains the results in natural language (English/Kannada) with
// evidence trails. Falls back to the deterministic offline engine
// when no LLM is configured, or if the LLM path fails.
// ============================================================

const { getFirDb } = require('../fir/db');
const { isLlmEnabled, planJson, answerText, MODEL } = require('./provider');
const { buildSchemaContext } = require('./schemaContext');
const { runReadOnly } = require('./sqlGuard');
const offline = require('./offlineEngine');

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'sql', 'explanation', 'clarification', 'followups', 'chart'],
  properties: {
    kind: { type: 'string', enum: ['query', 'clarify', 'smalltalk'] },
    sql: { type: 'string', description: 'A single read-only SQLite SELECT; empty string if not a query.' },
    explanation: { type: 'string', description: 'One short sentence describing what the query does.' },
    clarification: { type: 'string', description: 'A clarifying question if the request is ambiguous; else empty.' },
    followups: { type: 'array', items: { type: 'string' }, description: '2-3 useful follow-up questions.' },
    chart: { type: 'string', enum: ['none', 'bar', 'line', 'pie'], description: 'Best chart for the result shape.' },
  },
};

function crimeNoEvidence(rows) {
  const list = rows.map((r) => r.CrimeNo).filter(Boolean).slice(0, 12);
  return list.map((c) => `FIR ${c}`);
}

const ANSWER_SYSTEM = `You are the KSP Crime Intelligence assistant for Karnataka State Police investigators.
Answer ONLY from the DATA rows provided — never invent names, numbers, or FIRs.
Be concise, factual and investigative in tone. Cite specific FIR numbers (CrimeNo) as evidence where relevant.
If the DATA is empty, clearly say no matching records were found.
Respond in the SAME language as the user's question (reply in Kannada if the question is in Kannada).`;

async function llmAnswer(question, priorTurns) {
  const system = buildSchemaContext();
  const messages = [...priorTurns, { role: 'user', content: question }];

  // 1) PLAN
  let plan = await planJson({ system, messages, schema: PLAN_SCHEMA, maxTokens: 1200 });

  if (plan.kind === 'clarify' && plan.clarification) {
    return { mode: 'llm', model: MODEL, answer: plan.clarification, sql: null, rows: [], columns: [], evidence: [], followups: plan.followups || [], needsClarification: true };
  }
  if (plan.kind === 'smalltalk' || !plan.sql) {
    return { mode: 'llm', model: MODEL, answer: plan.explanation || 'How can I help you query the crime database?', sql: null, rows: [], columns: [], evidence: [], followups: plan.followups || [] };
  }

  // 2) EXECUTE (guarded) with a single repair retry on SQL error
  const db = getFirDb();
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
        answer: `I could not run that query safely (${err2.message}). Try rephrasing, or ask for a specific FIR, district, or crime type.`,
        sql: plan.sql, rows: [], columns: [], evidence: [], followups: plan.followups || [], error: err2.message,
      };
    }
  }

  const rows = result.rows;
  const columns = rows.length ? Object.keys(rows[0]) : [];

  // 3) ANSWER from the retrieved rows
  const dataForModel = JSON.stringify(rows.slice(0, 40));
  let answer;
  try {
    answer = await answerText({
      system: ANSWER_SYSTEM,
      messages: [{ role: 'user', content: `Question: ${question}\n\nSQL executed:\n${result.sql}\n\nDATA (JSON rows${result.truncated ? ', truncated' : ''}):\n${dataForModel}` }],
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

// Public entry. priorTurns: [{role:'user'|'assistant', content:string}] (compacted history).
async function answer(question, priorTurns = []) {
  if (isLlmEnabled()) {
    try {
      return await llmAnswer(question, priorTurns);
    } catch (err) {
      // fall through to offline on any LLM failure
      const off = offline.handle(question);
      off.notice = `LLM unavailable (${err.message}); answered with the offline engine.`;
      return off;
    }
  }
  return offline.handle(question);
}

module.exports = { answer, PLAN_SCHEMA };
