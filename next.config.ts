// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['better-sqlite3', 'node-cron'],
};

export default nextConfig;