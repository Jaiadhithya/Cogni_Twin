import type { NextConfig } from "next";

// API calls go through the Route Handler proxy at src/app/api/[...path]/route.ts,
// which keeps BACKEND_API_KEY on the server.
const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // `page.dev.tsx` files (the /dev/kit component gallery) are routes in development only.
  pageExtensions: isProd ? ['tsx', 'ts'] : ['dev.tsx', 'tsx', 'ts'],
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
