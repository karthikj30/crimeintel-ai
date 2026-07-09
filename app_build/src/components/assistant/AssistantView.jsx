'use client';
// ============================================================
// KSP CRIME INTELLIGENCE — Conversational Assistant View
// Natural-language querying of the FIR database with evidence
// trails, result tables, mini-charts, voice (EN/Kannada) and
// local PDF export of the conversation history.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Send, Mic, FileDown, RotateCcw, Database, ShieldCheck,
  ChevronDown, Volume2, VolumeX, TableProperties,
} from 'lucide-react';
import { postChat, getChatStatus } from '@/lib/api';

const SUGGESTIONS = {
  en: [
    'How many cybercrime cases were registered in Bengaluru City?',
    'Show me the top repeat offenders and their risk scores',
    'Which districts are the biggest crime hotspots?',
    'Are there suspicious financial transactions / money trails?',
    'Break down cases by crime type',
    'What is the case disposal status across the state?',
  ],
  kn: [
    'ಬೆಂಗಳೂರಿನಲ್ಲಿ ಎಷ್ಟು ಸೈಬರ್ ಅಪರಾಧ ಪ್ರಕರಣಗಳಿವೆ?',
    'ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳನ್ನು ತೋರಿಸಿ',
    'ಯಾವ ಜಿಲ್ಲೆಗಳು ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳಾಗಿವೆ?',
    'ಅಪರಾಧ ಪ್ರಕಾರವಾರು ಪ್ರಕರಣಗಳ ವಿವರ ನೀಡಿ',
  ],
};

function MiniBars({ rows }) {
  const cols = Object.keys(rows[0] || {});
  const valCol = cols.find((c) => rows.every((r) => typeof r[c] === 'number')) || cols[cols.length - 1];
  const labelCol = cols.find((c) => c !== valCol) || cols[0];
  const max = Math.max(...rows.map((r) => Number(r[valCol]) || 0), 1);
  return (
    <div className="ai-bars">
      {rows.slice(0, 8).map((r, i) => (
        <div key={i} className="ai-bar-row">
          <span className="ai-bar-label" title={String(r[labelCol])}>{String(r[labelCol])}</span>
          <div className="ai-bar-track"><div className="ai-bar-fill" style={{ width: `${((Number(r[valCol]) || 0) / max) * 100}%` }} /></div>
          <span className="ai-bar-val">{r[valCol]}</span>
        </div>
      ))}
    </div>
  );
}

function ResultTable({ columns, rows }) {
  const shown = columns.slice(0, 6);
  return (
    <div className="ai-table-wrap">
      <table className="ai-table">
        <thead><tr>{shown.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, 8).map((r, i) => (
            <tr key={i}>{shown.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > 8 && <div className="ai-table-more">+{rows.length - 8} more rows</div>}
    </div>
  );
}

function AssistantMessage({ m, onFollowup }) {
  const hasTable = m.columns && m.columns.length > 0 && m.rows && m.rows.length > 0;
  const showChart = m.chart && (m.chart.type === 'bar' || m.chart.type === 'line') && hasTable && m.columns.length >= 2 && m.rows.length > 1;
  return (
    <div className="ai-msg ai-msg-assistant">
      <div className="ai-avatar"><Sparkles size={15} /></div>
      <div className="ai-bubble">
        {m.notice && <div className="ai-notice">{m.notice}</div>}
        <div className="ai-answer">{m.content}</div>

        {m.evidence && m.evidence.length > 0 && (
          <div className="ai-evidence">
            <ShieldCheck size={12} />
            <span className="ai-evidence-label">Evidence</span>
            {m.evidence.slice(0, 6).map((e, i) => <span key={i} className="ai-chip ai-chip-evidence">{e}</span>)}
          </div>
        )}

        {showChart && <MiniBars rows={m.rows} />}
        {hasTable && !showChart && <ResultTable columns={m.columns} rows={m.rows} />}

        {m.sql && (
          <details className="ai-sql">
            <summary><Database size={12} /> Reasoning &amp; SQL evidence trail <ChevronDown size={12} className="ai-sql-chev" /></summary>
            <pre>{m.sql}</pre>
          </details>
        )}

        {m.followups && m.followups.length > 0 && (
          <div className="ai-followups">
            {m.followups.map((f, i) => (
              <button key={i} className="ai-chip ai-chip-followup" onClick={() => onFollowup(f)}>{f}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistantView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('en');
  const [brain, setBrain] = useState(null);
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const sessionRef = useRef(null);
  const recogRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => { getChatStatus().then(setBrain).catch(() => setBrain({ llm: false, brain: 'offline engine' })); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);

  function speak(text) {
    if (!ttsOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await postChat(q, sessionRef.current);
      sessionRef.current = res.sessionId;
      setMessages((m) => [...m, { role: 'assistant', ...res }]);
      speak(res.content);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — the request failed (${e.message}). Is the backend running on :3000?`, mode: 'error' }]);
    } finally {
      setLoading(false);
    }
  }

  function toggleMic() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { alert('Voice input needs Chrome/Edge (Web Speech API).'); return; }
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    recogRef.current = r;
    r.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0][0].transcript; setInput(t); setTimeout(() => send(t), 80); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  function newChat() { setMessages([]); sessionRef.current = null; }

  function exportPDF() {
    const rowsHtml = messages.map((m) => {
      if (m.role === 'user') return `<div class="q"><b>Q:</b> ${escapeHtml(m.content)}</div>`;
      const ev = (m.evidence || []).length ? `<div class="ev">Evidence: ${m.evidence.map(escapeHtml).join(', ')}</div>` : '';
      const sql = m.sql ? `<pre class="sql">${escapeHtml(m.sql)}</pre>` : '';
      return `<div class="a"><b>A:</b> ${escapeHtml(m.content).replace(/\n/g, '<br>')}${ev}${sql}</div>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>KSP Crime Intelligence — Conversation</title>
      <style>body{font-family:Inter,Arial,sans-serif;max-width:820px;margin:32px auto;color:#111;padding:0 20px}
      h1{font-size:18px;margin:0 0 2px} .sub{color:#666;font-size:12px;margin-bottom:18px;border-bottom:2px solid #6366f1;padding-bottom:10px}
      .q{background:#eef2ff;padding:10px 12px;border-radius:8px;margin:14px 0 6px}
      .a{padding:4px 12px 12px;margin-bottom:8px;border-left:3px solid #6366f1}
      .ev{color:#4338ca;font-size:11px;margin-top:6px} .sql{background:#0f172a;color:#a5b4fc;font-size:10px;padding:8px;border-radius:6px;overflow:auto;white-space:pre-wrap}
      .foot{margin-top:24px;color:#888;font-size:10px;border-top:1px solid #ddd;padding-top:8px}</style></head>
      <body><h1>🛡️ KSP Crime Intelligence — Conversation History</h1>
      <div class="sub">Karnataka State Police · State Crime Records Bureau (SCRB) &nbsp;|&nbsp; Exported ${new Date().toLocaleString()}</div>
      ${rowsHtml || '<p>No conversation yet.</p>'}
      <div class="foot">Generated by the KSP Conversational Crime Intelligence platform. Answers are grounded in the FIR database with cited evidence.</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 350);
  }

  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.en;

  return (
    <div className="ai-view">
      <div className="ai-header">
        <div className="ai-header-title">
          <div className="ai-header-icon"><Sparkles size={18} /></div>
          <div>
            <h2>Crime Intelligence Assistant</h2>
            <p>Ask about FIRs, accused, hotspots, offenders &amp; financial links — in plain language</p>
          </div>
        </div>
        <div className="ai-header-actions">
          {brain && (
            <span className={`ai-brain ${brain.llm ? 'live' : 'offline'}`} title={brain.hint || ''}>
              <span className="ai-brain-dot" />{brain.llm ? brain.brain : 'Offline engine'}
            </span>
          )}
          <div className="ai-lang">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'kn' ? 'active' : ''} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
          </div>
          <button className="ai-icon-btn" title={ttsOn ? 'Voice replies on' : 'Voice replies off'} onClick={() => setTtsOn((v) => !v)}>
            {ttsOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button className="ai-icon-btn" title="Export conversation to PDF" onClick={exportPDF} disabled={!messages.length}><FileDown size={16} /></button>
          <button className="ai-icon-btn" title="New conversation" onClick={newChat} disabled={!messages.length}><RotateCcw size={16} /></button>
        </div>
      </div>

      <div className="ai-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-empty">
            <div className="ai-empty-icon"><Sparkles size={26} /></div>
            <h3>How can I help with your investigation?</h3>
            <p>Query 1,200+ FIRs across 16 Karnataka districts using natural language. Every answer is backed by evidence and the exact query used.</p>
            <div className="ai-suggest-grid">
              {suggestions.map((s, i) => (
                <button key={i} className="ai-suggest" onClick={() => send(s)}>
                  <TableProperties size={14} /><span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="ai-msg ai-msg-user"><div className="ai-bubble ai-bubble-user">{m.content}</div></div>
            : <AssistantMessage key={i} m={m} onFollowup={send} />
        ))}

        {loading && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-avatar"><Sparkles size={15} /></div>
            <div className="ai-bubble"><div className="ai-typing"><span /><span /><span /></div></div>
          </div>
        )}
      </div>

      <div className="ai-inputbar">
        <button className={`ai-mic ${listening ? 'listening' : ''}`} onClick={toggleMic} title="Voice input">
          <Mic size={18} />
        </button>
        <textarea
          className="ai-input"
          rows={1}
          value={input}
          placeholder={lang === 'kn' ? 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ…' : 'Ask a question about the crime database…'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="ai-send" onClick={() => send()} disabled={loading || !input.trim()}><Send size={18} /></button>
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
