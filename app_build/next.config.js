/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
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
    root: 'C:\\Users\\hp\\OneDrive\\Desktop\\buildwithai\\app_build',
  },
};

module.exports = nextConfig;
