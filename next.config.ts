import type { NextConfig } from 'next';

const standalone = process.env.NEXT_STANDALONE === '1';

const nextConfig: NextConfig = {
  // unpdf bundles pdf.js; keeping it external avoids webpack/ESM interop issues.
  serverExternalPackages: ['unpdf', 'better-sqlite3'],
  // Only the Docker image needs standalone output; local builds skip it to avoid
  // Windows symlink issues.
  ...(standalone ? { output: 'standalone' as const } : {}),
};

export default nextConfig;
