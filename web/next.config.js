/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: Use 'output: export' for production static export
  // For development, we need middleware support, so we leave it as default
  images: {
    unoptimized: true,
  },
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
