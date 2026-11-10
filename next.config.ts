import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Next dev refuses non-localhost hosts unless listed here. Needed for the
  // Phase 1 custom-origin check at http://sdk-test.local:3000.
  allowedDevOrigins: ['sdk-test.local'],
};

export default nextConfig;
