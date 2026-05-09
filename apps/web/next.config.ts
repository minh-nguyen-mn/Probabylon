import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: ".next-app",
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
