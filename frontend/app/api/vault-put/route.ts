import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { s3Client } from "@/lib/s3"
import { randomUUID } from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vault-put?view=Front|Crown|Side
//
// Request body: the raw image blob (Content-Type: image/png | image/jpeg | image/webp)
// Response:     { key: string }
//
// Server-side upload. Akamai's E3 Object Storage endpoint (us-ord-10) does not
// support CORS, so browsers cannot PUT to presigned URLs from the app origin;
// the image goes through this route instead. Vercel caps request bodies at
// 4.5 MB — the client downsizes larger images before calling this.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET    = process.env.S3_BUCKET ?? ""
const MAX_BYTES = 4_400_000
const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!BUCKET) {
    return NextResponse.json({ error: "S3_BUCKET environment variable is not set." }, { status: 500 })
  }

  const view = req.nextUrl.searchParams.get("view") ?? ""
  if (!["Front", "Crown", "Side"].includes(view)) {
    return NextResponse.json({ error: "Invalid view. Must be Front, Crown, or Side." }, { status: 400 })
  }

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim()
  const ext = EXTENSION[contentType]
  if (!ext) {
    return NextResponse.json(
      { error: "Security Exception: Unsupported or malicious file type rejected." },
      { status: 400 },
    )
  }

  const body = Buffer.from(await req.arrayBuffer())
  if (body.length === 0) {
    return NextResponse.json({ error: "Empty upload." }, { status: 400 })
  }
  if (body.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 })
  }

  const date = new Date().toISOString().slice(0, 7) // YYYY-MM
  const key  = `vault/${session.user.id}/${date}/${view}/${randomUUID()}.${ext}`

  try {
    await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, Body: body }))
  } catch (e) {
    console.error("vault-put: S3 upload failed", e)
    return NextResponse.json({ error: "Upload to storage failed." }, { status: 502 })
  }

  return NextResponse.json({ key })
}
