export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const { proxyToExpress } = require('../../../../../lib/apiProxy');

export async function GET(request) {
  return proxyToExpress(request);
}

export async function DELETE(request) {
  return proxyToExpress(request);
}
