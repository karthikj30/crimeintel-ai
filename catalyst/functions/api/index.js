// ============================================================
// Catalyst Serverless Function — API Gateway entry point
// ------------------------------------------------------------
// Deploy with: catalyst deploy --only functions
// Routes all /api/* traffic through the shared serverless handlers.
// Data loads from Catalyst Data Store OR HuggingFace dataset URL.
// ============================================================

const url = require('url');
const handlers = require('../../app_build/server/api/serverlessHandlers');

module.exports = async (context, basicIO) => {
  const req = basicIO.getRequestDetails();
  const method = (req.method || 'GET').toUpperCase();
  const pathParts = (req.path || '/').replace(/^\/api\/?/, '').split('/').filter(Boolean);

  try {
  if (pathParts[0] === 'health') {
    return basicIO.write(JSON.stringify({
      status: 'ok', platform: 'KSP Crime Intelligence', deployment: 'catalyst',
      timestamp: new Date().toISOString(),
    }));
  }

  if (pathParts[0] === 'chat') {
    if (pathParts[1] === 'status' && method === 'GET') {
      return basicIO.write(JSON.stringify(handlers.chatStatus()));
    }
    if (method === 'POST' && !pathParts[1]) {
      const body = JSON.parse(basicIO.getRequestBody() || '{}');
      const { status, body: payload } = await handlers.handleChatPost(body);
      basicIO.setStatusCode(status);
      return basicIO.write(JSON.stringify(payload));
    }
    if (pathParts[1] && method === 'GET') {
      const history = handlers.getSessionHistory(pathParts[1]);
      if (!history) { basicIO.setStatusCode(404); return basicIO.write(JSON.stringify({ error: 'session not found' })); }
      return basicIO.write(JSON.stringify(history));
    }
  }

  if (pathParts[0] === 'network') {
    if (pathParts[1] === 'graph') {
      const q = url.parse(req.url || '', true).query;
      const max = Math.min(200, parseInt(q.max, 10) || 110);
      return basicIO.write(JSON.stringify(await handlers.handleNetworkGraph(max)));
    }
    if (pathParts[1] === 'gangs') {
      return basicIO.write(JSON.stringify(await handlers.handleNetworkGangs()));
    }
    if (pathParts[1] === 'person' && pathParts[2]) {
      const result = await handlers.handleNetworkPerson(pathParts[2]);
      if (result.status) { basicIO.setStatusCode(result.status); return basicIO.write(JSON.stringify(result.body)); }
      return basicIO.write(JSON.stringify(result));
    }
  }

  if (pathParts[0] === 'fir' && pathParts[1]) {
    const fn = handlers.firHandlers[pathParts[1]];
    if (!fn) { basicIO.setStatusCode(404); return basicIO.write(JSON.stringify({ error: 'not found' })); }
    return basicIO.write(JSON.stringify(await fn()));
  }

  basicIO.setStatusCode(404);
  return basicIO.write(JSON.stringify({ error: 'route not found', path: pathParts }));
  } catch (e) {
    basicIO.setStatusCode(500);
    return basicIO.write(JSON.stringify({ error: e.message }));
  }
};
