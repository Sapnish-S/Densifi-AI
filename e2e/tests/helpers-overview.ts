import { randomUUID } from "crypto"
import { expect, type Page } from "@playwright/test"
import { sql } from "./helpers"

/** Insert a progress_photo row (images may 404 — only the row matters). */
export async function seedPhoto(userId: string, takenAt: string, angle = "Front"): Promise<string> {
  const id = randomUUID()
  const month = takenAt.slice(0, 7)
  const dataUrl = `http://localhost:9000/densify-vault-storage/vault/${userId}/${month}/${angle}/${randomUUID()}.png`
  await sql(
    `INSERT INTO progress_photo (id, "userId", "dataUrl", angle, "takenAt") VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, dataUrl, angle, takenAt],
  )
  return id
}

/** Insert an assistant analysis message linked to a photo (feeds getTelemetry's matrix). */
export async function seedAnalysis(userId: string, photoId: string, mini: number, density: number) {
  const content = JSON.stringify({
    miniaturization_index: mini,
    density_percentage: density,
    clinical_summary: "Seeded analysis",
    model_chain: ["seed"],
  })
  await sql(
    `INSERT INTO agent_message (id, "userId", role, content, "photoId") VALUES ($1, $2, 'assistant', $3, $4)`,
    [randomUUID(), userId, content, photoId],
  )
}

/** Seed N Front photos (weekly, starting 2026-01-05 noon UTC) each with an analysis row. */
export async function seedAnalysedSeries(userId: string, points: { mini: number; density: number }[]) {
  const start = Date.UTC(2026, 0, 5, 12)
  for (let i = 0; i < points.length; i++) {
    const takenAt = new Date(start + i * 7 * 86_400_000).toISOString()
    const id = await seedPhoto(userId, takenAt, "Front")
    await seedAnalysis(userId, id, points[i].mini, points[i].density)
  }
}

export async function seedMedication(userId: string, name: string, dose: string, frequency: string, active = true) {
  const id = randomUUID()
  await sql(
    `INSERT INTO medication (id, "userId", name, dose, frequency, "startDate", active) VALUES ($1, $2, $3, $4, $5, '2026-01-01', $6)`,
    [id, userId, name, dose, frequency, active],
  )
  return id
}

/** daysAgo is relative to the UTC date (getTelemetry's compliance window is UTC-based). */
export async function seedCheckin(userId: string, daysAgo: number, taken: boolean) {
  await sql(
    `INSERT INTO daily_checkin (id, "userId", date, treatment_taken, notes)
     VALUES ($1, $2, to_char((now() AT TIME ZONE 'UTC')::date - $3::int, 'YYYY-MM-DD'), $4, 'seed')`,
    [randomUUID(), userId, daysAgo, taken],
  )
}

export async function seedLabReport(
  userId: string,
  label: string,
  reportDate: string,
  vals: { dht: number | null; freeT: number | null; ferritin: number | null },
) {
  const id = randomUUID()
  await sql(
    `INSERT INTO lab_report (id, "userId", label, "dataUrl", "reportDate", dht, "freeT", ferritin)
     VALUES ($1, $2, $3, 'data:application/pdf;base64,AAAA', $4, $5, $6, $7)`,
    [id, userId, label, reportDate, vals.dht, vals.freeT, vals.ferritin],
  )
  return id
}

export async function gotoOverview(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard Overview" })).toBeVisible()
  // Wait for the panel skeleton to resolve.
  await expect(page.locator('[data-tutorial-id="tutorial-daily-checkin"]')).toBeVisible({ timeout: 15_000 })
}

export async function gotoClinical(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard Overview" })).toBeVisible()
  await page.locator("aside").getByRole("button", { name: "Clinical", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Clinical Analytics" })).toBeVisible()
}
