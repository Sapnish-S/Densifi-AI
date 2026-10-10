import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { s3ClientConfig } from "@/lib/s3"
import { randomUUID } from "crypto"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vault-upload
//
// Request body: { view: "Front" | "Crown" | "Side", contentType?: string }
// Response:     { uploadUrl: string, key: string }
//
// The client PUTs the raw PNG blob directly to the presigned URL.
// No file data passes through our server — all follicular pixel data goes
// straight to S3 for downstream AWS Bedrock analysis.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET      = process.env.S3_BUCKET ?? ""
const EXPIRES_IN  = 300 // seconds

export async function POST(req: NextRequest) {
  // Auth guard
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!BUCKET) {
    return NextResponse.json(
      { error: "AWS_S3_BUCKET_NAME environment variable is not set." },
      { status: 500 },
    )
  }

  const { view, contentType = "image/png" } = await req.json()
  if (!["Front", "Crown", "Side"].includes(view)) {
    return NextResponse.json({ error: "Invalid view. Must be Front, Crown, or Side." }, { status: 400 })
  }

  // Strict MIME-type filter to prevent uploading malicious scripts or files
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!contentType || !allowedMimeTypes.includes(contentType)) {
    return NextResponse.json(
      { error: "Security Exception: Unsupported or malicious file type rejected." },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const date   = new Date().toISOString().slice(0, 7) // YYYY-MM
  const key    = `vault/${userId}/${date}/${view}/${randomUUID()}.png`

  // Akamai Object Storage (S3-compatible): same SDK, custom endpoint.
  // Browser PUTs go to S3_PUBLIC_ENDPOINT when set (e.g. MinIO exposed on localhost).
  const client = new S3Client({
    ...s3ClientConfig(),
    endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || undefined,
  })

  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: EXPIRES_IN })

  return NextResponse.json({ uploadUrl, key })
}
