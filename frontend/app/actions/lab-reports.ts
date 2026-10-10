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
  
  // Ensure the DB has the correct schema (will be ignored if it exists)
  await query(`ALTER TABLE lab_report ADD COLUMN IF NOT EXISTS dht NUMERIC, ADD COLUMN IF NOT EXISTS "freeT" NUMERIC, ADD COLUMN IF NOT EXISTS ferritin NUMERIC`);

  const res = await query(
    `SELECT id, label AS title, "reportDate" AS "uploadedAt", dht, "freeT", ferritin FROM lab_report WHERE "userId" = $1 ORDER BY "reportDate" DESC`,
    [userId],
  )
  return res.rows as { id: string; title: string; uploadedAt: string; dht: number; freeT: number; ferritin: number }[]
}

export async function uploadLabReport(data: { title: string; dataUrl: string }) {
  const userId = await getUserId()
  await requirePremium(userId)
  const id = randomUUID()

  // Send to AI extraction pipeline
  let dht = null, freeT = null, ferritin = null;
  try {
    const base = getServerApiUrl()
    const res = await fetch(`${base}/analyze-lab`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ user_id: userId, data_url: data.dataUrl }),
      cache: "no-store",
    })
    
    if (res.ok) {
      const json = await res.json()
      if (!json.error) {
        dht = json.dht
        freeT = json.free_t
        ferritin = json.ferritin
      } else {
        console.error("AI Analysis returned error:", json.error_message)
      }
    } else {
      console.error("AI Analysis HTTP error:", res.status, await res.text())
    }
  } catch (err) {
    console.error("AI Analysis fetch failed:", err)
  }

  await query(
    `INSERT INTO lab_report (id, "userId", label, "dataUrl", "reportDate", "createdAt", dht, "freeT", ferritin) VALUES ($1, $2, $3, $4, now(), now(), $5, $6, $7)`,
    [id, userId, data.title, data.dataUrl, dht, freeT, ferritin],
  )
  revalidatePath("/")
  return id
}

export async function deleteLabReport(id: string) {
  const userId = await getUserId()
  await requirePremium(userId)
  await query(`DELETE FROM lab_report WHERE id = $1 AND "userId" = $2`, [id, userId])
  revalidatePath("/")
}
