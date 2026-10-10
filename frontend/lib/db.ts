import { Pool, type ClientBase } from "pg"
import { attachDatabasePool } from "@vercel/functions"

// Akamai Managed PostgreSQL — static credentials over TLS.
// DATABASE_URL carries host/user/password/db. The cluster CA is supplied either as
// PEM text (PG_CA_CERT) or as a file path (PGSSLROOTCERT, read by node-postgres'
// connection-string parser via `sslrootcert=`). Set PG_SSL=disable for local dev.
function sslConfig() {
  if (process.env.PG_SSL === "disable") return undefined
  const ca = process.env.PG_CA_CERT
  if (ca) {
    // Accept PEM text or single-line base64 PEM (easier to paste into Vercel's env UI).
    const pem = ca.includes("BEGIN CERTIFICATE") ? ca : Buffer.from(ca, "base64").toString("utf8")
    return { ca: pem, rejectUnauthorized: true }
  }
  return { rejectUnauthorized: true }
}

function connectionString() {
  const url = process.env.DATABASE_URL
  // node-postgres lets sslmode in the URL override the `ssl` object; strip it so the
  // explicit CA config above always applies.
  return url ? url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "") : url
}

export const pool = new Pool({
  connectionString: connectionString(),
  ssl: sslConfig(),
  max: 10,
})

// On Vercel (Fluid compute) let the platform close idle connections before an
// instance is suspended. No-op elsewhere.
if (process.env.VERCEL) attachDatabasePool(pool)

/** Single parameterized query — always use $1/$2 placeholders */
export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params)
}

/** Multi-statement transaction */
export async function withConnection<T>(
  fn: (client: ClientBase) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
