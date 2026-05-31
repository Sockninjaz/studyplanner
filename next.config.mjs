/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  }
};

export default nextConfig;
