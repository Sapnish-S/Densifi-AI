"use server"

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

// DB columns (camelCase, quoted): id, "userId", tier, "displayName", avatar, "createdAt", "updatedAt"

export async function getProfile() {
  const userId = await getUserId()
  // Ensure gender column exists
  await query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male'`)
  const res = await query(
    `SELECT id, "userId", tier, "displayName", gender, "createdAt" FROM profile WHERE "userId" = $1 LIMIT 1`,
    [userId],
  )
  if (res.rows.length === 0) {
    // Auto-create profile on first access
    const id = randomUUID()
    await query(
      `INSERT INTO profile (id, "userId", tier, "displayName", gender, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 'male', now(), now())`,
      [id, userId, "free", null],
    )
    return { id, userId, tier: "free" as const, displayName: null, gender: "male" as const }
  }
  const row = res.rows[0] as { id: string; userId: string; tier: string; displayName: string | null; gender: string | null }
  return {
    id: row.id,
    userId: row.userId,
    tier: (row.tier ?? "free") as "free" | "premium",
    displayName: row.displayName ?? null,
    gender: (row.gender === "female" ? "female" : "male") as "male" | "female",
  }
}

export async function updateProfile(data: { displayName?: string; gender?: "male" | "female" }) {
  const userId = await getUserId()
  await query(`ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male'`)
  await query(
    `UPDATE profile SET 
       "displayName" = COALESCE($1, "displayName"), 
       gender = COALESCE($2, gender),
       "updatedAt" = now() 
     WHERE "userId" = $3`,
    [data.displayName ?? null, data.gender ?? null, userId],
  )
  revalidatePath("/")
}

export async function upgradeToPremium() {
  const userId = await getUserId()
  await query(
    `UPDATE profile SET tier = 'premium', "updatedAt" = now() WHERE "userId" = $1`,
    [userId],
  )
  revalidatePath("/")
}

export async function downgradeToFree() {
  const userId = await getUserId()
  await query(
    `UPDATE profile SET tier = 'free', "updatedAt" = now() WHERE "userId" = $1`,
    [userId],
  )
  revalidatePath("/")
}
