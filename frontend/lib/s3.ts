import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Akamai Object Storage (S3-compatible). Locally: SeaweedFS.
const BUCKET_NAME = process.env.S3_BUCKET!

/** Shared client options — exported so route handlers build identical clients. */
export function s3ClientConfig() {
  return {
    region: process.env.S3_REGION || "us-ord",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    // AWS SDK v3 ≥3.729 signs a CRC32 of an *empty* body into presigned PUT URLs by
    // default; S3-compatible stores (Akamai Object Storage / Ceph, SeaweedFS) then reject
    // the real upload with BadDigest. Only send checksums when an operation requires them.
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  }
}

// Re-use a single client instance across requests (module-level singleton)
export const s3Client = new S3Client(s3ClientConfig())

/**
 * Generate a presigned PUT URL that lets the browser upload directly to S3.
 * The URL expires in 5 minutes — enough for any mobile network.
 */
export async function createPresignedUploadUrl({
  key,
  contentType,
  expiresIn = 300,
}: {
  key: string
  contentType: string
  expiresIn?: number
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         key,
    ContentType: contentType,
  })
  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Presigned GET. Only used when VAULT_PRESIGNED_GET=true; the default
 * keeps public-read object URLs.
 */
export async function createPresignedGetUrl(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }), { expiresIn })
}

/** Public URL for a stored object (assumes the bucket is publicly readable) */
export function getS3Url(key: string): string {
  const base =
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
    process.env.S3_PUBLIC_BASE_URL ||
    "https://densify-vault-storage.us-ord-10.linodeobjects.com"
  return `${base.replace(/\/+$/, "")}/${key}`
}
