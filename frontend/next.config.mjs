/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the LKE container image.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Better Auth and pg must not be bundled by Next.js
  serverExternalPackages: ["better-auth", "pg"],
}

export default nextConfig
