/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for production Docker deployment
  output: process.env.DOCKER_BUILD === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  experimental: {
    typedRoutes: true,
  },
  // Disable middleware for static export
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
