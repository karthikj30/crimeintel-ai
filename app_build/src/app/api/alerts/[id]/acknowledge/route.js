export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const { proxyToExpress } = require('../../../../../lib/apiProxy');

export async function PATCH(request) {
  return proxyToExpress(request);
}
