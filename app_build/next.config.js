/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // On Vercel, API routes are served by Next.js directly (no Express proxy).
    if (process.env.VERCEL) return [];
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3000/api/:path*',
        },
      ],
    };
  },
  turbopack: {
    root: __dirname,
  },
  // sql.js WASM for serverless SQLite; allow importing server/ from API routes
  // The Express backend runs inside the API routes on Vercel (src/lib/apiProxy.js).
  // Keep it and its native/CommonJS dependencies out of the bundle, and ship
  // the JSON reference data it reads from disk.
  serverExternalPackages: ['better-sqlite3', 'sql.js', 'express', 'socket.io', 'multer', 'pdf-parse', '@google/genai'],
  outputFileTracingIncludes: {
    '/api/**': ['./server/**/*.js', './server/data/*.json'],
  },
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;
