import { expect, type Page } from "@playwright/test"
import { deflateSync } from "node:zlib"
import { randomUUID } from "node:crypto"
import { sql } from "./helpers"

// ── Minimal valid PNG generator (solid RGB colour) ──────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

export function makePng(width = 32, height = 32, rgb: [number, number, number] = [128, 128, 128]): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type RGB
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3)
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])

export function pngDataUrl(): string {
  return `data:image/png;base64,${makePng(8, 8).toString("base64")}`
}

/** Insert a progress_photo row directly (vault seed). Returns the id. */
export async function seedPhoto(userId: string, angle: "Front" | "Crown" | "Side", takenAt: string, dataUrl = pngDataUrl()) {
  const id = randomUUID()
  await sql(
    `INSERT INTO progress_photo (id, "userId", angle, "dataUrl", "takenAt", "createdAt") VALUES ($1, $2, $3, $4, $5, now())`,
    [id, userId, angle, dataUrl, takenAt],
  )
  return id
}

/** Open the dashboard and switch to a sidebar view via the desktop rail. */
export async function openView(page: Page, view: "vault" | "doctor") {
  await page.goto("/")
  await page.locator(`aside [data-tutorial-id="tutorial-nav-${view}"]`).click()
  if (view === "vault") await expect(page.getByRole("heading", { name: "Monthly Photo Archive" })).toBeVisible()
}

/** The big stat number shown above a stats label in the vault header. */
export function vaultStat(page: Page, label: "Months tracked" | "Total photos" | "Vault Status") {
  return page.getByText(label, { exact: true }).locator("xpath=preceding-sibling::p[1]")
}
