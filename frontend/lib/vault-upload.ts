// Browser-side vault upload: normalise the image, POST it to /api/vault-put (server-side
// upload — Akamai's E3 endpoint has no CORS), then record it with /api/vault-save.
// Used by the vault capture dialog and the agent chat so every photo lands in the same
// place with a proper S3 key the analysis pipeline can read.

export type VaultView = "Front" | "Crown" | "Side"

// Vercel caps request bodies at 4.5 MB; stay safely under it.
const MAX_UPLOAD_BYTES = 4_000_000
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

/**
 * Pass PNG/JPEG/WebP under the cap through untouched. Anything else (iPhone HEIC,
 * files with no MIME type) or anything too large is decoded and re-encoded as JPEG.
 */
async function normaliseImage(blob: Blob): Promise<{ blob: Blob; contentType: string }> {
  const type = blob.type === "image/jpg" ? "image/jpeg" : blob.type
  if (ACCEPTED_TYPES.has(type) && blob.size <= MAX_UPLOAD_BYTES) return { blob, contentType: type }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    throw new Error("This image format isn't supported by your browser. Please use a JPEG or PNG photo.")
  }
  try {
    for (const maxSide of [4096, 3072, 2048, 1600]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
      if (jpeg && jpeg.size <= MAX_UPLOAD_BYTES) return { blob: jpeg, contentType: "image/jpeg" }
    }
  } finally {
    bitmap.close()
  }
  throw new Error("Image is too large to upload.")
}

async function errorText(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return (body && typeof body.error === "string" && body.error) || `${fallback} (${res.status})`
}

/** Upload one photo to the vault. Returns the new progress_photo id and its S3 key. */
export async function uploadToVault(source: Blob, view: VaultView): Promise<{ id: string; key: string }> {
  const { blob, contentType } = await normaliseImage(source)

  const put = await fetch(`/api/vault-put?view=${encodeURIComponent(view)}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  })
  if (!put.ok) throw new Error(await errorText(put, "Upload to storage failed"))
  const { key } = (await put.json()) as { key: string }

  const save = await fetch("/api/vault-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, view, takenAt: new Date().toISOString() }),
  })
  if (!save.ok) throw new Error(await errorText(save, "Failed to save photo record"))
  const { id } = (await save.json()) as { id: string }
  return { id, key }
}
