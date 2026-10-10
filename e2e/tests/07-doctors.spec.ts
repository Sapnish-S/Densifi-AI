import { expect, test, type Page } from "@playwright/test"
import { createUser } from "./helpers"
import { openView } from "./helpers-vault"

// Doctors view (05 §11) — Pro-only behind ProGate "Doctor Network". All chat state is client-side.

const INITIAL_DOCTOR_MSG =
  "Hello, I saw your consultation request. Could you please forward your latest Bedrock AI density report?"

function card(page: Page, name: string) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name }) })
}

function toast(page: Page, text: string) {
  return page.locator("div.absolute.top-4").filter({ hasText: text })
}

test.describe("Doctors (premium)", () => {
  test("directory: three specialists, doc-1 pre-booked, tabs", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await openView(page, "doctor")

    await expect(page.getByRole("button", { name: "Find a Specialist" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Messages/ })).toContainText("1")
    await expect(page.getByRole("heading", { name: "Specialist Directory" })).toBeVisible()
    await expect(
      page.getByText("Connect with top-tier hair restoration professionals to review your AI metrics."),
    ).toBeVisible()

    const specs = [
      ["Dr. E. Butler", "Hair Restoration Specialist", "5.0", "EB"],
      ["Dr. L. Mehl", "Dermatologist & Trichologist", "4.9", "LM"],
      ["Dr. U. Sitaula", "Scalp Specialist", "5.0", "US"],
    ] as const
    for (const [name, specialty, rating, initials] of specs) {
      const c = card(page, name)
      await expect(c).toBeVisible()
      await expect(c).toContainText(specialty)
      await expect(c).toContainText(rating)
      await expect(c).toContainText(initials)
      await expect(c).toContainText("$150 / consult")
    }
    await expect(page.getByText("$150 / consult")).toHaveCount(3)

    // doc-1 starts booked.
    await expect(card(page, "Dr. E. Butler")).toContainText("Booked")
    await expect(card(page, "Dr. E. Butler").getByRole("button", { name: "Message Doctor" })).toBeVisible()
    await expect(card(page, "Dr. L. Mehl").getByRole("button", { name: "Book Consultation" })).toBeVisible()
    await expect(card(page, "Dr. U. Sitaula").getByRole("button", { name: "Book Consultation" })).toBeVisible()

    // Messages tab: Active Consultations + the doctor's opening message.
    await page.getByRole("button", { name: /Messages/ }).click()
    await expect(page.getByRole("heading", { name: "Active Consultations" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Dr. E. Butler" })).toBeVisible()
    await expect(page.getByText(INITIAL_DOCTOR_MSG)).toBeVisible()
    await expect(page.getByText("Tap to view conversation...")).toBeVisible()

    await page.getByRole("button", { name: "Find a Specialist" }).click()
    await expect(page.getByRole("heading", { name: "Specialist Directory" })).toBeVisible()
    await card(page, "Dr. E. Butler").getByRole("button", { name: "Message Doctor" }).click()
    await expect(page.getByText(INITIAL_DOCTOR_MSG)).toBeVisible()
  })

  test("Book Consultation → backend call, toast, Messages tab", async ({ page }) => {
    const user = await createUser(page, { tier: "premium" })
    await openView(page, "doctor")

    const bookReq = page.waitForRequest(
      (r) => r.method() === "POST" && r.url() === "http://localhost:8000/api/appointments/book",
    )
    const btn = card(page, "Dr. L. Mehl").getByRole("button", { name: "Book Consultation" })
    await btn.click()
    await expect(card(page, "Dr. L. Mehl").getByRole("button", { name: "Booking..." })).toBeVisible()

    const req = await bookReq
    const today = new Date().toISOString().split("T")[0]
    expect(req.postDataJSON()).toEqual({ email: user.email, doctor_name: "Dr. L. Mehl", date_time: `${today} 09:00:00` })
    expect(req.headers()["content-type"]).toBe("application/json")

    await expect(toast(page, "Successfully booked consultation with Dr. L. Mehl")).toBeVisible()
    // Switched to Messages with the new chat active (empty — no doctor reply).
    await expect(page.getByRole("heading", { name: "Active Consultations" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Messages/ })).toContainText("2")
    await expect(page.getByRole("heading", { name: "Dr. L. Mehl" })).toBeVisible()
    await expect(page.getByText("Dermatologist & Trichologist").last()).toBeVisible()
    await expect(page.getByText("Start a new conversation")).toBeVisible()
    await expect(page.getByText(INITIAL_DOCTOR_MSG)).toHaveCount(0)
    // Toast clears after 3 s.
    await expect(toast(page, "Successfully booked consultation with Dr. L. Mehl")).toBeHidden({ timeout: 5_000 })

    await page.getByRole("button", { name: "Find a Specialist" }).click()
    await expect(card(page, "Dr. L. Mehl")).toContainText("Booked")
    await expect(card(page, "Dr. L. Mehl").getByRole("button", { name: "Message Doctor" })).toBeVisible()
  })

  test("Vault Access toggle, Attach Report, send message (no doctor reply)", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await openView(page, "doctor")
    await page.getByRole("button", { name: /Messages/ }).click()
    await expect(page.getByText(INITIAL_DOCTOR_MSG)).toBeVisible()

    await expect(page.getByText("Vault Access", { exact: true })).toBeVisible()
    const sw = page.getByRole("switch")
    await expect(sw).toHaveAttribute("aria-checked", "false")
    await sw.click()
    await expect(sw).toHaveAttribute("aria-checked", "true")
    await expect(page.getByText("You granted this specialist access to your encrypted Progression Vault.")).toBeVisible()
    await expect(toast(page, "Clinical Access Granted")).toBeVisible()

    await sw.click()
    await expect(sw).toHaveAttribute("aria-checked", "false")
    await expect(page.getByText("You revoked this specialist's access to your Progression Vault.")).toBeVisible()
    await expect(toast(page, "Clinical Access Revoked")).toBeVisible()

    // Attach Report → report card with fallback values.
    await page.getByRole("button", { name: "Attach Report" }).click()
    await expect(toast(page, "Report securely attached to chat.")).toBeVisible()
    const report = page.locator("div.max-w-\\[280px\\]").filter({ hasText: "Bedrock AI Report" })
    await expect(report).toHaveCount(1)
    await expect(report).toContainText("Density")
    await expect(report).toContainText("30%")
    await expect(report).toContainText("Miniaturization")
    await expect(report).toContainText("0.7")
    await expect(report).not.toContainText("Clinical Summary")

    // Typing + Enter appends a user bubble; no reply is generated.
    const input = page.getByPlaceholder("Type a message...")
    await input.fill("When should I schedule my follow-up scan?")
    await input.press("Enter")
    const bubble = page.locator("div.bg-primary.rounded-br-sm", { hasText: "When should I schedule my follow-up scan?" })
    await expect(bubble).toBeVisible()
    await expect(input).toHaveValue("")
    // Whitespace-only is ignored.
    await input.fill("   ")
    await input.press("Enter")
    await page.waitForTimeout(1500)
    await expect(page.locator("div.bg-primary.rounded-br-sm")).toHaveCount(1)
    await expect(page.locator("div.bg-muted.rounded-bl-sm")).toHaveCount(1) // only the initial doctor message
  })
})

test("free user sees ProGate: Unlock Doctor Network", async ({ page }) => {
  await createUser(page, { tier: "free" })
  await openView(page, "doctor")
  await expect(page.getByText("Pro Feature")).toBeVisible()
  await expect(page.getByText("Unlock Doctor Network")).toBeVisible()
  await expect(
    page.getByText("Upgrade to Densify Pro for the full clinical analytics suite, unlimited AI, and complete biomarker tracking."),
  ).toBeVisible()
  await page.getByRole("button", { name: "Upgrade to Pro", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Upgrade to Pro" }).first()).toBeVisible()
})
