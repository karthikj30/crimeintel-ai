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
  serverExternalPackages: ['better-sqlite3', 'sql.js'],
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;
