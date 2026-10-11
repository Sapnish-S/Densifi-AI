import { expect, test, type Page } from "@playwright/test"
import { createUser, sql } from "./helpers"
import { makePng, openView, PNG_SIGNATURE, seedPhoto, vaultStat } from "./helpers-vault"

// Vault view (05 §8), BiometricScanner (05 §8.6) and the vault route contracts
// (07 §2, 15 §4 item 6). Fake camera for the scanner flows; harmless elsewhere.
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["camera"],
})

const S3_BASE = "http://localhost:9000/densify-vault-storage"
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
// The scanner renders outside the open (modal) capture dialog, which aria-hides
// everything else, so role-based queries cannot see it; use the aria-labels directly.
const SHUTTER = '[aria-label="Capture photo"]'
const CLOSE = '[aria-label="Close scanner"]'
const FLIP = '[aria-label="Flip camera"]'
const utcMonth = () => new Date().toISOString().slice(0, 7)

function archive(page: Page) {
  return page.locator('[data-tutorial-id="tutorial-vault-archive"]')
}

function captureDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Direct Capture — Monthly Photos" })
}

/** Row in the Direct Capture dialog for one view. */
function captureRow(page: Page, view: "Front" | "Crown" | "Side") {
  return captureDialog(page).locator("div.rounded-sm.border").filter({ hasText: `${view} View` })
}

test.describe("Vault archive", () => {
  test("header copy, stats and empty state", async ({ page }) => {
    await createUser(page)
    await openView(page, "vault")
    await expect(page.getByText("Visual Progression Vault", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Monthly Photo Archive" })).toBeVisible()
    await expect(
      page.getByText("Each folder is a month of treatment — Front, Crown, and Side views stored with alignment verification."),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Add This Month" })).toBeVisible()

    await expect(archive(page)).toContainText(`No monthly captures yet. Tap "Add This Month" to start.`)
    await expect(vaultStat(page, "Months tracked")).toHaveText("0")
    await expect(vaultStat(page, "Total photos")).toHaveText("0")
    await expect(vaultStat(page, "Vault Status")).toHaveText("—")
  })

  test("month folders newest first, first expanded, placeholders for missing views", async ({ page }) => {
    const user = await createUser(page)
    await seedPhoto(user.id, "Front", "2026-08-15T12:00:00Z")
    await seedPhoto(user.id, "Crown", "2026-08-16T12:00:00Z")
    await seedPhoto(user.id, "Front", "2026-09-15T12:00:00Z")
    await openView(page, "vault")

    await expect(vaultStat(page, "Months tracked")).toHaveText("2")
    await expect(vaultStat(page, "Total photos")).toHaveText("3")
    await expect(vaultStat(page, "Vault Status")).toHaveText("Active")

    const folders = archive(page).locator(":scope > div")
    await expect(folders).toHaveCount(2)
    const sep = folders.nth(0)
    const aug = folders.nth(1)
    await expect(sep.locator("button").first()).toContainText("Sep 2026")
    await expect(sep).toContainText("2026-09-15 · 1 photo")
    await expect(aug.locator("button").first()).toContainText("Aug 2026")
    await expect(aug).toContainText("2026-08-15 · 2 photos")

    // Newest folder auto-expanded: 1 thumb + dashed Crown/Side placeholders.
    const sepPlaceholders = sep.locator(".border-dashed")
    await expect(sepPlaceholders).toHaveCount(2)
    await expect(sepPlaceholders.nth(0)).toHaveText("Crown")
    await expect(sepPlaceholders.nth(1)).toHaveText("Side")
    await expect(sep.locator("button:has(img)")).toHaveCount(1)
    // Older folder collapsed until toggled.
    await expect(aug.locator(".border-dashed")).toHaveCount(0)
    await aug.locator("button").first().click()
    await expect(aug.locator(".border-dashed")).toHaveCount(1)
    await expect(aug.locator(".border-dashed")).toHaveText("Side")
    await expect(aug.locator("button:has(img)")).toHaveCount(2)
    // Toggle the expanded one closed.
    await sep.locator("button").first().click()
    await expect(sep.locator(".border-dashed")).toHaveCount(0)
  })

  test("photo detail dialog → delete with confirm", async ({ page }) => {
    const user = await createUser(page)
    const keep = await seedPhoto(user.id, "Crown", "2026-09-10T12:00:00Z")
    const del = await seedPhoto(user.id, "Front", "2026-09-15T12:00:00Z")
    await openView(page, "vault")

    await archive(page).getByRole("button", { name: "Front — Sep 2026" }).click()
    const dlg = page.getByRole("dialog")
    await expect(dlg.getByRole("heading", { name: "Front View · Sep 2026" })).toBeVisible()
    await expect(
      dlg.getByText("Guided Camera Alignment Overlay — confirm this capture matches your Day 1 baseline framing."),
    ).toBeVisible()
    await expect(dlg.getByText("Captured", { exact: true })).toBeVisible()
    await expect(dlg.getByText("Aligned", { exact: true })).toBeVisible()
    await expect(dlg.getByText("Day 1 Alignment")).toBeAttached()

    let confirmMsg = ""
    page.once("dialog", (d) => {
      confirmMsg = d.message()
      void d.accept()
    })
    const delReq = page.waitForResponse((r) => r.url().endsWith("/api/vault-delete"))
    await dlg.getByRole("button", { name: "Delete" }).click()
    const res = await delReq
    expect(await res.json()).toEqual({ success: true, deletedId: del })
    expect(confirmMsg).toBe("Are you sure you want to delete this photo?")

    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(vaultStat(page, "Total photos")).toHaveText("1")
    const rows = await sql(`SELECT id FROM progress_photo WHERE "userId" = $1`, [user.id])
    expect(rows.map((r) => r.id)).toEqual([keep])
  })

  test("dismissing the confirm keeps the photo", async ({ page }) => {
    const user = await createUser(page)
    await seedPhoto(user.id, "Side", "2026-09-15T12:00:00Z")
    await openView(page, "vault")
    await archive(page).getByRole("button", { name: "Side — Sep 2026" }).click()
    page.once("dialog", (d) => void d.dismiss())
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Side View · Sep 2026" })).toBeVisible()
    expect(await sql(`SELECT id FROM progress_photo WHERE "userId" = $1`, [user.id])).toHaveLength(1)
  })
})

/** Open "Add This Month", pick a PNG for Front via the device-upload button, and wait
 *  through the 2.5 s validation overlay. Returns the server-side upload request the browser issued
 *  (Akamai's E3 Object Storage has no CORS, so the app uploads through /api/vault-put). */
async function uploadFrontFromDevice(page: Page) {
  await page.getByRole("button", { name: "Add This Month" }).click()
  await expect(captureDialog(page)).toBeVisible()
  // Hold the upload briefly so the transient "Uploading to vault..." state is observable.
  await page.route("**/api/vault-put?*", async (route) => {
    await new Promise((r) => setTimeout(r, 800))
    await route.continue()
  })
  const putReq = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/api/vault-put?"))

  const chooserP = page.waitForEvent("filechooser")
  await captureRow(page, "Front").getByTitle("Upload from device").click()
  const chooser = await chooserP
  await chooser.setFiles({ name: "front.png", mimeType: "image/png", buffer: makePng(64, 64, [140, 140, 140]) })

  const overlay = page.getByRole("dialog").filter({ hasText: "Analyzing Clinical Suitability" })
  await expect(overlay).toBeVisible()
  await expect(overlay.getByText("Checking lighting & focus...")).toBeVisible()
  await expect(overlay.getByRole("img", { name: "Validating Upload" })).toBeAttached()
  // ~2.5 s fake validation, then the upload starts.
  await expect(overlay).toBeHidden({ timeout: 5_000 })
  await expect(captureRow(page, "Front")).toContainText("Uploading to vault...")

  const put = await putReq
  expect(put.headers()["content-type"]).toBe("image/png")
  expect(new URL(put.url()).searchParams.get("view")).toBe("Front")
  return put
}

test.describe("Direct Capture dialog", () => {
  test("rows, upload from device → validation overlay → upload attempt; Done clears statuses", async ({ page }) => {
    const user = await createUser(page)
    await openView(page, "vault")
    await page.getByRole("button", { name: "Add This Month" }).click()
    const dlg = captureDialog(page)
    await expect(dlg.getByRole("heading", { name: "Direct Capture — Monthly Photos" })).toBeVisible()
    await expect(
      dlg.getByText(
        "Tap each view to open the biometric scanner. Images are automatically snapped when quality conditions are met and uploaded directly to secure storage.",
      ),
    ).toBeVisible()
    for (const v of ["Front", "Crown", "Side"] as const) {
      await expect(captureRow(page, v)).toContainText(`${v} View`)
      await expect(captureRow(page, v)).toContainText("Tap to open scanner")
      await expect(captureRow(page, v).getByTitle("Upload from device")).toBeVisible()
    }
    await expect(page.locator('input[type="file"][accept="image/*"]')).toBeAttached()
    await dlg.getByRole("button", { name: "Done" }).click()
    await expect(dlg).toBeHidden()

    await uploadFrontFromDevice(page)
    // Terminal state (success is covered by the fixme'd round-trip test below).
    await expect(captureRow(page, "Front")).toContainText(/Captured & uploaded|Upload failed — tap to retry/, { timeout: 15_000 })

    await dlg.getByRole("button", { name: "Done" }).click()
    await expect(dlg).toBeHidden()
    await page.getByRole("button", { name: "Add This Month" }).click()
    await expect(captureRow(page, "Front")).toContainText("Tap to open scanner")
  })

  // FIXME(app): the presigned PUT from /api/vault-upload is rejected by SeaweedFS with
  // 400 BadDigest ("The Content-Md5 you specified did not match what we received.").
  // The AWS SDK v3 presigner hoists flexible-checksum params into the URL
  // (x-amz-sdk-checksum-algorithm=CRC32&x-amz-checksum-crc32=AAAAAA%3D%3D, the CRC of an
  // EMPTY body), so any real body fails. Fix belongs in frontend/lib/s3.ts s3ClientConfig()
  // (requestChecksumCalculation: "WHEN_REQUIRED"), app code, not touched here.
  test("upload from device round-trip: S3 object public-read + progress_photo row", async ({ page }) => {
    const user = await createUser(page)
    await openView(page, "vault")
    await uploadFrontFromDevice(page)
    await expect(captureRow(page, "Front")).toContainText("Captured & uploaded", { timeout: 15_000 })
    await expect(captureRow(page, "Front").getByTitle("Upload from device")).toHaveCount(0)

    const rows = await sql<{ angle: string; dataUrl: string }>(
      `SELECT angle, "dataUrl" FROM progress_photo WHERE "userId" = $1`,
      [user.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].angle).toBe("Front")
    expect(rows[0].dataUrl).toMatch(new RegExp(`^${S3_BASE}/vault/${user.id}/${utcMonth()}/Front/${UUID}\\.png$`))

    // Object is public-read at its stored URL.
    const obj = await page.request.get(rows[0].dataUrl)
    expect(obj.status()).toBe(200)
    expect((await obj.body()).subarray(0, 4).equals(PNG_SIGNATURE)).toBeTruthy()

    // Vault reloaded behind the dialog.
    await expect(vaultStat(page, "Total photos")).toHaveText("1")
    await captureDialog(page).getByRole("button", { name: "Done" }).click()
    await expect(archive(page)).toContainText("1 photo")
  })
})

const STATUSES = ["ANALYZING RAW MATRIX...", "POOR LIGHTING — MOVE TO BRIGHT LIGHT", "CLINICAL STANDARD MET"]

function statusPill(page: Page) {
  return page.locator("span.font-mono", { hasText: new RegExp(STATUSES.map((s) => s.replace(/[.]/g, "\\.")).join("|")) })
}

test.describe("BiometricScanner", () => {
  test("fake camera: HUD renders with live status pill and controls", async ({ page }) => {
    await createUser(page)
    await openView(page, "vault")
    await page.getByRole("button", { name: "Add This Month" }).click()
    await captureRow(page, "Front").getByRole("button", { name: /Front View/ }).click()

    await expect(page.getByText("Biometric Capture — Front View")).toBeVisible()
    await expect(statusPill(page)).toBeVisible()
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      seen.add(((await statusPill(page).textContent()) ?? "").trim())
      await page.waitForTimeout(250)
    }
    for (const s of seen) expect(STATUSES).toContain(s)
    test.info().annotations.push({ type: "scanner-status", description: [...seen].join(" | ") })
    await expect(page.locator("video")).toBeVisible()
    await expect(page.locator(SHUTTER)).toBeAttached()
    await expect(page.locator(CLOSE)).toBeAttached()
    await expect(page.locator(FLIP)).toBeAttached()
    // Fake device frames sit inside the luma band, so the 2 s gate opens and the shutter enables.
    await expect(page.getByText("CLINICAL STANDARD MET")).toBeVisible({ timeout: 8_000 })
    await expect(page.locator(SHUTTER)).toBeEnabled()
  })

  test("camera error state when getUserMedia rejects", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"))
    })
    await createUser(page)
    await openView(page, "vault")
    await page.getByRole("button", { name: "Add This Month" }).click()
    await captureRow(page, "Crown").getByRole("button", { name: /Crown View/ }).click()
    await expect(page.getByText("Biometric Capture — Crown View")).toBeVisible()
    await expect(page.getByText("Camera Unavailable")).toBeVisible()
    await expect(page.getByText("Camera access denied. Please allow camera permissions.")).toBeVisible()
    await expect(page.locator("video")).toHaveCount(0)
    await expect(page.locator(SHUTTER)).toBeDisabled()
  })

  // FIXME(app): the scanner opens BEHIND the still-open "Direct Capture" dialog. VaultPanel
  // renders <BiometricScanner> (fixed z-[10100]) inside the dashboard root, which is its own
  // stacking context (`relative ... overflow-hidden z-0`, components/dashboard-client.tsx),
  // while the Base UI dialog backdrop/popup are portalled to <body> at z-50 and the dialog
  // is never closed when a row is tapped. Result: HUD is dimmed under the dialog and every
  // scanner control (Close / Flip / Shutter) is covered; Playwright reports
  // `<div data-slot="dialog-overlay" ...> intercepts pointer events`. The scanner is expected
  // to be full-screen and usable.
  test("scanner controls: close, flip, shutter → CAPTURE COMPLETE → upload", async ({ page }) => {
    const user = await createUser(page)
    await openView(page, "vault")
    await page.getByRole("button", { name: "Add This Month" }).click()
    await captureRow(page, "Front").getByRole("button", { name: /Front View/ }).click()
    await expect(page.getByText("Biometric Capture — Front View")).toBeVisible()

    await page.locator(FLIP).click()
    await expect(page.getByText("Biometric Capture — Front View")).toBeVisible()
    await page.locator(CLOSE).click()
    await expect(page.getByText("Biometric Capture — Front View")).toBeHidden()
    await expect(captureRow(page, "Front")).toContainText("Tap to open scanner")

    await captureRow(page, "Front").getByRole("button", { name: /Front View/ }).click()
    await expect(page.getByText("CLINICAL STANDARD MET")).toBeVisible({ timeout: 10_000 })
    await expect(page.locator(SHUTTER)).toBeEnabled()
    await page.locator(SHUTTER).click()
    await expect(page.getByText("CAPTURE COMPLETE")).toBeVisible()
    await expect(captureRow(page, "Front")).toContainText("Captured & uploaded", { timeout: 15_000 })
    const rows = await sql<{ angle: string; dataUrl: string }>(
      `SELECT angle, "dataUrl" FROM progress_photo WHERE "userId" = $1`,
      [user.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].angle).toBe("Front")
    expect(rows[0].dataUrl).toMatch(new RegExp(`^${S3_BASE}/vault/${user.id}/${utcMonth()}/Front/${UUID}\\.png$`))
  })
})
test.describe("Vault route contracts", () => {
  test("POST /api/vault-upload", async ({ page, browser }) => {
    const user = await createUser(page)
    const post = (data: object) => page.request.post("/api/vault-upload", { data })

    let r = await post({ view: "Top", contentType: "image/png" })
    expect(r.status()).toBe(400)
    expect(await r.json()).toEqual({ error: "Invalid view. Must be Front, Crown, or Side." })

    r = await post({ view: "Front", contentType: "application/pdf" })
    expect(r.status()).toBe(400)
    expect(await r.json()).toEqual({ error: "Security Exception: Unsupported or malicious file type rejected." })

    const keyRe = new RegExp(`^vault/${user.id}/\\d{4}-\\d{2}/Front/[0-9a-f-]{36}\\.png$`)
    for (const contentType of ["image/png", "image/jpeg", undefined]) {
      r = await post(contentType ? { view: "Front", contentType } : { view: "Front" })
      expect(r.status()).toBe(200)
      const body = await r.json()
      expect(body.key).toMatch(keyRe)
      expect(body.key.split("/")[2]).toBe(utcMonth())
      expect(body.uploadUrl).toContain(`/densify-vault-storage/${body.key}`)
      expect(body.uploadUrl).toContain("X-Amz-Signature=")
    }

    const anon = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const ar = await anon.request.post("/api/vault-upload", { data: { view: "Front" } })
    expect(ar.status()).toBe(401)
    expect(await ar.json()).toEqual({ error: "Unauthorized" })
    await anon.close()
  })

  test("POST /api/vault-save", async ({ page, browser }) => {
    const user = await createUser(page)
    const post = (data: object) => page.request.post("/api/vault-save", { data })

    let r = await post({ view: "Front" })
    expect(r.status()).toBe(400)
    expect(await r.json()).toEqual({ error: "Missing S3 key" })

    const ownKey = `vault/${user.id}/${utcMonth()}/Front/00000000-0000-4000-8000-000000000001.png`
    r = await post({ key: ownKey, view: "Top" })
    expect(r.status()).toBe(400)
    expect(await r.json()).toEqual({ error: "Invalid view" })

    r = await post({ key: `vault/someone-else/${utcMonth()}/Front/x.png`, view: "Front" })
    expect(r.status()).toBe(403)
    expect(await r.json()).toEqual({ error: "Security Exception: Unauthorized access to specified asset key." })

    r = await post({ key: ownKey, view: "Front", takenAt: "2026-09-15T12:00:00.000Z" })
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.id).toMatch(new RegExp(`^${UUID}$`))
    expect(body.s3Url).toBe(`${S3_BASE}/${ownKey}`)
    const [row] = await sql(`SELECT "userId", angle, "dataUrl", "takenAt" FROM progress_photo WHERE id = $1`, [body.id])
    expect(row.userId).toBe(user.id)
    expect(row.angle).toBe("Front")
    expect(row.dataUrl).toBe(body.s3Url)
    expect(new Date(row.takenAt).toISOString()).toBe("2026-09-15T12:00:00.000Z")

    const anon = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const ar = await anon.request.post("/api/vault-save", { data: { key: ownKey, view: "Front" } })
    expect(ar.status()).toBe(401)
    expect(await ar.json()).toEqual({ error: "Unauthorized" })
    await anon.close()
  })

  test("POST /api/vault-delete", async ({ page, browser }) => {
    const user = await createUser(page)
    const otherCtx = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const other = await createUser(await otherCtx.newPage())
    await otherCtx.close()
    const foreign = await seedPhoto(other.id, "Front", "2026-09-15T12:00:00Z")
    const own = await seedPhoto(user.id, "Front", "2026-09-15T12:00:00Z")
    const post = (data: object) => page.request.post("/api/vault-delete", { data })

    let r = await post({})
    expect(r.status()).toBe(400)
    expect(await r.json()).toEqual({ error: "Missing photo id" })

    r = await post({ id: foreign })
    expect(r.status()).toBe(404)
    expect(await r.json()).toEqual({ error: "Photo not found or unauthorized" })
    expect(await sql(`SELECT id FROM progress_photo WHERE id = $1`, [foreign])).toHaveLength(1)

    r = await post({ id: own })
    expect(r.status()).toBe(200)
    expect(await r.json()).toEqual({ success: true, deletedId: own })
    expect(await sql(`SELECT id FROM progress_photo WHERE id = $1`, [own])).toHaveLength(0)

    const anon = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const ar = await anon.request.post("/api/vault-delete", { data: { id: foreign } })
    expect(ar.status()).toBe(401)
    expect(await ar.json()).toEqual({ error: "Unauthorized" })
    await anon.close()
  })
})
