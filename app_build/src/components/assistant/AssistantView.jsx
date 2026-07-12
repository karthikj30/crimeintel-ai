'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles, Send, RotateCcw, Database, Mic, MicOff,
  Volume2, VolumeX, FileDown,
  Upload, FileText, X, Brain, FileSearch, AlertTriangle,
} from 'lucide-react';
import {
  postChat,
  postRagFreeChat, uploadRagDocument, postRagChat, deleteRagSession,
} from '@/lib/api';

// ── Shared constants ──────────────────────────────────────────

const LANG_OPTIONS = [
  { value: 'en',    label: 'EN',      webSpeech: 'en-IN' },
  { value: 'kn',    label: 'ಕನ್ನಡ',   webSpeech: 'kn-IN' },
  { value: 'hi',    label: 'हिंदी',    webSpeech: 'hi-IN' },
  { value: 'ta',    label: 'தமிழ்',    webSpeech: 'ta-IN' },
  { value: 'te',    label: 'తెలుగు',   webSpeech: 'te-IN' },
];

const AI_SUGGESTIONS = [
  'Explain IPC Section 302 and its punishment',
  'What are the stages of a criminal investigation?',
  'Summarise KSP guidelines on cyber crime reporting',
  'How is forensic evidence collected at a crime scene?',
];

const AI_SUGGESTIONS_KN = [
  'IPC ಸೆಕ್ಷನ್ 302 ಮತ್ತು ಅದರ ಶಿಕ್ಷೆ ವಿವರಿಸಿ',
  'ಅಪರಾಧ ತನಿಖೆಯ ಹಂತಗಳು ಯಾವುವು?',
  'ಸೈಬರ್ ಅಪರಾಧ ವರದಿ ಮಾಡುವ ಮಾರ್ಗಸೂಚಿ',
  'ಅಪರಾಧ ದೃಶ್ಯದಲ್ಲಿ ಸಾಕ್ಷ್ಯ ಸಂಗ್ರಹ ಹೇಗೆ?',
];

const FIR_SUGGESTIONS = [
  'How many FIRs were registered last month?',
  'Top 5 districts by heinous crime count',
  'Show repeat offenders with 3+ cases',
  'IPC sections most frequently invoked',
];

const FIR_SUGGESTIONS_KN = [
  'ಕಳೆದ ತಿಂಗಳು ಎಷ್ಟು FIR ದಾಖಲಾಗಿದೆ?',
  'ಅತ್ಯಂತ ಹೆಚ್ಚು ಅಪರಾಧ ಜಿಲ್ಲೆಗಳ ಟಾಪ್ 5',
  '3+ ಪ್ರಕರಣ ಹೊಂದಿರುವ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು',
  'ಹೆಚ್ಚಾಗಿ ಅನ್ವಯಿಸಲಾದ IPC ಸೆಕ್ಷನ್‌ಗಳು',
];

// ── Voice hook ────────────────────────────────────────────────
// Shared mic-recording logic used by every chat tab.
// Returns { listening, transcript, startMic, stopMic }

function useVoice(lang, onTranscript) {
  const [listening, setListening] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const recogRef = useRef(null);

  const startMic = useCallback(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setStatusMsg('Voice input requires Chrome or Edge.');
      return;
    }
    if (listening) return;
    const r = new SR();
    recogRef.current = r;
    const lopt = LANG_OPTIONS.find(o => o.value === lang) || LANG_OPTIONS[0];
    r.lang = lopt.webSpeech;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = e => {
      const text = e.results[0][0].transcript.trim();
      if (text) onTranscript(text);
    };
    r.onend   = () => { setListening(false); setStatusMsg(''); };
    r.onerror = () => { setListening(false); setStatusMsg('Mic error — check permissions.'); };
    setListening(true);
    setStatusMsg('Listening…');
    r.start();
  }, [lang, listening, onTranscript]);

  const stopMic = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
    setStatusMsg('');
  }, []);

  // clean up on unmount
  useEffect(() => () => recogRef.current?.abort(), []);

  return { listening, statusMsg, startMic, stopMic };
}

// ── TTS helper ────────────────────────────────────────────────

function speak(text, lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const lopt = LANG_OPTIONS.find(o => o.value === lang) || LANG_OPTIONS[0];
  const u = new SpeechSynthesisUtterance(text.slice(0, 800));
  u.lang = lopt.webSpeech;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ── AssistantMessage ──────────────────────────────────────────
// Renders a single assistant bubble with optional SQL / evidence blocks
// and a follow-up suggestion chip row.

const FOLLOWUPS = {
  'gemini': ['Elaborate further', 'Give a case example', 'Cite relevant IPC sections'],
  'fir-db': ['Show more details', 'Break it down by district', 'Compare with last year'],
  'rag':    ['Summarise key points', 'What are the implications?', 'List the accused names'],
  'error':  [],
};

function AssistantMessage({ m, onFollowup }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(m.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const chips = FOLLOWUPS[m.mode] ?? FOLLOWUPS['gemini'];

  return (
    <div className="ai-msg ai-msg-assistant">
      <div className="ai-avatar"><Sparkles size={15} /></div>
      <div className="ai-bubble">
        {/* Main text — preserve line breaks */}
        <div className="ai-bubble-text" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>

        {/* SQL block */}
        {m.sql && (
          <pre className="ai-sql-block">{m.sql}</pre>
        )}

        {/* Evidence tags */}
        {m.evidence && m.evidence.length > 0 && (
          <div className="ai-evidence">
            {m.evidence.map((e, i) => (
              <span key={i} className="ai-evidence-tag">{e}</span>
            ))}
          </div>
        )}

        {/* Footer: copy + follow-up chips */}
        <div className="ai-bubble-footer">
          <button className="ai-copy-btn" onClick={copy} title="Copy">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          {chips.length > 0 && onFollowup && (
            <div className="ai-followup-chips">
              {chips.map((c, i) => (
                <button key={i} className="ai-followup-chip" onClick={() => onFollowup(c)}>{c}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── UploadZone ────────────────────────────────────────────────

function UploadZone({ onUpload, uploading }) {
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer?.files[0]) onUpload(e.dataTransfer.files[0]);
  }

  return (
    <div
      className="rag-upload-zone"
      onClick={() => inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
      />
      <Upload size={28} className="rag-upload-icon" />
      {uploading
        ? <p>Uploading…</p>
        : <><p><strong>Drop a file here</strong> or click to browse</p><p className="rag-upload-sub">PDF · JPG · PNG · WebP — max 50 MB</p></>
      }
    </div>
  );
}

// ── SessionBanner ─────────────────────────────────────────────

function SessionBanner({ session, onClear }) {
  return (
    <div className="rag-session-banner">
      <FileText size={13} />
      <span className="rag-session-name">{session.fileName}</span>
      <span className="rag-session-chunks">{session.document_count} chunks</span>
      <button className="rag-session-clear" onClick={onClear} title="Remove document">
        <X size={12} />
      </button>
    </div>
  );
}
// ── Tab: FIR Database Chat ────────────────────────────────────

function FirChatTab({ lang, ttsOn, exportReq }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `fir-${Date.now()}`);
  const scrollRef = useRef(null);
  const sendRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // trigger export when parent requests it
  useEffect(() => {
    if (exportReq > 0 && messages.length) exportChat(messages, 'FIR Database');
  }, [exportReq]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await postChat(q, sessionId);
      const answer = res.response || res.answer || res.message || 'No response.';
      const msg = { role: 'assistant', content: answer, sql: res.sql || null, evidence: res.evidence || [], mode: res.mode || 'fir-db' };
      setMessages(m => [...m, msg]);
      if (ttsOn) speak(answer, lang);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Request failed: ${e.message}`, mode: 'error' }]);
    } finally { setLoading(false); }
  }
  sendRef.current = send;

  const handleTranscript = useCallback(text => {
    setInput(text);
    setTimeout(() => sendRef.current(text), 80);
  }, []);
  const { listening, statusMsg, startMic, stopMic } = useVoice(lang, handleTranscript);

  const suggestions = lang === 'kn' ? FIR_SUGGESTIONS_KN : FIR_SUGGESTIONS;

  return (
    <>
      <div className="ai-tab-toolbar">
        <span className="ai-brain live"><span className="ai-brain-dot" /><Database size={13} style={{ marginRight: 4 }} />FIR Database</span>
        <div className="ai-toolbar-right">
          {statusMsg && <span className="ai-voice-status">{statusMsg}</span>}
          <button className="ai-icon-btn" title="New chat" onClick={() => setMessages([])} disabled={!messages.length}><RotateCcw size={16} /></button>
        </div>
      </div>

      <div className="ai-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-empty">
            <div className="ai-empty-icon"><Database size={26} /></div>
            <h3>FIR Database Assistant</h3>
            <p>Query FIR records, offender profiles, district stats, and crime trends using natural language.</p>
            <div className="ai-suggest-grid">
              {suggestions.map((s, i) => (
                <button key={i} className="ai-suggest" onClick={() => send(s)}>
                  <Database size={14} /><span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="ai-msg ai-msg-user"><div className="ai-bubble ai-bubble-user">{m.content}</div></div>
            : <AssistantMessage key={i} m={m} onFollowup={send} lang={lang} ttsOn={ttsOn} />
        ))}
        {loading && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-avatar"><Sparkles size={15} /></div>
            <div className="ai-bubble"><div className="ai-typing"><span /><span /><span /></div></div>
          </div>
        )}
      </div>

      <div className="ai-inputbar">
        <button className={`ai-mic${listening ? ' listening' : ''}`} onClick={listening ? stopMic : startMic} title={listening ? 'Stop recording' : 'Voice input'}>
          {listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <textarea
          className="ai-input" rows={1} value={input}
          placeholder={lang === 'kn' ? 'FIR ಬಗ್ಗೆ ಕೇಳಿ…' : 'Ask about FIRs, accused, districts, crime trends…'}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="ai-send" onClick={() => send()} disabled={loading || !input.trim()}><Send size={18} /></button>
      </div>
    </>
  );
}

// ── Tab: AI Chat (Gemini) ─────────────────────────────────────

function AiChatTab({ lang, ttsOn, exportReq }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const historyRef = useRef([]);
  const sendRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (exportReq > 0 && messages.length) exportChat(messages, 'AI Chat');
  }, [exportReq]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await postRagFreeChat(q, historyRef.current);
      const answer = res.response || res.answer || 'No response.';
      historyRef.current = [...historyRef.current, q, answer].slice(-16);
      const msg = { role: 'assistant', content: answer, mode: res.mode || 'gemini' };
      setMessages(m => [...m, msg]);
      if (ttsOn) speak(answer, lang);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Request failed: ${e.message}`, mode: 'error' }]);
    } finally { setLoading(false); }
  }
  sendRef.current = send;

  const handleTranscript = useCallback(text => {
    setInput(text);
    setTimeout(() => sendRef.current(text), 80);
  }, []);
  const { listening, statusMsg, startMic, stopMic } = useVoice(lang, handleTranscript);

  const suggestions = lang === 'kn' ? AI_SUGGESTIONS_KN : AI_SUGGESTIONS;

  return (
    <>
      <div className="ai-tab-toolbar">
        <span className="ai-brain live"><span className="ai-brain-dot" />Gemini AI</span>
        <div className="ai-toolbar-right">
          {statusMsg && <span className="ai-voice-status">{statusMsg}</span>}
          <button className="ai-icon-btn" title="New chat" onClick={() => { setMessages([]); historyRef.current = []; }} disabled={!messages.length}><RotateCcw size={16} /></button>
        </div>
      </div>

      <div className="ai-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-empty">
            <div className="ai-empty-icon"><Brain size={26} /></div>
            <h3>Crime Intelligence AI</h3>
            <p>Ask anything about criminal law, IPC sections, investigation procedures, forensics, or KSP-specific policies.</p>
            <div className="ai-suggest-grid">
              {suggestions.map((s, i) => (
                <button key={i} className="ai-suggest" onClick={() => send(s)}>
                  <Sparkles size={14} /><span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="ai-msg ai-msg-user"><div className="ai-bubble ai-bubble-user">{m.content}</div></div>
            : <AssistantMessage key={i} m={m} onFollowup={send} lang={lang} ttsOn={ttsOn} />
        ))}
        {loading && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-avatar"><Sparkles size={15} /></div>
            <div className="ai-bubble"><div className="ai-typing"><span /><span /><span /></div></div>
          </div>
        )}
      </div>

      <div className="ai-inputbar">
        <button className={`ai-mic${listening ? ' listening' : ''}`} onClick={listening ? stopMic : startMic} title={listening ? 'Stop recording' : 'Voice input'}>
          {listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <textarea
          className="ai-input" rows={1} value={input}
          placeholder={lang === 'kn' ? 'ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ…' : 'Ask about IPC sections, procedures, offender profiling, forensics…'}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="ai-send" onClick={() => send()} disabled={loading || !input.trim()}><Send size={18} /></button>
      </div>
    </>
  );
}

// ── Tab: Document RAG ─────────────────────────────────────────

function DocRagTab({ lang, ttsOn, exportReq }) {
  const [session, setSession] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const historyRef = useRef([]);
  const sendRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (exportReq > 0 && messages.length) exportChat(messages, 'Document RAG');
  }, [exportReq]);

  async function handleUpload(file) {
    setUploading(true);
    setUploadError('');
    try {
      const res = await uploadRagDocument(file);
      setSession({ sessionId: res.session_id, fileName: res.file_name, document_count: res.document_count });
      setMessages([]);
      historyRef.current = [];
    } catch (e) {
      setUploadError(e.message || 'Upload failed');
    } finally { setUploading(false); }
  }

  async function clearSession() {
    if (session) { try { await deleteRagSession(session.sessionId); } catch {} }
    setSession(null); setMessages([]); historyRef.current = []; setUploadError('');
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading || !session) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await postRagChat(q, session.sessionId, historyRef.current);
      const answer = res.response || 'No response.';
      historyRef.current = [...historyRef.current, q, answer].slice(-16);
      const msg = { role: 'assistant', content: answer, mode: res.mode || 'rag' };
      setMessages(m => [...m, msg]);
      if (ttsOn) speak(answer, lang);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Request failed: ${e.message}`, mode: 'error' }]);
    } finally { setLoading(false); }
  }
  sendRef.current = send;

  const handleTranscript = useCallback(text => {
    setInput(text);
    setTimeout(() => sendRef.current(text), 80);
  }, []);
  const { listening, statusMsg, startMic, stopMic } = useVoice(lang, handleTranscript);

  return (
    <>
      <div className="ai-tab-toolbar rag-toolbar">
        {session
          ? <SessionBanner session={session} onClear={clearSession} />
          : <span className="rag-toolbar-hint"><FileText size={13} /> Upload a document to start</span>
        }
        <div className="ai-toolbar-right">
          {statusMsg && <span className="ai-voice-status">{statusMsg}</span>}
        </div>
      </div>

      {!session ? (
        <div className="rag-upload-panel">
          <UploadZone onUpload={handleUpload} uploading={uploading} />
          {uploadError && (
            <div className="rag-error">
              <AlertTriangle size={14} />
              <span>{uploadError}</span>
              <button onClick={() => setUploadError('')}><X size={12} /></button>
            </div>
          )}
          <div className="rag-upload-tips">
            <p className="rag-tips-title">What you can upload:</p>
            <ul className="rag-tips-list">
              <li><FileText size={12} /> FIR documents, charge sheets, investigation reports (PDF)</li>
              <li><FileSearch size={12} /> Crime scene photos, evidence images, maps (JPG / PNG / WebP)</li>
              <li><FileText size={12} /> Legal notices, court orders, forensic reports (PDF)</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="ai-scroll" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ai-empty">
                <div className="ai-empty-icon"><FileSearch size={26} /></div>
                <h3>Document Ready</h3>
                <p>Ask any question about the uploaded document. Answers will be grounded in its content.</p>
                <div className="ai-suggest-grid">
                  {['Summarize the key findings', 'What are the main accused mentioned?', 'List the sections / charges invoked', 'What dates and locations are mentioned?'].map((s, i) => (
                    <button key={i} className="ai-suggest" onClick={() => send(s)}>
                      <FileSearch size={14} /><span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              m.role === 'user'
                ? <div key={i} className="ai-msg ai-msg-user"><div className="ai-bubble ai-bubble-user">{m.content}</div></div>
                : <AssistantMessage key={i} m={m} onFollowup={send} lang={lang} ttsOn={ttsOn} />
            ))}
            {loading && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-avatar"><Sparkles size={15} /></div>
                <div className="ai-bubble"><div className="ai-typing"><span /><span /><span /></div></div>
              </div>
            )}
          </div>

          <div className="ai-inputbar">
            <button className={`ai-mic${listening ? ' listening' : ''}`} onClick={listening ? stopMic : startMic} title={listening ? 'Stop recording' : 'Voice input'}>
              {listening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
            <textarea
              className="ai-input" rows={1} value={input}
              placeholder={lang === 'kn' ? 'ದಾಖಲೆಯ ಬಗ್ಗೆ ಕೇಳಿ…' : 'Ask a question about the document…'}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="ai-send" onClick={() => send()} disabled={loading || !input.trim()}><Send size={18} /></button>
          </div>
        </>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────

const TABS = [
  { id: 'fir',   label: 'FIR Database',  icon: Database },
  { id: 'ai',    label: 'AI Chat',        icon: Sparkles },
  { id: 'doc',   label: 'Document RAG',  icon: Upload },
];

export default function AssistantView() {
  const [activeTab, setActiveTab] = useState('fir');
  const [lang, setLang] = useState('en');   // voice/TTS language only
  const [ttsOn, setTtsOn] = useState(false);
  const [exportReq, setExportReq] = useState(0);

  function handleExport() { setExportReq(n => n + 1); }

  return (
    <div className="ai-view">
      <div className="ai-header">
        <div className="ai-header-title">
          <div className="ai-header-icon"><Sparkles size={18} /></div>
          <div>
            <h2>Crime Intelligence Assistant</h2>
            <p>Ask about FIRs, accused, hotspots, offenders &amp; financial links</p>
          </div>
        </div>

        {/* Global controls */}
        <div className="ai-header-controls">
          {/* Voice / TTS language — controls mic input & auto-speak only */}
          <div className="ai-lang" title="Voice input & TTS language">
            {LANG_OPTIONS.map(o => (
              <button
                key={o.value}
                className={lang === o.value ? 'active' : ''}
                onClick={() => setLang(o.value)}
              >{o.label}</button>
            ))}
          </div>

          {/* TTS toggle */}
          <button
            className={`ai-icon-btn${ttsOn ? ' active' : ''}`}
            title={ttsOn ? 'Auto voice: ON' : 'Auto voice: OFF'}
            onClick={() => {
              if (ttsOn) window.speechSynthesis?.cancel();
              setTtsOn(v => !v);
            }}
          >
            {ttsOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Export */}
          <button className="ai-icon-btn" title="Export chat to PDF" onClick={handleExport}>
            <FileDown size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="ai-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`ai-tab-btn${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ai-tab-body">
        {activeTab === 'fir' && <FirChatTab lang={lang} ttsOn={ttsOn} exportReq={exportReq} />}
        {activeTab === 'ai'  && <AiChatTab  lang={lang} ttsOn={ttsOn} exportReq={exportReq} />}
        {activeTab === 'doc' && <DocRagTab  lang={lang} ttsOn={ttsOn} exportReq={exportReq} />}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function exportChat(messages, title) {
  if (!messages.length) return;
  const rows = messages.map(m => {
    if (m.role === 'user') return `<div class="q"><b>Q:</b> ${escapeHtml(m.content)}</div>`;
    const ev = (m.evidence || []).length ? `<div class="ev">Evidence: ${m.evidence.map(escapeHtml).join(', ')}</div>` : '';
    const sql = m.sql ? `<pre class="sql">${escapeHtml(m.sql)}</pre>` : '';
    return `<div class="a"><b>A:</b> ${escapeHtml(m.content || '').replace(/\n/g,'<br>')}${ev}${sql}</div>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Crime Intelligence — ${escapeHtml(title)}</title>
    <style>body{font-family:Inter,Arial,sans-serif;max-width:820px;margin:32px auto;color:#111;padding:0 20px}
    h1{font-size:18px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:18px;border-bottom:2px solid #6366f1;padding-bottom:10px}
    .q{background:#eef2ff;padding:10px 12px;border-radius:8px;margin:14px 0 6px}
    .a{padding:4px 12px 12px;margin-bottom:8px;border-left:3px solid #6366f1}
    .ev{color:#4338ca;font-size:11px;margin-top:6px}.sql{background:#0f172a;color:#a5b4fc;font-size:10px;padding:8px;border-radius:6px;overflow:auto;white-space:pre-wrap}
    .foot{margin-top:24px;color:#888;font-size:10px;border-top:1px solid #ddd;padding-top:8px}</style></head>
    <body><h1>🛡️ Crime Intelligence — ${escapeHtml(title)}</h1>
    <div class="sub">Karnataka State Police · SCRB | Exported ${new Date().toLocaleString()}</div>
    ${rows || '<p>No conversation yet.</p>'}
    <div class="foot">Generated by CrimeScope AI.</div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}