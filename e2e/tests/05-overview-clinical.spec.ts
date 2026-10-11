import { expect, test, type Page } from "@playwright/test"
import { createUser, sql } from "./helpers"
import {
  gotoClinical,
  gotoOverview,
  seedAnalysedSeries,
  seedCheckin,
  seedLabReport,
  seedMedication,
  seedPhoto,
} from "./helpers-overview"
import { makePng } from "./helpers-vault"

// Overview and Clinical views. Copy matches frontend/components/{overview-panel,progression-vault,
// regimen-editor-dialog,pro-gate,regimen-panel,biomarker-grid,correlation-chart}.tsx.

const vault = (page: Page) => page.locator('[data-tutorial-id="tutorial-vault"]')
const checkin = (page: Page) => page.locator('[data-tutorial-id="tutorial-daily-checkin"]')

// ─────────────────────────────────────────────────────────────────────────────
// A. Overview
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Overview · Progression Vault card", () => {
  test("0 photos → empty state; Scan Biometric Photo → Vault view", async ({ page }) => {
    await createUser(page)
    await gotoOverview(page)
    const card = vault(page)
    await expect(card.getByText("Visual Progression")).toBeVisible()
    await expect(card.getByText("Interactive Archive")).toBeVisible()
    await expect(card.getByText("Baseline vs. Current")).toBeVisible()
    await expect(card.getByText("No biometric scans yet")).toBeVisible()
    await expect(
      card.getByText("Take your first photo to initialise your Miniaturization Matrix and unlock your progression archive."),
    ).toBeVisible()
    await expect(card.getByText("Active Comparison")).toHaveCount(0)
    await card.getByRole("button", { name: "Scan Biometric Photo" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Progression Vault" })).toBeVisible()
  })

  test("1 Front photo (+ ignored Crown) → Baseline + unlock prompt; detail dialog", async ({ page }) => {
    const user = await createUser(page)
    await seedPhoto(user.id, "2026-01-05T12:00:00Z", "Front")
    // A later Crown photo must NOT become "Current" — only label 'Front' counts.
    await seedPhoto(user.id, "2026-02-20T12:00:00Z", "Crown")
    await gotoOverview(page)
    const card = vault(page)
    await expect(card.getByText("Baseline", { exact: true })).toBeVisible()
    await expect(card.getByText("Jan 5, 2026")).toBeVisible()
    await expect(card.getByText("Day 1")).toBeVisible()
    await expect(card.getByText("Upload your next photo to unlock progression comparison")).toBeVisible()
    await expect(card.getByText("Current", { exact: true })).toBeVisible()
    await expect(card.getByText("Active Comparison")).toHaveCount(0)
    await expect(card.getByText("Feb 20, 2026")).toHaveCount(0)

    await card.getByRole("button", { name: /Baseline/ }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading")).toHaveText("Front View · Jan 2026")
    await expect(
      dialog.getByText(/Guided Camera Alignment Overlay — confirm this capture matches your Day 1 baseline/),
    ).toBeVisible()
    await expect(dialog.getByText("Day 1 Alignment Guide")).toBeVisible()
    await expect(dialog.getByText("Captured")).toBeVisible()
    await expect(dialog.getByText("Aligned", { exact: true })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })

  test("≥2 Front photos → Baseline + Current, Active Comparison, Mon D, YYYY dates", async ({ page }) => {
    const user = await createUser(page)
    await seedPhoto(user.id, "2026-03-10T12:00:00Z", "Front")
    await seedPhoto(user.id, "2026-01-05T12:00:00Z", "Front")
    await seedPhoto(user.id, "2026-02-01T12:00:00Z", "Front")
    await seedPhoto(user.id, "2026-04-01T12:00:00Z", "Crown") // ignored
    await gotoOverview(page)
    const card = vault(page)
    await expect(card.getByText("Active Comparison")).toBeVisible()
    await expect(card.getByText("Upload your next photo to unlock progression comparison")).toHaveCount(0)
    const baseline = card.getByRole("button", { name: /Baseline/ })
    const current = card.getByRole("button", { name: /Current/ })
    await expect(baseline).toContainText("Jan 5, 2026")
    await expect(baseline).toContainText("Day 1")
    await expect(current).toContainText("Mar 10, 2026")
    await expect(current).toContainText("Latest")
    await expect(card.getByText("Apr 1, 2026")).toHaveCount(0)

    await current.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading")).toHaveText("Front View · Mar 2026")
    await expect(dialog.getByText("Aligned", { exact: true })).toBeVisible()
  })

  test("Clinical Supply list: 3 products, Amazon links, disclaimer", async ({ page }) => {
    await createUser(page)
    await gotoOverview(page)
    const card = vault(page)
    await expect(card.getByText("Densify Protocol")).toBeVisible()
    await expect(card.getByRole("heading", { name: "Clinical Supply" })).toBeVisible()
    const products = [
      {
        name: "Minoxidil 5% Topical",
        category: "Vasodilator",
        usage: "1 mL · Twice daily",
        rating: "4.8",
        href: "https://www.amazon.com/s?k=minoxidil+5+percent+topical",
      },
      {
        name: "Ketoconazole 2% Shampoo",
        category: "Anti-fungal",
        usage: "3–4 min contact · 2–3× per week",
        rating: "4.7",
        href: "https://www.amazon.com/s?k=ketoconazole+shampoo+2+percent",
      },
      {
        name: "Biotin + Collagen Complex",
        category: "Nutraceutical",
        usage: "2 capsules · Daily with food",
        rating: "4.6",
        href: "https://www.amazon.com/s?k=biotin+10000mcg+collagen+hair",
      },
    ]
    const headings = card.locator("h3")
    await expect(headings).toHaveText(products.map((p) => p.name))
    const links = card.getByRole("link", { name: "View on Amazon" })
    await expect(links).toHaveCount(3)
    for (let i = 0; i < products.length; i++) {
      const p = products[i]
      const item = card.locator("div.group").filter({ has: page.getByRole("heading", { name: p.name }) })
      await expect(item.getByText(p.category, { exact: true })).toBeVisible()
      await expect(item.getByText(p.usage, { exact: true })).toBeVisible()
      await expect(item.getByText(p.rating, { exact: true })).toBeVisible()
      await expect(links.nth(i)).toHaveAttribute("href", p.href)
      await expect(links.nth(i)).toHaveAttribute("target", "_blank")
      await expect(links.nth(i)).toHaveAttribute("rel", "noopener noreferrer")
    }
    await expect(
      card.getByText(
        "Links may be affiliate links. Densify earns a small commission at no extra cost to you. Always consult a dermatologist before starting a new regimen.",
      ),
    ).toBeVisible()
  })
})

test.describe("Overview · Glossary", () => {
  test("expander opens Clinical Glossary with 4 terms and closes", async ({ page }) => {
    await createUser(page)
    await gotoOverview(page)
    const opener = page.getByRole("button", { name: "New to Densify? Learn what each metric means →" })
    await expect(opener).toBeVisible()
    await opener.click()
    await expect(opener).toHaveCount(0)
    const glossary = page.locator("div.glass").filter({ hasText: "Clinical Glossary" })
    await expect(glossary.getByText("Clinical Glossary")).toBeVisible()
    const terms = {
      Miniaturization:
        "The thinning of individual hair fibres over time. Lower % = healthier, thicker follicles responding to treatment.",
      "Dread Shed":
        "A temporary shedding phase (wk 3–6) where dormant follicles are replaced by stronger, anagen-phase hairs. Expected and positive.",
      "Norwood Grade":
        "A 7-level clinical scale measuring the degree of androgenic alopecia. Lower grades indicate less recession.",
      "Compliance Score":
        "The percentage of days all prescribed treatments were completed as directed. 90%+ is clinical optimal.",
    }
    for (const [term, def] of Object.entries(terms)) {
      await expect(glossary.getByText(term, { exact: true })).toBeVisible()
      await expect(glossary.getByText(def, { exact: true })).toBeVisible()
    }
    await glossary.getByRole("button").click()
    await expect(page.getByText("Clinical Glossary")).toHaveCount(0)
    await expect(opener).toBeVisible()
  })
})

test.describe("Overview · Metric cards", () => {
  const mini = (p: Page) => p.locator('[data-tutorial-id="tutorial-mini-matrix"]')
  const comp = (p: Page) => p.locator('[data-tutorial-id="tutorial-compliance"]')
  const prog = (p: Page) => p.locator('[data-tutorial-id="tutorial-progress-analytics"]')

  test("empty: —, 0%, —, 0 data points", async ({ page }) => {
    await createUser(page)
    await gotoOverview(page)
    await expect(mini(page)).toContainText("Miniaturization Reduced")
    await expect(mini(page).locator("p.font-mono")).toHaveText("—")
    await expect(mini(page)).toContainText("since baseline")
    await expect(comp(page)).toContainText("Avg. Compliance")
    await expect(comp(page).locator("p.font-mono")).toHaveText("0%")
    await expect(comp(page)).toContainText("daily adherence")
    await expect(prog(page)).toContainText("Progress Status")
    await expect(prog(page).locator("p.font-mono")).toHaveText("—")
    await expect(prog(page)).toContainText("0 data points")
  })

  test("2 analysed photos + check-ins → 20%, 67%, Improving, 2 data points", async ({ page }) => {
    const user = await createUser(page)
    await seedAnalysedSeries(user.id, [
      { mini: 0.6, density: 40 },
      { mini: 0.4, density: 50 },
    ])
    await seedCheckin(user.id, 1, true)
    await seedCheckin(user.id, 2, true)
    await seedCheckin(user.id, 3, false)
    await gotoOverview(page)
    // miniDrop = round((0.6 - 0.4) * 100) = 20
    await expect(mini(page).locator("p.font-mono")).toHaveText("20%")
    await expect(mini(page).locator("svg polyline")).toHaveCount(1) // sparkline
    // 2 of 3 taken → round(66.67) = 67
    await expect(comp(page).locator("p.font-mono")).toHaveText("67%")
    await expect(comp(page).locator("svg text")).toHaveText("67")
    // trend rendered lowercase with CSS `capitalize` → displays "Improving"
    await expect(prog(page).locator("p.font-mono")).toHaveText(/^improving$/i)
    await expect(prog(page).locator("p.font-mono")).toHaveCSS("text-transform", "capitalize")
    await expect(prog(page)).toContainText("2 data points")
  })

  test("single data point → singular 'data point'", async ({ page }) => {
    const user = await createUser(page)
    await seedAnalysedSeries(user.id, [{ mini: 0.5, density: 45 }])
    await gotoOverview(page)
    await expect(prog(page)).toContainText(/\b1 data point$/)
    await expect(mini(page).locator("p.font-mono")).toHaveText("—")
  })
})

test.describe("Overview · Daily Check-In", () => {
  test("empty regimen state", async ({ page }) => {
    await createUser(page)
    await gotoOverview(page)
    const panel = checkin(page)
    await expect(panel.getByText("Daily Check-In")).toBeVisible()
    await expect(panel.getByText("No regimen added yet.")).toHaveCount(2) // header + body
    await expect(panel.getByRole("button", { name: "Edit Regimen" })).toBeVisible()
    await panel.getByRole("button", { name: "Configure Treatment Routine" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Edit Regimen" })).toBeVisible()
    await expect(dialog.getByText("Manage your daily active medications and treatments.")).toBeVisible()
    await expect(dialog.getByText("No active treatments configured.")).toBeVisible()
    await dialog.getByRole("button", { name: "Done" }).click()
    await expect(dialog).toBeHidden()
  })

  test("Weekly Photo Check-In → Upload → Vault view", async ({ page }) => {
    await createUser(page)
    await gotoOverview(page)
    const panel = checkin(page)
    await expect(panel.getByText("Weekly Photo Check-In")).toBeVisible()
    await expect(panel.getByText("Upload your weekly progress photos to the Vault")).toBeVisible()
    await panel.getByRole("button", { name: "Upload", exact: true }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Progression Vault" })).toBeVisible()
  })

  test.describe("browser timezone", () => {
    test.use({ timezoneId: "Pacific/Kiritimati" }) // UTC+14

    test("ticking all meds submits a check-in dated in the browser's local timezone", async ({ page }) => {
      const user = await createUser(page)
      await seedMedication(user.id, "Finasteride", "1mg", "Daily")
      await seedMedication(user.id, "Minoxidil", "5%", "")
      await gotoOverview(page)
      const panel = checkin(page)
      await expect(panel.getByText("0/2 completed")).toBeVisible()
      await expect(panel.getByRole("button", { name: /^Finasteride 1mg/ })).toContainText("Daily")

      await panel.getByRole("button", { name: /^Finasteride 1mg/ }).click()
      await expect(panel.getByText("1/2 completed")).toBeVisible()
      await expect(panel.getByRole("button", { name: /^Finasteride 1mg/ })).toHaveClass(/opacity-60/)
      // Untick + retick toggles state locally without submitting.
      await panel.getByRole("button", { name: /^Finasteride 1mg/ }).click()
      await expect(panel.getByText("0/2 completed")).toBeVisible()
      await panel.getByRole("button", { name: /^Finasteride 1mg/ }).click()
      await expect(panel.getByText("1/2 completed")).toBeVisible()
      expect(await sql(`SELECT 1 FROM daily_checkin WHERE "userId" = $1`, [user.id])).toHaveLength(0)

      await panel.getByRole("button", { name: /^Minoxidil 5%/ }).click()
      await expect(panel.getByText("All done for today")).toBeVisible()
      await expect(panel.getByText("Complete", { exact: true })).toBeVisible()

      const browserDate = await page.evaluate(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      })
      expect(browserDate).toBe(new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Kiritimati" }))

      await expect
        .poll(async () => (await sql(`SELECT * FROM daily_checkin WHERE "userId" = $1`, [user.id])).length)
        .toBe(1)
      const [row] = await sql(`SELECT date, treatment_taken, notes FROM daily_checkin WHERE "userId" = $1`, [user.id])
      expect(row.treatment_taken).toBe(true)
      expect(row.notes).toBe("Daily regimen completed via check-in panel.")
      expect(row.date).toBe(browserDate)
      // State persists after the post-submit reload.
      await expect(panel.getByText("All done for today")).toBeVisible()
    })
  })
})

test.describe("Overview · Regimen editor dialog", () => {
  test("premium: add (blank frequency stored as '') and delete", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await gotoOverview(page)
    await checkin(page).getByRole("button", { name: "Edit Regimen" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Add New Treatment")).toBeVisible()
    const add = dialog.getByRole("button", { name: "Add Treatment" })
    await expect(add).toBeDisabled()
    await dialog.getByPlaceholder("Medication Name (e.g. Finasteride)").fill("   ")
    await expect(add).toBeDisabled()
    await dialog.getByPlaceholder("Medication Name (e.g. Finasteride)").fill("Finasteride")
    await dialog.getByPlaceholder("Dosage (e.g. 1mg)").fill("1mg")
    await expect(dialog.getByPlaceholder("Frequency (e.g. Daily)")).toHaveValue("")
    await expect(add).toBeEnabled()
    await add.click()

    const row = dialog.locator("div.p-3").filter({ hasText: "Finasteride" })
    await expect(row).toBeVisible()
    await expect(row).toContainText("1mg")
    await expect(dialog.getByPlaceholder("Medication Name (e.g. Finasteride)")).toHaveValue("")
    const [db] = await sql(`SELECT name, dose, frequency, active FROM medication WHERE "userId" = $1`, [user.id])
    // Documented: blank frequency is sent as "" (not undefined) so the "daily" default never applies.
    expect(db).toEqual({ name: "Finasteride", dose: "1mg", frequency: "", active: true })
    await expect(checkin(page).getByText("0/1 completed")).toBeVisible()

    await row.getByRole("button").click()
    await expect(dialog.getByText("No active treatments configured.")).toBeVisible()
    expect(await sql(`SELECT 1 FROM medication WHERE "userId" = $1`, [user.id])).toHaveLength(0)
  })

  test("free: Add throws PREMIUM_REQUIRED server-side → nothing added (U21)", async ({ page }) => {
    const user = await createUser(page, { tier: "free" })
    await gotoOverview(page)
    await checkin(page).getByRole("button", { name: "Configure Treatment Routine" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Medication Name (e.g. Finasteride)").fill("Finasteride")
    const add = dialog.getByRole("button", { name: "Add Treatment" })
    await add.click()
    // Spinner stops (loading=false in finally) and the form is NOT cleared (error escapes before reset).
    await expect(add).toBeEnabled()
    await expect(dialog.getByPlaceholder("Medication Name (e.g. Finasteride)")).toHaveValue("Finasteride")
    await expect(dialog.getByText("No active treatments configured.")).toBeVisible()
    expect(await sql(`SELECT 1 FROM medication WHERE "userId" = $1`, [user.id])).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B. Clinical
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Clinical · ProGate (free)", () => {
  test("overlay copy, blurred children still mounted (U22), Upgrade to Pro → Upgrade view", async ({ page }) => {
    await createUser(page, { tier: "free" })
    await gotoClinical(page)
    const main = page.locator("main")
    await expect(main.getByText("Pro Feature")).toBeVisible()
    await expect(main.getByText("Unlock Clinical Analytics")).toBeVisible()
    await expect(
      main.getByText(
        "Upgrade to Densify Pro for the full clinical analytics suite, unlimited AI, and complete biomarker tracking.",
      ),
    ).toBeVisible()
    const blurred = main.locator(".blur-\\[3px\\]")
    await expect(blurred).toHaveCount(1)
    // Children are mounted (and fetch) behind the blur.
    await expect(blurred.getByText("Protocol & Regimen")).toBeAttached()
    await expect(blurred.getByText("Lab Reports & Biomarkers")).toBeAttached()
    await expect(blurred.getByText("Treatment Outcome Correlation Engine")).toBeAttached()
    await expect(main.locator('[aria-hidden="true"].pointer-events-none')).toBeAttached()

    await main.getByRole("button", { name: "Upgrade to Pro" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Upgrade to Pro" })).toBeVisible()
  })
})

test.describe("Clinical · RegimenPanel (premium)", () => {
  test("headers, empty state, Initialize Protocol opens dialog; rows render", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await gotoClinical(page)
    const panel = page.locator('[data-tutorial-id="tutorial-regimen"]')
    await expect(panel.getByText("Pro Feature")).toHaveCount(0)
    await expect(panel.getByRole("heading", { name: "Protocol & Regimen" })).toBeVisible()
    await expect(panel.getByText("Active daily medications")).toBeVisible()
    for (const h of ["Compound", "Dose", "Cadence", "Added"]) {
      await expect(panel.getByText(h, { exact: true })).toBeVisible()
    }
    await expect(panel.getByText("No protocol initialized")).toBeVisible()
    await expect(
      panel.getByText(
        "Add your current medications and dosages to enable daily adherence tracking and AI compliance insights.",
      ),
    ).toBeVisible()
    await panel.getByRole("button", { name: "Initialize Protocol" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Edit Regimen" })).toBeVisible()
    await dialog.getByPlaceholder("Medication Name (e.g. Finasteride)").fill("Minoxidil")
    await dialog.getByPlaceholder("Frequency (e.g. Daily)").fill("Twice daily")
    await dialog.getByRole("button", { name: "Add Treatment" }).click()
    await expect(dialog.locator("div.p-3").filter({ hasText: "Minoxidil" })).toBeVisible()
    await dialog.getByRole("button", { name: "Done" }).click()

    const row = panel.locator("div.grid").filter({ hasText: "Minoxidil" })
    await expect(row).toContainText("—") // blank dose
    await expect(row).toContainText("Twice daily")
    const [db] = await sql(`SELECT dose FROM medication WHERE "userId" = $1`, [user.id])
    expect(db.dose).toBe("")
    await expect(panel.getByRole("button", { name: "Edit & Add" })).toBeVisible()
  })
})

test.describe("Clinical · BiomarkerGrid (premium)", () => {
  const grid = (p: Page) => p.locator('[data-tutorial-id="tutorial-biomarker"]')
  const tiles = (p: Page) => grid(p).locator(".grid.grid-cols-3 > div")

  test("empty state", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await gotoClinical(page)
    await expect(grid(page).getByRole("heading", { name: "Lab Reports & Biomarkers" })).toBeVisible()
    await expect(grid(page).getByText("AI-extracted blood panel tracking (DHT, Free T, Ferritin)")).toBeVisible()
    await expect(grid(page).getByText("No Biomarker Data")).toBeVisible()
    await expect(grid(page).getByText("Upload your first blood panel to let AI extract your metrics.")).toBeVisible()
    await expect(grid(page).getByText("No lab documents uploaded.")).toBeVisible()
    await expect(grid(page).getByRole("button", { name: "Edit Data" })).toHaveCount(0)
    await expect(grid(page).getByRole("button", { name: "Upload" })).toBeVisible()
  })

  test("latest report tiles, Edit Data saves to the latest report, delete removes row", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await seedLabReport(user.id, "january-panel.pdf", "2026-01-01", { dht: 0.5, freeT: 10, ferritin: 50 })
    const latestId = await seedLabReport(user.id, "march-panel.pdf", "2026-03-01", { dht: 0.42, freeT: null, ferritin: 0 })
    await gotoClinical(page)

    await expect(tiles(page)).toHaveCount(3)
    await expect(tiles(page).nth(0)).toContainText("DHT")
    await expect(tiles(page).nth(0)).toContainText("0.42")
    await expect(tiles(page).nth(0)).toContainText("ng/dL")
    await expect(tiles(page).nth(1)).toContainText("Free T")
    await expect(tiles(page).nth(1)).toContainText("--")
    await expect(tiles(page).nth(1)).toContainText("pg/mL")
    await expect(tiles(page).nth(2)).toContainText("Ferritin")
    // biomarker-grid.tsx tests `latest.ferritin ? … : "--"`, but pg returns NUMERIC as a
    // STRING, so a stored 0 arrives as "0" (truthy) → "0.00". Only null → "--".
    await expect(tiles(page).nth(2)).toContainText("0.00")
    await expect(tiles(page).nth(2)).toContainText("ng/mL")

    // Documents table (reportDate DESC)
    for (const h of ["Report Document", "Uploaded Date", "Actions"]) {
      await expect(grid(page).getByText(h, { exact: true })).toBeVisible()
    }
    const titles = grid(page).locator("p.truncate")
    await expect(titles).toHaveText(["march-panel.pdf", "january-panel.pdf"])

    // Edit Data → saved onto the latest report
    await grid(page).getByRole("button", { name: "Edit Data" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Edit Biomarker Data" })).toBeVisible()
    await expect(
      dialog.getByText(
        "Override AI-extracted values to correct any OCR misinterpretations before saving to your clinical record.",
      ),
    ).toBeVisible()
    const inputs = dialog.locator('input[type="number"]')
    await expect(inputs.nth(0)).toHaveValue("0.42")
    await expect(inputs.nth(1)).toHaveValue("") // "--" → empty field
    await inputs.nth(0).fill("1.23")
    await inputs.nth(1).fill("15")
    await dialog.getByRole("button", { name: "Save Overrides" }).click()
    await expect(dialog).toBeHidden()
    await expect(tiles(page).nth(0)).toContainText("1.23")
    await expect(tiles(page).nth(1)).toContainText("15.00")
    const [dbRow] = await sql(`SELECT dht, "freeT", ferritin FROM lab_report WHERE id = $1`, [latestId])
    expect([Number(dbRow.dht), Number(dbRow.freeT), Number(dbRow.ferritin)]).toEqual([1.23, 15, 0])

    // Reload → the saved values stay
    await gotoClinical(page)
    await expect(tiles(page).nth(0)).toContainText("1.23")

    // Delete the latest report → tiles fall back to the older one
    const latestRow = grid(page).locator("div.grid").filter({ hasText: "march-panel.pdf" })
    await latestRow.getByRole("button").click()
    await expect(titles).toHaveText(["january-panel.pdf"])
    await expect(tiles(page).nth(0)).toContainText("0.50")
    await expect(tiles(page).nth(1)).toContainText("10.00")
    await expect(tiles(page).nth(2)).toContainText("50.00")
    await expect
      .poll(async () => (await sql(`SELECT id FROM lab_report WHERE "userId" = $1`, [user.id])).length)
      .toBe(1)
  })
})

test.describe("Clinical · Lab report upload (premium)", () => {
  const grid = (p: Page) => p.locator('[data-tutorial-id="tutorial-biomarker"]')
  const tiles = (p: Page) => grid(p).locator(".grid.grid-cols-3 > div")
  const pdf = (extra = 0) =>
    Buffer.concat([Buffer.from("%PDF-1.4\n% lab panel\ntrailer<<>>\n%%EOF\n"), Buffer.alloc(extra, 0x20)])

  async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
    const chooser = page.waitForEvent("filechooser")
    await grid(page).getByRole("button", { name: "Upload" }).click()
    await (await chooser).setFiles(file)
  }

  const labRows = (userId: string) =>
    sql(`SELECT label, dht, "freeT", ferritin FROM lab_report WHERE "userId" = $1`, [userId])

  // The mock provider returns DHT 42.5 / Free T 12.75 / Ferritin 88 for any readable document.
  for (const [name, mimeType, buffer] of [
    ["panel.pdf", "application/pdf", pdf()],
    ["panel-2mb.pdf", "application/pdf", pdf(2_000_000)], // over the old 1 MB server-action limit
    ["panel-photo.png", "image/png", makePng(2400, 1200)], // photo of a report → shrunk + sent as an image
  ] as const) {
    test(`${name} is analysed and the values shown`, async ({ page }) => {
      const user = await createUser(page, { tier: "premium" })
      await gotoClinical(page)
      await upload(page, { name, mimeType, buffer })
      await expect(tiles(page).nth(0)).toContainText("42.50")
      await expect(tiles(page).nth(1)).toContainText("12.75")
      await expect(tiles(page).nth(2)).toContainText("88.00")
      await expect(grid(page).getByRole("status")).toHaveCount(0)
      expect(await labRows(user.id)).toEqual([{ label: name, dht: "42.5", freeT: "12.75", ferritin: "88" }])
    })
  }

  test("unreadable file is saved and the user is told to enter values", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await gotoClinical(page)
    await upload(page, { name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("not really a pdf") })
    await expect(grid(page).getByRole("status")).toContainText("you can enter the values with Edit Data")
    await expect(tiles(page).nth(0)).toContainText("--")
    expect(await labRows(user.id)).toEqual([{ label: "scan.pdf", dht: null, freeT: null, ferritin: null }])
  })

  test("PDF over 3 MB is refused before upload", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await gotoClinical(page)
    await upload(page, { name: "huge.pdf", mimeType: "application/pdf", buffer: pdf(3_200_000) })
    await expect(grid(page).getByRole("alert")).toContainText("larger than 3 MB")
    await expect(grid(page).getByText("No lab documents uploaded.")).toBeVisible()
    expect(await labRows(user.id)).toEqual([])
  })
})

test.describe("Clinical · CorrelationChart (premium)", () => {
  const chart = (p: Page) => p.locator('[data-tutorial-id="tutorial-correlation"]')

  test("<2 points → No chart data yet", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await seedAnalysedSeries(user.id, [{ mini: 0.5, density: 40 }])
    await gotoClinical(page)
    await expect(chart(page).getByRole("heading", { name: "Treatment Outcome Correlation Engine" })).toBeVisible()
    await expect(chart(page).getByText("LIVE", { exact: true })).toBeVisible()
    await expect(chart(page).getByText("No chart data yet")).toBeVisible()
    await expect(
      chart(page).getByText("Upload progress photos and run AI analysis to populate this chart."),
    ).toBeVisible()
    await expect(chart(page).locator("svg.recharts-surface")).toHaveCount(0)
  })

  test("2 points → chart renders, controls, legend, Dread Shed tooltip; no reference area", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await seedAnalysedSeries(user.id, [
      { mini: 0.6, density: 40 },
      { mini: 0.4, density: 50 },
    ])
    await gotoClinical(page)
    const c = chart(page)
    await expect(c.locator("svg.recharts-surface").first()).toBeVisible()
    await expect(c.getByText("LIVE", { exact: true })).toBeVisible()
    await expect(
      c.getByText("Miniaturization index vs. density percentage — live from Bedrock AI analysis"),
    ).toBeVisible()
    for (const label of ["Last 12 Points", "First 12 Points", "All Time"]) {
      await expect(c.getByRole("button", { name: label })).toBeVisible()
    }
    await expect(c.getByRole("button", { name: "All Time" })).toHaveClass(/bg-card/)
    await expect(c.getByRole("button", { name: "Last 12 Points" })).not.toHaveClass(/bg-card/)
    await expect(c.getByText("Miniaturization %", { exact: true })).toBeVisible()
    await expect(c.getByText("Density %", { exact: true })).toBeVisible()
    await expect(c.locator(".recharts-reference-area")).toHaveCount(0)
    await expect(c.locator("svg.recharts-surface").first()).toContainText("Wk 1")

    await c.getByRole("button", { name: "Dread Shed Zone" }).hover()
    await expect(page.getByText("The “Dread Shed” is expected — and a good sign.")).toBeVisible()
    await expect(page.getByText(/A temporary density dip here is visual proof your follicle cycle is resetting\./)).toBeVisible()
  })

  test("≥6 points → Wk 3–Wk 6 ReferenceArea; range buttons slice data", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    const pts = Array.from({ length: 15 }, (_, i) => ({ mini: 0.6 - i * 0.01, density: 40 + i }))
    await seedAnalysedSeries(user.id, pts)
    await gotoClinical(page)
    const c = chart(page)
    await expect(c.locator("svg.recharts-surface").first()).toBeVisible()
    await expect(c.locator(".recharts-reference-area")).toHaveCount(1)

    // Last 12 of 15 → Wk 4..Wk 15: Wk 3 missing → no reference area
    await c.getByRole("button", { name: "Last 12 Points" }).click()
    await expect(c.getByRole("button", { name: "Last 12 Points" })).toHaveClass(/bg-card/)
    await expect(c.locator(".recharts-reference-area")).toHaveCount(0)
    await expect(c.locator("svg.recharts-surface").first()).toContainText("Wk 15")

    // First 12 → Wk 1..Wk 12: area back, Wk 15 gone
    await c.getByRole("button", { name: "First 12 Points" }).click()
    await expect(c.locator(".recharts-reference-area")).toHaveCount(1)
    await expect(c.locator("svg.recharts-surface").first()).not.toContainText("Wk 15")

    await c.getByRole("button", { name: "All Time" }).click()
    await expect(c.locator(".recharts-reference-area")).toHaveCount(1)
    await expect(c.locator("svg.recharts-surface").first()).toContainText("Wk 15")
  })
})
