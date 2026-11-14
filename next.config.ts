import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // a stray package-lock.json in the home folder confuses root detection on this PC
  turbopack: { root: __dirname },
};

export default nextConfig;
