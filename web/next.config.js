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
  // Proxy API requests to backend in both local dev and production
  async rewrites() {
    const backendHost =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.BACKEND_HOST ||
      (process.env.NODE_ENV === 'production'
        ? 'https://callpulse-api.onrender.com'
        : 'http://localhost:5050');
    return [
      {
        source: '/api/:path*',
        destination: `${backendHost}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
