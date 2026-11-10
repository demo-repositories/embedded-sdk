import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: { styledComponents: true },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
