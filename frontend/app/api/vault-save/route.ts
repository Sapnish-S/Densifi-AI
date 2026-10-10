import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { getS3Url } from "@/lib/s3"
import { randomUUID } from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vault-save
//
// Called after the client has successfully PUT the file to the presigned S3 URL.
// Saves the S3 key + public URL into the progress_photo table so the vault
// can display and reference the image going forward.
//
// Request body: { key: string, view: "Front" | "Crown" | "Side", takenAt?: string }
// Response:     { id: string, s3Url: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key, view, takenAt } = await req.json()

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing S3 key" }, { status: 400 })
  }
  if (!["Front", "Crown", "Side"].includes(view)) {
    return NextResponse.json({ error: "Invalid view" }, { status: 400 })
  }

  const userId   = session.user.id

  // Verify that the S3 key belongs strictly to the authenticated user (BOLA prevention)
  if (!key.startsWith(`vault/${userId}/`)) {
    return NextResponse.json(
      { error: "Security Exception: Unauthorized access to specified asset key." },
      { status: 403 },
    )
  }
  const id       = randomUUID()
  const s3Url    = getS3Url(key)
  const capturedAt = takenAt ?? new Date().toISOString()

  try {
    await query(
      `INSERT INTO progress_photo (id, "userId", angle, "dataUrl", "takenAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [id, userId, view, s3Url, capturedAt],
    )
    return NextResponse.json({ id, s3Url })
  } catch (err) {
    console.error("[vault-save] db error", err)
    return NextResponse.json({ error: "Failed to save photo record" }, { status: 500 })
  }
}
