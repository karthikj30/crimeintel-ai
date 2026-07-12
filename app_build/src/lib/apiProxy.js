// ============================================================
// Local dev proxy — forwards /api/* to Express on :3000
// Used when Next.js API routes run via `npm run serve` without VERCEL.
// ============================================================

const EXPRESS_BASE = process.env.EXPRESS_API_URL || 'http://localhost:3000';

async function proxyToExpress(request, pathname) {
  const url = new URL(request.url);
  const target = `${EXPRESS_BASE}${pathname || url.pathname}${url.search}`;

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
