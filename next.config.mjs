/**
 * Next.js configuration optimized for Docker standalone runtime
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a minimal server output for the Docker runner stage
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
};

export default nextConfig;