import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
// trigger build
