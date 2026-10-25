import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // unpdf bundles pdf.js; keeping it external avoids webpack/ESM interop issues.
  serverExternalPackages: ['unpdf'],
};

export default nextConfig;
