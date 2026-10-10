import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await req.json()

  if (!id) {
    return NextResponse.json({ error: "Missing photo id" }, { status: 400 })
  }

  const userId = session.user.id

  try {
    // Delete the photo record from the database
    // Ensures the photo strictly belongs to the authenticated user
    const result = await query(
      `DELETE FROM progress_photo WHERE id = $1 AND "userId" = $2 RETURNING id`,
      [id, userId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Photo not found or unauthorized" }, { status: 404 })
    }

    return NextResponse.json({ success: true, deletedId: id })
  } catch (err) {
    console.error("[vault-delete] db error", err)
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 })
  }
}
