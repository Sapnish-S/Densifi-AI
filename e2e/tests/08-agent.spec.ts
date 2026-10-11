import { expect, test, type Page } from "@playwright/test"
import { createUser, sql } from "./helpers"

// AI Agent view. Requires the api to run with
// LLM_PROVIDER=mock (docker-compose default when no ANTHROPIC_API_KEY is set).

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

/** Real upload through the app's server-side flow (vault-put → vault-save). */
async function uploadPhoto(page: Page, view: "Front" | "Crown" | "Side", takenAt: string) {
  const put = await page.request.post(`/api/vault-put?view=${view}`, { data: PNG, headers: { "Content-Type": "image/png" } })
  expect(put.ok(), `vault-put ${put.status()}`).toBeTruthy()
  const { key } = await put.json()
  const save = await page.request.post("/api/vault-save", { data: { key, view, takenAt } })
  expect(save.ok()).toBeTruthy()
  return (await save.json()) as { id: string; s3Url: string }
}

async function openAgent(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: /AI Agent/ }).first().click()
  await expect(page.getByRole("heading", { name: "AI Hair Analysis Agent" })).toBeVisible()
}

test.describe("AI Agent — analysis", () => {
  test("no photos → Analyze disabled", async ({ page }) => {
    await createUser(page)
    await openAgent(page)
    await expect(page.getByText("Hair Analysis Agent", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Analyze Latest Progress" })).toBeDisabled()
  })

  test("single photo of the latest view → precondition error", async ({ page }) => {
    await createUser(page)
    await uploadPhoto(page, "Front", "2026-01-05T10:00:00.000Z")
    await openAgent(page)
    await page.getByRole("button", { name: "Analyze Latest Progress" }).click()
    await expect(page.getByText("We found your latest Front photo, but you need at least two Front photos to compare progress.")).toBeVisible()
  })

  test("legacy inline (non-S3) photos are ignored by the comparison", async ({ page }) => {
    const user = await createUser(page)
    for (const d of ["2026-01-01", "2026-02-01"]) {
      await sql(
        `INSERT INTO progress_photo (id, "userId", "dataUrl", angle, "takenAt") VALUES (gen_random_uuid()::text, $1, $2, 'crown', $3)`,
        [user.id, "data:image/png;base64," + PNG.toString("base64"), d],
      )
    }
    await openAgent(page)
    await page.getByRole("button", { name: "Analyze Latest Progress" }).click()
    await expect(page.getByText("You need at least two photos of the same view to perform a comparison analysis.")).toBeVisible()
  })

  test("missing objects → structured 422 surfaced as status error", async ({ page }) => {
    const user = await createUser(page)
    for (const [d, id] of [["2026-01-01", "a"], ["2026-02-01", "b"]]) {
      await sql(
        `INSERT INTO progress_photo (id, "userId", "dataUrl", angle, "takenAt") VALUES (gen_random_uuid()::text, $1, $2, 'Front', $3)`,
        [user.id, `http://localhost:9000/densify-vault-storage/vault/${user.id}/2026-01/Front/missing-${id}.png`, d],
      )
    }
    await openAgent(page)
    // /analyze is called server-side (server action); its structured error message is surfaced.
    await page.getByRole("button", { name: "Analyze Latest Progress" }).click()
    await expect(page.getByText("Image not found or access denied for one of the keys. Verify the S3 keys and IAM permissions.")).toBeVisible({ timeout: 30_000 })
  })

  test("analyze compares the FIRST and LATEST photo of the same view → report modal → results → saved to agent_message → forward (premium)", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await uploadPhoto(page, "Crown", "2026-01-05T10:00:00.000Z")   // older, different view (ignored)
    const baseline = await uploadPhoto(page, "Front", "2026-01-10T10:00:00.000Z") // first Front
    await uploadPhoto(page, "Front", "2026-02-10T10:00:00.000Z")                 // middle (ignored)
    const current = await uploadPhoto(page, "Front", "2026-03-10T10:00:00.000Z") // latest
    await openAgent(page)

    await page.getByRole("button", { name: "Analyze Latest Progress" }).click()

    const modal = page.getByRole("dialog")
    await expect(modal.getByText("Analysis Complete")).toBeVisible({ timeout: 30_000 })
    await expect(modal.getByText("Your AI progress report has been successfully generated.")).toBeVisible()
    await expect(modal.getByText("62.5%")).toBeVisible()
    await modal.getByRole("button", { name: "View Results Here" }).click()

    await expect(page.getByText("Baseline vs. Current Progress (Front View)")).toBeVisible()
    await expect(page.getByText("Your scalp shows improved coverage with thicker follicles since baseline.").first()).toBeVisible()
    await expect(page.getByText("mock-vision → mock-fast")).toBeVisible()
    await expect(page.getByText("Drag to compare")).toBeVisible()
    await expect(page.getByAltText("Baseline").first()).toHaveAttribute("src", baseline.s3Url)
    await expect(page.getByAltText("Current progress").first()).toHaveAttribute("src", current.s3Url)

    const rows = await sql(`SELECT role, content, "photoId" FROM agent_message WHERE "userId" = $1`, [user.id])
    expect(rows).toHaveLength(1)
    expect(rows[0].photoId).toBe(current.id)
    expect(JSON.parse(rows[0].content)).toMatchObject({ density_percentage: 62.5, miniaturization_index: 0.31 })

    // Telemetry reflects the analysis (current photo carries the analysis; baseline is 0/0).
    await page.getByRole("button", { name: /Run new analysis/ }).click()
    await page.getByRole("button", { name: "Analyze Latest Progress" }).click()
    await expect(page.getByRole("dialog").getByText("Analysis Complete")).toBeVisible({ timeout: 30_000 })
    await page.getByRole("button", { name: "Share with a Doctor" }).click()
    await expect(page.locator("main h1")).toHaveText("Clinical Doctor Network")
    await expect(page.getByRole("heading", { name: "Find a doctor" })).toBeVisible()
  })

  test("forward as free user lands on the ProGate", async ({ page }) => {
    await createUser(page)
    await uploadPhoto(page, "Side", "2026-01-10T10:00:00.000Z")
    await uploadPhoto(page, "Side", "2026-02-10T10:00:00.000Z")
    await openAgent(page)
    await page.getByRole("button", { name: "Analyze Latest Progress" }).click()
    await expect(page.getByRole("dialog").getByText("Analysis Complete")).toBeVisible({ timeout: 30_000 })
    await page.getByRole("button", { name: "Share with a Doctor" }).click()
    await expect(page.getByText("Unlock Doctor Network")).toBeVisible()
  })
})

test.describe("AI Agent — follow-up chat", () => {
  test("free user: locked input, counter, and server-side daily limit state", async ({ page }) => {
    const user = await createUser(page)
    await openAgent(page)
    await expect(page.getByText("Follow-Up Chat")).toBeVisible()
    await expect(page.getByText("0/1 today")).toBeVisible()
    await expect(page.getByText("to chat with the Hair Agent, ask follow-up questions about diet, custom protocols, and receive direct expert guidance.")).toBeVisible()
    await expect(page.getByPlaceholder("Ask about your progress, diet, protocol…")).toHaveCount(0)

    const today = new Date().toISOString().slice(0, 10)
    await sql(`INSERT INTO agent_daily_count (id, "userId", date, count) VALUES (gen_random_uuid()::text, $1, $2, 1)`, [user.id, today])
    await page.reload()
    await page.getByRole("button", { name: /AI Agent/ }).first().click()
    await expect(page.getByText("1/1 today")).toBeVisible()
    await expect(page.getByText("Daily question limit reached")).toBeVisible()
    await expect(page.getByText("Upgrade to Densify Pro for unlimited AI conversations, lab tracking, and full analytics.")).toBeVisible()
  })

  test("premium chat: send text + attach photo; analysis JSON rows render as text", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await sql(
      `INSERT INTO agent_message (id, "userId", role, content) VALUES (gen_random_uuid()::text, $1, 'assistant', $2)`,
      [user.id, JSON.stringify({ miniaturization_index: 0.2, density_percentage: 70, clinical_summary: "Summary text", raw_vision_output: "Raw vision narrative" })],
    )
    await openAgent(page)
    await expect(page.getByText("Raw vision narrative")).toBeVisible()

    const input = page.getByPlaceholder("Ask about your progress, diet, protocol…")
    await input.fill("Is my crown improving?")
    await input.press("Enter")
    await expect(page.getByText("Is my crown improving?", { exact: true })).toBeVisible()
    await expect(page.getByText(/Mock trichologist reply to: .*Is my crown improving\?/)).toBeVisible({ timeout: 20_000 })

    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG })
    await expect(page.getByAltText("Selected photo")).toBeVisible()
    await input.press("Enter")
    await expect(page.getByText("Please analyze my progress photo.", { exact: true })).toBeVisible()
    // Exact match: a regex with .* also matches a parent whose text joins the previous reply and
    // the optimistic user message, passing before this reply has been written.
    await expect(page.getByText("Mock trichologist reply to: Please analyze my progress photo.", { exact: true })).toBeVisible({ timeout: 20_000 })

    // Chat photos are stored in the vault (object storage) as Crown captures.
    const photos = await sql(`SELECT angle, "dataUrl" FROM progress_photo WHERE "userId" = $1`, [user.id])
    expect(photos).toHaveLength(1)
    expect(photos[0].angle).toBe("Crown")
    expect(photos[0].dataUrl).toMatch(new RegExp(`/vault/${user.id}/\\d{4}-\\d{2}/Crown/[0-9a-f-]+\\.png$`))
    const msgs = await sql(`SELECT role, content, "photoId" FROM agent_message WHERE "userId" = $1 ORDER BY "createdAt"`, [user.id])
    expect(msgs.map((m) => m.role)).toEqual(["assistant", "user", "assistant", "user", "assistant"])
    // Premium: no daily count row
    expect(await sql(`SELECT 1 FROM agent_daily_count WHERE "userId" = $1`, [user.id])).toHaveLength(0)
  })
})
