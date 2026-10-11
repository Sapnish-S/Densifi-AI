// Same-origin proxy for site imagery that must be read by WebGL (hero regrowth). Akamai's
// us-ord-10 buckets don't support CORS configuration, so cross-origin texture loads fail;
// /site-proxy/* → `${site assets base}/*` makes them same-origin. See lib/site-assets.ts.
const siteAssetsBase =
  process.env.NEXT_PUBLIC_SITE_ASSETS_URL?.replace(/\/+$/, "") ||
  (process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/site`
    : "")

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
  experimental: {
    // Lab reports are sent to a server action as a base64 data URL; the 1 MB default rejected
    // most PDFs. Vercel caps request bodies at 4.5 MB, so stay just under it (the client
    // limits PDFs to 3 MB and shrinks photos before upload).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async rewrites() {
    return siteAssetsBase ? [{ source: "/site-proxy/:path*", destination: `${siteAssetsBase}/:path*` }] : []
  },
}

export default nextConfig
