// ============================================================
// CRIMESCOPE AI — Express + Socket.io Server Entry Point
// ============================================================

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

console.log('  ✓ Database ready');
console.log('');

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
  console.log('  └── GET  /api/health');
  console.log('');
});
