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

export async function getProgressPhotos() {
  const userId = await getUserId()
  const res = await query(
    `SELECT id, "dataUrl", angle AS "label", "takenAt" FROM progress_photo WHERE "userId" = $1 ORDER BY "takenAt" DESC`,
    [userId],
  )
  return res.rows as { id: string; dataUrl: string; label: string | null; takenAt: string }[]
}

export async function uploadProgressPhoto(dataUrl: string, label: string = "crown") {
  const userId = await getUserId()
  const id = randomUUID()
  await query(
    `INSERT INTO progress_photo (id, "userId", "dataUrl", angle) VALUES ($1, $2, $3, $4)`,
    [id, userId, dataUrl, label],
  )
  revalidatePath("/")
  return id
}

export async function deleteProgressPhoto(id: string) {
  const userId = await getUserId()
  await query(`DELETE FROM progress_photo WHERE id = $1 AND "userId" = $2`, [id, userId])
  revalidatePath("/")
}
