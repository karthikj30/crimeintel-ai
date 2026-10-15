// ============================================================
// KSP CRIME INTELLIGENCE — Express + Socket.io Server Entry Point
// ============================================================

// Lightweight .env loader (no dependency) so ANTHROPIC_API_KEY /
// KSP_LLM_MODEL can be set in app_build/.env to enable the Claude brain.
try {
  require('fs').readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8')
    .split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
} catch { /* no .env present — offline engine will be used */ }

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { getDb, seedDatabase } = require('./database');
const { setupSocketHandler } = require('./socket/handler');

// Import routes
const incidentRoutes = require('./routes/incidents');
const analyticsRoutes = require('./routes/analytics');
const alertRoutes = require('./routes/alerts');
const searchRoutes = require('./routes/search');
const chatRoutes = require('./routes/chat');
const networkRoutes = require('./routes/network');
const firRoutes = require('./routes/fir');
const intelRoutes = require('./routes/intel');
const ragRoutes = require('./routes/rag');
const { seedFir } = require('./fir/seed');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH'],
  },
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
}));
app.use(express.json());

// API Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/fir', firRoutes);
app.use('/api/intel', intelRoutes);
app.use('/api/rag', ragRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Initialize
console.log('');
console.log('  ╔═══════════════════════════════════════════════════╗');
console.log('  ║          🛡️  CRIMESCOPE AI  v1.0                  ║');
console.log('  ║    Real-Time Crime Intelligence Platform          ║');
console.log('  ╚═══════════════════════════════════════════════════╝');
console.log('');
console.log('  ⏳ Initializing database...');

// Initialize database
const db = getDb();
seedDatabase();
seedFir(); // KSP FIR database (Karnataka crime records) for the conversational AI

console.log('  ✓ Database ready');
console.log('');

module.exports = app;

// Imported by the Next.js API routes on Vercel (see src/lib/apiProxy.js):
// they only need the Express app, not a socket server or a fixed port.
if (require.main === module) {
  // Setup WebSocket
  setupSocketHandler(io);

  // Start server
  server.listen(PORT, () => {
    console.log(`  🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`  📡 WebSocket ready on ws://localhost:${PORT}`);
    console.log(`  🌐 Frontend at http://localhost:3001`);
    console.log('');
    console.log('  API Endpoints:');
    console.log('  ├── GET  /api/incidents');
    console.log('  ├── GET  /api/incidents/heatmap');
    console.log('  ├── GET  /api/analytics/overview');
    console.log('  ├── GET  /api/analytics/temporal');
    console.log('  ├── GET  /api/analytics/categories');
    console.log('  ├── GET  /api/analytics/regions');
    console.log('  ├── GET  /api/analytics/anomalies');
    console.log('  ├── GET  /api/alerts');
    console.log('  ├── GET  /api/search?q=');
    console.log('  ├── POST /api/rag/free-chat   (Gemini AI chat)');
    console.log('  ├── POST /api/rag/upload      (PDF / image upload)');
    console.log('  ├── POST /api/rag/chat        (RAG document chat)');
    console.log('  └── GET  /api/health');
    console.log('');
  });
}
