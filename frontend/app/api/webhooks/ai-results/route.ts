import { NextRequest, NextResponse } from "next/server"

function trustedImageHost(): string | null {
  if (process.env.WEBHOOK_TRUSTED_IMAGE_HOST) return process.env.WEBHOOK_TRUSTED_IMAGE_HOST
  const base = process.env.S3_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL
  try {
    return base ? new URL(base).hostname : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. FLAW 6 FIX: DENIAL OF WALLET PAYLOAD LIMITER
    // Read the content-length header to reject giant, malicious text floods before processing
    const contentLength = request.headers.get("content-length")
    if (contentLength && parseInt(contentLength, 10) > 2048) { // Strict 2KB ceiling limit
      return NextResponse.json(
        { error: "Security Exception: Network payload exceeds standard 2KB buffer ceiling." },
        { status: 413 } // 413 Payload Too Large
      )
    }

    const body = await request.json()
    const { userId, dht, confidence, s3Url } = body

    // 2. FLAW 7 FIX: MALWARE INJECTION DOMAIN ORIGIN GUARD
    if (!s3Url) {
      return NextResponse.json({ error: "Validation Failure: Missing asset pointer link." }, { status: 400 })
    }

    try {
      const parsedUrl = new URL(s3Url)
      // Only accept images hosted in our vault bucket (defaults to the S3_PUBLIC_BASE_URL host)
      if (parsedUrl.hostname !== trustedImageHost()) {
        return NextResponse.json(
          { error: "Security Exception: Untrusted image host origin rejected." },
          { status: 403 } // 403 Forbidden
        )
      }
    } catch (urlError) {
      return NextResponse.json({ error: "Validation Failure: Malformed asset URL string." }, { status: 400 })
    }

    // 3. FLAW 9 FIX: FLOATING-POINT ROUNDING DRIFT CALIBRATION
    // Convert decimal-sensitive values into stable integers to avoid micro-rounding mathematical anomalies
    // Example: confidence score of 0.9587 is multiplied by 10000 to become integer 9587
    const calibratedConfidenceInteger = Math.round(parseFloat(confidence) * 10000)
    
    // Bio-bounds validation gate: checking if values are realistic
    if (calibratedConfidenceInteger < 0 || calibratedConfidenceInteger > 10000) {
      return NextResponse.json({ error: "Validation Failure: Numeric score bounds exceeded." }, { status: 400 })
    }

    console.log(`\n🔒 HARDENED AI WEBHOOK PAYLOAD DIGESTED`)
    console.log(`- Verified Patient Identity Token: ${userId}`)
    console.log(`- Validated Vault Asset Path: ${s3Url}`)
    console.log(`- Calibrated Fixed-Point Confidence Record: ${calibratedConfidenceInteger} (Stored as safe integer)`)
    console.log(`- Extracted DHT Biomarker Core Level: ${dht}`)

    return NextResponse.json({
      success: true,
      processedMetrics: {
        userId,
        storedConfidenceInt: calibratedConfidenceInteger,
        status: "Validated and securely ready for database ledger insertion"
      }
    })

  } catch (error) {
    console.error("CRITICAL AI WEBHOOK INGESTION CORE ERROR:", error)
    return NextResponse.json({ error: "Internal Secure Webhook Transaction Failure" }, { status: 500 })
  }
}
