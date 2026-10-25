import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // unpdf bundles pdf.js; keeping it external avoids webpack/ESM interop issues.
  serverExternalPackages: ['unpdf', 'better-sqlite3'],
};

export default nextConfig;
