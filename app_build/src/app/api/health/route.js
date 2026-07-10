export const runtime = 'nodejs';

const { proxyToExpress } = require('../../../lib/apiProxy');

export async function GET(request) {
  return proxyToExpress(request);
}
