"use server"

import { getServerApiUrl, internalApiHeaders } from "@/lib/api-url"
import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// DB columns (camelCase, quoted): id, "userId", label, "dataUrl", "reportDate", "createdAt"

async function requirePremium(userId: string) {
  const res = await query(`SELECT tier FROM profile WHERE "userId" = $1 LIMIT 1`, [userId])
  if (res.rows[0]?.tier !== "premium") throw new Error("PREMIUM_REQUIRED")
}

export async function getLabReports() {
  const userId = await getUserId()
  await requirePremium(userId)
  
  const res = await query(
    `SELECT id, label AS title, "reportDate" AS "uploadedAt", dht, "freeT", ferritin FROM lab_report WHERE "userId" = $1 ORDER BY "reportDate" DESC`,
    [userId],
  )
  return res.rows as { id: string; title: string; uploadedAt: string; dht: number; freeT: number; ferritin: number }[]
}

export type LabValues = { dht: number | null; freeT: number | null; ferritin: number | null }

// The document is always saved; `analyzed` says whether the AI could read any values,
// so the UI can ask the user to enter them by hand instead of silently showing "--".
export async function uploadLabReport(data: {
  title: string
  dataUrl: string
}): Promise<{ id: string; analyzed: boolean; message?: string }> {
  const userId = await getUserId()
  await requirePremium(userId)
  const id = randomUUID()

  // Send to AI extraction pipeline
  let dht = null, freeT = null, ferritin = null;
  let message: string | undefined
  try {
    const base = getServerApiUrl()
    const res = await fetch(`${base}/analyze-lab`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ user_id: userId, data_url: data.dataUrl }),
      cache: "no-store",
    })
    
    const json = await res.json().catch(() => null)
    if (res.ok && json && !json.error) {
      dht = json.dht
      freeT = json.free_t
      ferritin = json.ferritin
    } else {
      console.error("AI Analysis failed:", res.status, json)
      if (json?.error_code === "UNSUPPORTED_FILE") message = json.error_message
    }
  } catch (err) {
    console.error("AI Analysis fetch failed:", err)
  }

  await query(
    `INSERT INTO lab_report (id, "userId", label, "dataUrl", "reportDate", "createdAt", dht, "freeT", ferritin) VALUES ($1, $2, $3, $4, now(), now(), $5, $6, $7)`,
    [id, userId, data.title, data.dataUrl, dht, freeT, ferritin],
  )
  revalidatePath("/")
  return { id, analyzed: dht !== null || freeT !== null || ferritin !== null, message }
}

export async function updateLabValues(id: string, values: LabValues) {
  const userId = await getUserId()
  await requirePremium(userId)
  await query(
    `UPDATE lab_report SET dht = $3, "freeT" = $4, ferritin = $5 WHERE id = $1 AND "userId" = $2`,
    [id, userId, values.dht, values.freeT, values.ferritin],
  )
  revalidatePath("/")
}

export async function deleteLabReport(id: string) {
  const userId = await getUserId()
  await requirePremium(userId)
  await query(`DELETE FROM lab_report WHERE id = $1 AND "userId" = $2`, [id, userId])
  revalidatePath("/")
}
