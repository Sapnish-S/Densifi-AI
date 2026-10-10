// FastAPI "Densify Core Engine" base URL resolution.
//
// NEXT_PUBLIC_API_URL is inlined at build time (set per environment as a Docker build arg);
// outside localhost it is required.

const LOCAL_API_URL = "http://localhost:8000"

function strip(url: string): string {
  return url.replace(/\/+$/, "")
}

/** Browser-side URL (localhost → local API). */
export function getPublicApiUrl(): string {
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  return strip(process.env.NEXT_PUBLIC_API_URL || (isLocal ? LOCAL_API_URL : ""))
}

/**
 * Server-side URL (server actions). API_INTERNAL_URL lets pods call the api Service
 * in-cluster instead of going back out through the CDN; falls back to the public URL.
 */
export function getServerApiUrl(): string {
  return strip(
    process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "development" ? LOCAL_API_URL : ""),
  )
}

/** Optional shared-secret header for server-to-server calls */
export function internalApiHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET
  return secret ? { "X-Internal-Secret": secret } : {}
}
