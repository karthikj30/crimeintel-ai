export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const { proxyToExpress } = require('../../../lib/apiProxy');

export async function GET(request) {
  return proxyToExpress(request);
}

export async function POST(request) {
  return proxyToExpress(request);
}
