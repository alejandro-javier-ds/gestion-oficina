// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["node-cron"],
};

export default nextConfig;
