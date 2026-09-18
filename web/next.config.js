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
  // Proxy API requests to backend
  async rewrites() {
    const backendHost =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.BACKEND_HOST ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'development'
        ? 'http://127.0.0.1:5050'
        : 'https://vertextai-3lit.onrender.com');
    return [
      {
        source: '/api/:path*',
        destination: `${backendHost.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
