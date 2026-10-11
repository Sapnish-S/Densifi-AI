#!/usr/bin/env node
/**
 * Sync site imagery between a local folder and Object Storage (Akamai in staging/prod,
 * SeaweedFS locally). Objects live under `site/` in the vault bucket and are public-read.
 *
 *   node scripts/site-assets/sync.mjs upload   [--target akamai] [--dir site-assets] [--dry-run]
 *   node scripts/site-assets/sync.mjs download [--target akamai] [--dir site-assets]
 *
 * Connection comes from the same env vars the app uses:
 *   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_FORCE_PATH_STYLE (default "true")
 * With `--target akamai` the S3_AKAMAI_* variables (repo-root .env) are used instead.
 * The npm scripts load ../.env automatically.
 * Upload skips files whose MD5 already matches the stored ETag. Public read is granted by
 * the bucket policy on `site/*`, not per-object ACLs.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const PREFIX = "site/"
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"
const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
}

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name) => rest.includes(`--${name}`)
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback
}
const dir = path.resolve(opt("dir", "site-assets"))
const dryRun = flag("dry-run")
const target = opt("target", "")

if (target === "akamai") {
  for (const k of ["ENDPOINT", "REGION", "BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"]) {
    if (process.env[`S3_AKAMAI_${k}`]) process.env[`S3_${k}`] = process.env[`S3_AKAMAI_${k}`]
  }
  process.env.S3_FORCE_PATH_STYLE ??= "true"
} else if (target) {
  console.error(`Unknown --target "${target}" (supported: akamai)`)
  process.exit(1)
}

if (!["upload", "download"].includes(cmd)) {
  console.error("Usage: sync.mjs <upload|download> [--dir site-assets] [--dry-run]")
  process.exit(1)
}
const need = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]
const missing = need.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")} (see README → "Site assets")`)
  process.exit(1)
}

const bucket = process.env.S3_BUCKET
const s3 = new S3Client({
  region: process.env.S3_REGION || "us-ord",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})

async function walk(root, rel = "") {
  const out = []
  for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    const r = path.posix.join(rel, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(root, r)))
    else out.push(r)
  }
  return out
}

async function upload() {
  const files = await walk(dir)
  let sent = 0
  let skipped = 0
  for (const rel of files) {
    const type = TYPES[path.extname(rel).toLowerCase()]
    if (!type) {
      console.warn(`skip (unknown type): ${rel}`)
      continue
    }
    const body = await readFile(path.join(dir, rel))
    const md5 = createHash("md5").update(body).digest("hex")
    const key = PREFIX + rel
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      if (head.ETag?.replaceAll('"', "") === md5) {
        skipped++
        continue
      }
    } catch (err) {
      // Only "not found" means "upload it"; auth/bucket/network errors must surface.
      if (err?.$metadata?.httpStatusCode !== 404 && err?.name !== "NotFound") throw err
    }
    console.log(`${dryRun ? "would upload" : "upload"}  ${key}  (${(body.length / 1024).toFixed(0)} KB)`)
    if (!dryRun) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: type,
          CacheControl: CACHE_CONTROL,
          // No per-object ACL: Akamai buckets reject x-amz-acl (501). Public read comes
          // from the bucket policy on site/* (Terraform), anonymous Read on SeaweedFS.
        }),
      )
    }
    sent++
  }
  console.log(`${sent} ${dryRun ? "to upload" : "uploaded"}, ${skipped} unchanged → s3://${bucket}/${PREFIX}`)
}

async function download() {
  let token
  let count = 0
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }),
    )
    for (const obj of page.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue
      const rel = obj.Key.slice(PREFIX.length)
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }))
      const dest = path.join(dir, rel)
      await mkdir(path.dirname(dest), { recursive: true })
      await writeFile(dest, Buffer.from(await res.Body.transformToByteArray()))
      console.log(`download  ${obj.Key}`)
      count++
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  console.log(`${count} files → ${dir}`)
}

await (cmd === "upload" ? upload() : download())
