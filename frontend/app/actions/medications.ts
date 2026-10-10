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

// DB columns (camelCase, quoted): id, "userId", name, dose, frequency, "startDate", notes, active, "createdAt", "updatedAt"

async function requirePremium(userId: string) {
  const res = await query(`SELECT tier FROM profile WHERE "userId" = $1 LIMIT 1`, [userId])
  if (res.rows[0]?.tier !== "premium") throw new Error("PREMIUM_REQUIRED")
}

export async function getMedications() {
  const userId = await getUserId()
  await requirePremium(userId)
  const res = await query(
    `SELECT id, name, dose AS dosage, frequency, notes, active, "createdAt" FROM medication WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [userId],
  )
  return res.rows as {
    id: string
    name: string
    dosage: string | null
    frequency: string | null
    notes: string | null
    active: boolean
    createdAt: string
  }[]
}

export async function addMedication(data: {
  name: string
  dosage?: string
  frequency?: string
  startDate?: string
  notes?: string
}) {
  const userId = await getUserId()
  await requirePremium(userId)
  const id = randomUUID()
  const today = new Date().toISOString().slice(0, 10)
  await query(
    `INSERT INTO medication (id, "userId", name, dose, frequency, "startDate", notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
    [id, userId, data.name, data.dosage ?? "", data.frequency ?? "daily", data.startDate ?? today, data.notes ?? null],
  )
  revalidatePath("/")
}

export async function toggleMedication(id: string, active: boolean) {
  const userId = await getUserId()
  await requirePremium(userId)
  await query(
    `UPDATE medication SET active = $1, "updatedAt" = now() WHERE id = $2 AND "userId" = $3`,
    [active, id, userId],
  )
  revalidatePath("/")
}

export async function deleteMedication(id: string) {
  const userId = await getUserId()
  await requirePremium(userId)
  await query(`DELETE FROM medication WHERE id = $1 AND "userId" = $2`, [id, userId])
  revalidatePath("/")
}
