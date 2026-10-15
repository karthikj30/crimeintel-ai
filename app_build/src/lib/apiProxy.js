// ============================================================
// Local dev proxy — forwards /api/* to Express on :3000
// Used when Next.js API routes run via `npm run serve` without VERCEL.
// ============================================================

const EXPRESS_BASE = process.env.EXPRESS_API_URL || 'http://localhost:3000';

// On Vercel there is no separate Express process to forward to. Unless
// EXPRESS_API_URL points at one, start the same Express app inside this
// function on a loopback port, once per instance, and forward to that.
let inProcessBase = null;

function expressBase() {
  if (process.env.EXPRESS_API_URL || !process.env.VERCEL) return Promise.resolve(EXPRESS_BASE);
  if (!inProcessBase) {
    inProcessBase = new Promise((resolve, reject) => {
      const app = require('../../server/index.js');
      const srv = app.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${srv.address().port}`));
      srv.on('error', (err) => { inProcessBase = null; reject(err); });
    });
  }
  return inProcessBase;
}

async function proxyToExpress(request, pathname) {
  const url = new URL(request.url);
  let base;
  try {
    base = await expressBase();
  } catch (err) {
    return Response.json({ error: `Backend failed to start: ${err.message}` }, { status: 503 });
  }
  const target = `${base}${pathname || url.pathname}${url.search}`;

  // Forward original content-type so multipart uploads work correctly
  const contentType = request.headers.get('content-type');
  const headers = contentType ? { 'Content-Type': contentType } : {};
  const init = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Use arrayBuffer to preserve binary data (file uploads)
    init.body = await request.arrayBuffer();
  }

  let res;
  try {
    res = await fetch(target, init);
  } catch (err) {
    return Response.json(
      { error: `Backend unreachable at ${EXPRESS_BASE}. Run: npm run backend` },
      { status: 503 },
    );
  }

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  });
}

function useExpressProxy() {
  return !process.env.VERCEL && !process.env.USE_SQLJS;
}

module.exports = { proxyToExpress, useExpressProxy, EXPRESS_BASE };
