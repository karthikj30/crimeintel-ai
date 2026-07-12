// ============================================================
// CRIME INTELLIGENCE — RAG Routes
// ------------------------------------------------------------
// Node.js/Express port of the Python FastAPI RAG backend.
//
// Endpoints:
//   POST /api/rag/free-chat          Free-form crime intel chat (Gemini)
//   POST /api/rag/upload             Upload PDF or image → build RAG session
//   POST /api/rag/chat               RAG chat over uploaded document
//   GET  /api/rag/sessions/:id       Session status
//   DELETE /api/rag/sessions/:id     Delete session + files
//
// Requires: npm install @google/genai pdf-parse multer
// ============================================================

'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const rag = require('../ai/ragProvider');

const router = express.Router();

// ── Multer upload config ─────────────────────────────────────
const uploadDir = path.join(rag.DATA_DIR, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const sessionId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${sessionId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: rag.MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [...rag.ALLOWED_PDF_EXTS, ...rag.ALLOWED_IMAGE_EXTS];
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`File type not allowed. Accepted: ${allowed.join(', ')}`));
  },
});

// ── Helper ────────────────────────────────────────────────────
function isImage(filename) {
  return rag.ALLOWED_IMAGE_EXTS.includes(path.extname(filename).toLowerCase());
}

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
};

function getMime(filename) {
  return MIME_MAP[path.extname(filename).toLowerCase()] || 'image/jpeg';
}

// ── POST /api/rag/free-chat ────────────────────────────────────
router.post('/free-chat', async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const start = Date.now();
  try {
    const result = await rag.freeChat(String(message).trim(), Array.isArray(history) ? history : []);
    res.json({
      response: result.answer,
      mode: result.mode,
      model: result.model,
      processing_time: (Date.now() - start) / 1000,
    });
  } catch (err) {
    console.error('[RAG free-chat]', err.message);
    // If Gemini is not configured, return a structured fallback
    if (err.message.includes('GEMINI_API_KEY') || err.message.includes('GOOGLE_API_KEY')) {
      return res.status(503).json({
        error: 'Gemini API key not configured.',
        hint: 'Set GEMINI_API_KEY in app_build/.env to enable AI responses.',
        response: _fallbackResponse(message),
        mode: 'fallback',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rag/upload ────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  const file      = req.file;
  const filePath  = file.path;
  const fileName  = file.originalname;
  // sessionId is embedded in the filename by multer
  const sessionId = path.basename(file.filename, path.extname(file.filename));

  try {
    const fileHash  = rag.hashFile(filePath);
    const fileIsImg = isImage(fileName);
    const mimeType  = fileIsImg ? getMime(fileName) : undefined;

    const result = await rag.buildSession(sessionId, filePath, fileName, fileIsImg, mimeType);

    res.json({
      success: true,
      message: `${fileIsImg ? 'Image' : 'PDF'} processed successfully. Extracted ${result.chunks} chunks.`,
      session_id: sessionId,
      file_hash: fileHash,
      document_count: result.chunks,
      file_name: fileName,
    });
  } catch (err) {
    console.error('[RAG upload]', err.message);
    // Clean up uploaded file on error
    try { fs.unlinkSync(filePath); } catch {}
    if (err.message.includes('GEMINI_API_KEY') || err.message.includes('GOOGLE_API_KEY')) {
      return res.status(503).json({
        error: 'Gemini API key not configured.',
        hint: 'Set GEMINI_API_KEY in app_build/.env to enable image/vision analysis.',
      });
    }
    res.status(500).json({ error: `File processing failed: ${err.message}` });
  }
});

// ── POST /api/rag/chat ──────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, session_id, history } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  const start = Date.now();
  try {
    const result = await rag.ragChat(
      String(session_id),
      String(message).trim(),
      Array.isArray(history) ? history : []
    );
    res.json({
      response: result.answer,
      session_id,
      mode: result.mode,
      model: result.model,
      processing_time: (Date.now() - start) / 1000,
    });
  } catch (err) {
    console.error('[RAG chat]', err.message);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('GEMINI_API_KEY') || err.message.includes('GOOGLE_API_KEY')) {
      return res.status(503).json({
        error: 'Gemini API key not configured.',
        hint: 'Set GEMINI_API_KEY in app_build/.env',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rag/sessions/:id ───────────────────────────────────
router.get('/sessions/:id', (req, res) => {
  const status = rag.getSessionStatus(req.params.id);
  if (!status) return res.status(404).json({ exists: false });
  res.json(status);
});

// ── DELETE /api/rag/sessions/:id ───────────────────────────────
router.delete('/sessions/:id', (req, res) => {
  rag.deleteSession(req.params.id);
  // Also clean up uploaded file
  const uploadsDir = path.join(rag.DATA_DIR, 'uploads');
  for (const ext of [...rag.ALLOWED_PDF_EXTS, ...rag.ALLOWED_IMAGE_EXTS]) {
    const f = path.join(uploadsDir, `${req.params.id}${ext}`);
    if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
  }
  res.json({ message: 'Session deleted.' });
});

// ── Multer error handler ─────────────────────────────────────
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50 MB.' });
  }
  res.status(400).json({ error: err.message });
});

// ── Fallback response (no API key) ───────────────────────────
function _fallbackResponse(question) {
  return [
    'Gemini API is not configured. Running in offline mode.',
    '',
    'For AI-powered crime intelligence answers, set GEMINI_API_KEY in app_build/.env',
    '',
    'In offline mode, you can still use the full FIR database query system via the main chat.',
    '',
    `Your question: "${question}"`,
    '',
    'Suggested alternatives:',
    '• Use the main chat tab which runs the offline rule engine (no API key needed)',
    '• Ask about specific FIR numbers, districts, or crime types',
  ].join('\n');
}

module.exports = router;
