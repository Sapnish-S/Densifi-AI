/**
 * Static site imagery (logos, icons, hero photos, mascots…) lives in Object Storage,
 * not in the repo: Akamai Object Storage in staging/prod, SeaweedFS locally.
 * Objects sit under the `site/` prefix of the vault bucket and are uploaded with
 * `npm run assets:upload` (see README → "Site assets").
 *
 * Base URL: NEXT_PUBLIC_SITE_ASSETS_URL if set, else `${NEXT_PUBLIC_S3_PUBLIC_BASE_URL}/site`.
 * Both are inlined at build time.
 */
const explicit = process.env.NEXT_PUBLIC_SITE_ASSETS_URL?.replace(/\/+$/, "")
const bucket = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL?.replace(/\/+$/, "")

export const SITE_ASSETS_BASE = explicit || (bucket ? `${bucket}/site` : "")

/**
 * Same-origin URL for an asset (via the /site-proxy rewrite in next.config.mjs). Use only
 * where the pixels must be readable — e.g. WebGL textures — since it routes through the app.
 */
export function siteAssetProxied(url: string): string {
  return SITE_ASSETS_BASE && url.startsWith(SITE_ASSETS_BASE)
    ? `/site-proxy${url.slice(SITE_ASSETS_BASE.length)}`
    : url
}

/** Absolute URL of a site asset, e.g. siteAsset("brand/logo-white.png"). */
export function siteAsset(path: string): string {
  const clean = path.replace(/^\/+/, "")
  return SITE_ASSETS_BASE ? `${SITE_ASSETS_BASE}/${clean}` : `/${clean}`
}
