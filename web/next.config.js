/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Standalone output for Docker (optimized single-server deployment)
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  images: {
    unoptimized: true,
  },
  experimental: {
    typedRoutes: true,
  },
  // Proxy API requests to backend in production
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5050/api/:path*',
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
