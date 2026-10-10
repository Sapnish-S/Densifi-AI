"use server"

import { getServerApiUrl, internalApiHeaders } from "@/lib/api-url"
import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"
import { randomUUID } from "crypto"
// Vercel build fix: Removed maxDuration from 'use server' file.

const FASTAPI_BASE = getServerApiUrl();

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// ── Safe date parser ──────────────────────────────────────────────────────────
// The pg driver returns TIMESTAMP columns as JS Date objects, not strings.
// This helper normalises either form and returns a fallback on failure.

function safeIso(val: unknown): string {
  if (!val) return ""
  if (val instanceof Date) return isNaN(val.getTime()) ? "" : val.toISOString()
  if (typeof val === "string") return val
  return ""
}

function safeDateLabel(val: unknown, fallback = "Recent"): string {
  try {
    const iso = safeIso(val)
    if (!iso) return fallback
    const d = new Date(iso)
    if (isNaN(d.getTime())) return fallback
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  } catch {
    return fallback
  }
}

function safeSlice10(val: unknown): string {
  const iso = safeIso(val)
  return iso ? iso.slice(0, 10) : ""
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MiniaturizationPoint {
  date: string
  density_percentage: number
  miniaturization_index: number
  photo_id: string | null
}

export interface ProgressAnalytics {
  baseline_density: number | null
  current_density: number | null
  delta_percentage: number | null
  data_points: number
  trend: "improving" | "declining" | "stable" | "insufficient_data"
  baseline_date?: string
  current_date?: string
}

export interface Telemetry {
  miniaturization_matrix: MiniaturizationPoint[]
  compliance_score: number
  progress_analytics: ProgressAnalytics
  last_checkin_date: string | null
}

// ── Telemetry — built directly from PostgreSQL (no FastAPI dependency) ────────

export async function getTelemetry(): Promise<Telemetry> {
  try {
    const userId = await getUserId()

    // 1. Miniaturization matrix — progress photos joined with AI analysis
    const photoRes = await query(
      `SELECT
         p.id                                              AS photo_id,
         TO_CHAR(p."takenAt", 'YYYY-MM-DD')              AS date,
         COALESCE(
           (am.content::json ->> 'density_percentage')::float,
           0.0
         )                                                AS density_percentage,
         COALESCE(
           (am.content::json ->> 'miniaturization_index')::float,
           0.0
         )                                                AS miniaturization_index
       FROM progress_photo p
       LEFT JOIN agent_message am
         ON am."photoId" = p.id
         AND am."userId" = $1
         AND am.role = 'assistant'
         AND am.content LIKE '%miniaturization_index%'
       WHERE p."userId" = $1
       ORDER BY p."takenAt" ASC
       LIMIT 90`,
      [userId],
    )

    const matrix: MiniaturizationPoint[] = (photoRes.rows as {
      photo_id: string
      date: unknown
      density_percentage: number
      miniaturization_index: number
    }[]).map((row) => ({
      date: safeSlice10(row.date) || safeSlice10(new Date()),
      density_percentage: Number(row.density_percentage) || 0,
      miniaturization_index: Number(row.miniaturization_index) || 0,
      photo_id: row.photo_id,
    }))

    // 2. Compliance score — 90-day daily_checkin aggregation
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    const compRes = await query(
      `SELECT
         COUNT(*)                                          AS total_days,
         COUNT(CASE WHEN treatment_taken THEN 1 END)      AS taken_days,
         MAX("createdAt")                                 AS last_checkin
       FROM daily_checkin
       WHERE "userId" = $1
         AND date >= $2
         AND date <= $3`,
      [userId, ninetyDaysAgo, today],
    )

    const compRow = compRes.rows[0] as {
      total_days: string | number
      taken_days: string | number
      last_checkin: unknown
    } | undefined

    const totalDays = Number(compRow?.total_days ?? 0)
    const takenDays = Number(compRow?.taken_days ?? 0)
    const complianceScore = totalDays > 0 ? Math.round((takenDays / totalDays) * 100) : 0
    const lastCheckinDate = compRow?.last_checkin ? safeSlice10(compRow.last_checkin) : null

    // 3. Progress analytics
    let progress_analytics: ProgressAnalytics = {
      baseline_density: null,
      current_density: null,
      delta_percentage: null,
      data_points: matrix.length,
      trend: "insufficient_data",
    }

    if (matrix.length >= 2) {
      const baseline = matrix[0]
      const current = matrix[matrix.length - 1]
      if (baseline.density_percentage > 0) {
        const delta = current.density_percentage - baseline.density_percentage
        const deltaPct = Math.round((delta / baseline.density_percentage) * 100 * 10) / 10
        progress_analytics = {
          baseline_density: baseline.density_percentage,
          current_density: current.density_percentage,
          delta_percentage: deltaPct,
          data_points: matrix.length,
          trend: delta > 0 ? "improving" : delta < 0 ? "declining" : "stable",
          baseline_date: baseline.date,
          current_date: current.date,
        }
      }
    }

    return {
      miniaturization_matrix: matrix,
      compliance_score: complianceScore,
      progress_analytics,
      last_checkin_date: lastCheckinDate,
    }
  } catch (err) {
    console.error("[telemetry] getTelemetry failed:", err)
    return {
      miniaturization_matrix: [],
      compliance_score: 0,
      progress_analytics: {
        baseline_density: null,
        current_density: null,
        delta_percentage: null,
        data_points: 0,
        trend: "insufficient_data",
      },
      last_checkin_date: null,
    }
  }
}

// ── Vault photo types ──────────────────────────────────────────────────────────

export interface VaultPhoto {
  id: string
  s3_key: string | null
  data_url: string
  label: string          // "Front" | "Crown" | "Side"
  taken_at: string       // ISO datetime string (normalised from DB Date)
  month: string          // e.g. "2025-01"
}

export interface VaultMonth {
  id: string             // YYYY-MM
  month: string          // e.g. "Jun 2025"
  date: string           // first photo date in this month (YYYY-MM-DD)
  photos: VaultPhoto[]
}

// ── Vault photos — fetched directly from PostgreSQL ──────────────────────────
// DB columns (camelCase, quoted): "userId", "dataUrl", angle, "takenAt", "createdAt"
// vault-save also writes s3_key into a separate column — select both and prefer s3_key.

function extractS3Key(dataUrl: string): string | null {
  if (!dataUrl) return null
  // Akamai Object Storage: strip the configured public base URL prefix.
  const base = (process.env.S3_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "")
  if (base && dataUrl.startsWith(base + "/")) return dataUrl.slice(base.length + 1)
  return null
}

export async function getVaultMonths(): Promise<VaultMonth[]> {
  try {
    const userId = await getUserId()

    const res = await query(
      `SELECT
         id,
         COALESCE("dataUrl", '')               AS "dataUrl",
         angle,
         "takenAt",
         TO_CHAR("takenAt", 'YYYY-MM')         AS month_key
       FROM progress_photo
       WHERE "userId" = $1
       ORDER BY "takenAt" ASC`,
      [userId],
    )

    const rows = res.rows as {
      id: string
      dataUrl: string
      angle: string
      takenAt: unknown        // pg returns TIMESTAMP as JS Date
      month_key: string
    }[]

    if (!rows || rows.length === 0) return []

    // Group by YYYY-MM
    const monthMap = new Map<string, VaultMonth>()
    for (const row of rows) {
      const key = row.month_key ?? safeSlice10(row.takenAt).slice(0, 7)
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          id: key,
          month: safeDateLabel(row.takenAt),
          date: safeSlice10(row.takenAt),
          photos: [],
        })
      }
      monthMap.get(key)!.photos.push({
        id: row.id,
        s3_key: extractS3Key(row.dataUrl),
        data_url: row.dataUrl,
        label: row.angle,
        taken_at: safeIso(row.takenAt),
        month: key,
      })
    }

    const months = Array.from(monthMap.values())

    // Feature flag (default off = public-read URLs): sign short-lived GET URLs.
    if (process.env.VAULT_PRESIGNED_GET === "true") {
      const { createPresignedGetUrl } = await import("@/lib/s3")
      await Promise.all(
        months.flatMap((m) =>
          m.photos
            .filter((p) => p.s3_key)
            .map(async (p) => { p.data_url = await createPresignedGetUrl(p.s3_key!) }),
        ),
      )
    }

    return months
  } catch (error) {
    console.error("[vault] getVaultMonths failed:", error)
    return []
  }
}

// ── Medications ───────────────────────────────────────────────────────────────
// DB columns: id, "userId", name, dose, frequency, "startDate", notes, active, "createdAt", "updatedAt"

export interface MedicationRow {
  id: string
  name: string
  dosage: string | null
  frequency: string | null
  notes: string | null
  active: boolean
  createdAt: string
}

export async function getActiveMedications(): Promise<MedicationRow[]> {
  const userId = await getUserId()
  const res = await query(
    `SELECT id, name, dose AS "dosage", frequency, notes, active, "createdAt"
     FROM medication
     WHERE "userId" = $1 AND active = true
     ORDER BY "createdAt" ASC`,
    [userId],
  )
  return res.rows as MedicationRow[]
}

// ── Check-in — upsert directly to PostgreSQL ──────────────────────────────────
// DB columns: id, "userId", date, treatment_taken, notes, "createdAt", "updatedAt"

export async function submitCheckin(
  treatmentTaken: boolean,
  notes: string = "",
  clientTimezone?: string,
  loggedDate?: string,
): Promise<void> {
  const userId = await getUserId()
  const reqHeaders = await headers()
  const tz = clientTimezone || reqHeaders.get(process.env.TZ_HEADER_NAME || "x-client-timezone") || "UTC"
  const dateStr = loggedDate || new Date().toISOString()

  await fetch(`${FASTAPI_BASE}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalApiHeaders() },
    body: JSON.stringify({
      user_id: userId,
      treatment_taken: treatmentTaken,
      notes,
      client_timezone: tz,
      logged_date: dateStr,
    }),
    cache: "no-store",
  })
}

// ── Bedrock analysis — proxy to the FastAPI /analyze endpoint ─────────────────

export interface AnalysisResult {
  miniaturization_index: number
  density_percentage: number
  clinical_summary: string
  model_chain: string[]
}

export interface AnalysisError {
  error: true
  error_code: string
  error_message: string
  recoverable: boolean
}

export async function analyzeVaultImage(s3Key: string): Promise<AnalysisResult | AnalysisError> {
  const userId = await getUserId()
  try {
    const res = await fetch(`${FASTAPI_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ user_id: userId, s3_key: s3Key }),
      cache: "no-store",
    })
    
    if (!res.ok) {
      console.error(`[telemetry] analyzeVaultImage API returned ${res.status}:`, await res.text().catch(() => "no body"))
      return { error: true, error_code: "API_ERROR", error_message: `Analysis service returned ${res.status}`, recoverable: false }
    }
    
    return await res.json() as Promise<AnalysisResult | AnalysisError>
  } catch (err) {
    console.error("[telemetry] analyzeVaultImage failed:", err)
    return { error: true, error_code: "FETCH_FAILED", error_message: "Could not reach analysis service", recoverable: true }
  }
}
