/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["api"],
  experimental: {
    externalDir: true,
  },
}

module.exports = nextConfig