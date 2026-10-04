import type { NextConfig } from "next";

// API calls go through the Route Handler proxy at src/app/api/[...path]/route.ts,
// which keeps BACKEND_API_KEY on the server.
const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/query', destination: '/ask', permanent: false },
      { source: '/ingest', destination: '/upload', permanent: false },
    ];
  },
  // Lets a second dev server run beside another one without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
