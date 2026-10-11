import { expect, test, type Browser, type Page } from "@playwright/test"
import { createUser, sql, uniqueEmail, type TestUser } from "./helpers"
import { openView, seedPhoto } from "./helpers-vault"

// Doctors: "I'm a doctor" sign-up/sign-in, the patient's doctor directory (Pro-only behind
// ProGate "Doctor Network"), patient-controlled sharing, and the doctor portal at /doctor.

const tag = () => Math.random().toString(36).slice(2, 8)

/** A verified doctor created through the real sign-up hook, in its own browser context. */
async function createDoctor(browser: Browser, opts: { verified?: boolean } = {}) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const doctor = await createUser(page, { doctor: true, name: `Dr. Test ${tag()}`, verified: opts.verified })
  return { doctor, page, close: () => ctx.close() }
}

function card(page: Page, name: string) {
  return page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name }) })
}

async function link(doctorId: string, patientId: string) {
  const [row] = await sql(
    `SELECT status, "vaultAccessGranted", "labAccessGranted" FROM doctor_patient WHERE "doctorId" = $1 AND "patientId" = $2`,
    [doctorId, patientId],
  )
  return row
}

test.describe("I'm a doctor checkbox", () => {
  test("sign-up with the box ticked creates a doctor with a doctor_profile", async ({ page }) => {
    const email = uniqueEmail("doc-signup")
    await page.goto("/sign-up")
    await page.getByPlaceholder("Marcus Reed").fill("Dr. Signup")
    await page.getByPlaceholder("you@example.com").fill(email)
    await page.locator("#password").fill("Densify-Test-Pass1")
    await page.getByLabel(/I'm a doctor/).check()
    await page.getByRole("button", { name: "Create account" }).click()
    // Doctors still verify their email.
    await expect(page).toHaveURL(`/verify?email=${encodeURIComponent(email)}`)

    const [u] = await sql(
      `SELECT u.role, (SELECT count(*)::int FROM doctor_profile d WHERE d."userId" = u.id) AS doc,
              (SELECT count(*)::int FROM profile p WHERE p."userId" = u.id) AS prof
       FROM "user" u WHERE email = $1`,
      [email],
    )
    expect(u).toEqual({ role: "doctor", doc: 1, prof: 0 })
  })

  test("sign-up without the box creates a patient with a profile", async ({ page }) => {
    const user = await createUser(page)
    const [u] = await sql(
      `SELECT u.role, (SELECT count(*)::int FROM doctor_profile d WHERE d."userId" = u.id) AS doc,
              (SELECT count(*)::int FROM profile p WHERE p."userId" = u.id) AS prof
       FROM "user" u WHERE id = $1`,
      [user.id],
    )
    expect(u).toEqual({ role: "patient", doc: 0, prof: 1 })
  })

  test("doctor signs in with the box ticked → doctor portal", async ({ page, browser }) => {
    const { doctor, close } = await createDoctor(browser)
    await close()
    await page.goto("/sign-in")
    await page.getByLabel(/I'm a doctor/).check()
    await page.getByLabel("Email address").fill(doctor.email)
    await page.locator("#password").fill(doctor.password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL("/doctor")
    await expect(page.getByText("No patients are linked to your account yet.")).toBeVisible()
  })

  test("patient with the box ticked is refused", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const patient = await createUser(await ctx.newPage())
    await ctx.close()
    await page.goto("/sign-in")
    await page.getByLabel(/I'm a doctor/).check()
    await page.getByLabel("Email address").fill(patient.email)
    await page.locator("#password").fill(patient.password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page.getByText("This account isn't registered as a doctor.", { exact: false })).toBeVisible()
    await expect(page).toHaveURL("/sign-in")
  })

  test("role routing: patients can't open /doctor, doctors are sent there from /", async ({ page, browser }) => {
    await createUser(page)
    const asPatient = await page.request.get("/doctor", { maxRedirects: 0 })
    expect(asPatient.status()).toBe(307)
    expect(new URL(asPatient.headers()["location"], "http://x").pathname).toBe("/")

    const { page: docPage, close } = await createDoctor(browser)
    const asDoctor = await docPage.request.get("/", { maxRedirects: 0 })
    expect(asDoctor.status()).toBe(307)
    expect(new URL(asDoctor.headers()["location"], "http://x").pathname).toBe("/doctor")
    await close()
  })
})

test.describe("Doctor directory (premium patient)", () => {
  test("connect with chosen sharing → change sharing → disconnect", async ({ page, browser }) => {
    const { doctor, close } = await createDoctor(browser)
    await close()
    const patient = await createUser(page, { tier: "premium" })
    await openView(page, "doctor")

    await page.getByPlaceholder("Search by name, specialty or clinic").fill(doctor.name)
    await card(page, doctor.name).getByRole("button", { name: "Connect" }).click()

    // Consent dialog: nothing ticked by default.
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText(`Connect with ${doctor.name}`)).toBeVisible()
    await expect(dialog.getByLabel(/Progress photos/)).not.toBeChecked()
    await expect(dialog.getByLabel(/Lab reports/)).not.toBeChecked()
    await dialog.getByLabel(/Progress photos/).check()
    await dialog.getByRole("button", { name: "Connect" }).click()

    await expect(page.getByText(`Connected with ${doctor.name}`)).toBeVisible()
    await expect(page.getByRole("heading", { name: "My doctors" })).toBeVisible()
    expect(await link(doctor.id, patient.id)).toEqual({ status: "active", vaultAccessGranted: true, labAccessGranted: false })

    await page.getByLabel(`Share lab reports with ${doctor.name}`).check()
    await expect.poll(async () => (await link(doctor.id, patient.id)).labAccessGranted).toBe(true)

    await card(page, doctor.name).getByRole("button", { name: "Disconnect" }).click()
    await expect(page.getByText(`Disconnected from ${doctor.name}`)).toBeVisible()
    expect(await link(doctor.id, patient.id)).toEqual({ status: "concluded", vaultAccessGranted: false, labAccessGranted: false })
    // Back in the directory.
    await expect(card(page, doctor.name).getByRole("button", { name: "Connect" })).toBeVisible()
  })

  test("unverified doctors are not listed", async ({ page, browser }) => {
    const { doctor, close } = await createDoctor(browser, { verified: false })
    await close()
    await createUser(page, { tier: "premium" })
    await openView(page, "doctor")
    await page.getByPlaceholder("Search by name, specialty or clinic").fill(doctor.name)
    await expect(page.getByText("No doctors match your search.")).toBeVisible()
  })

  test("free user sees ProGate: Unlock Doctor Network", async ({ page }) => {
    await createUser(page, { tier: "free" })
    await openView(page, "doctor")
    await expect(page.getByText("Pro Feature")).toBeVisible()
    await expect(page.getByText("Unlock Doctor Network")).toBeVisible()
    await page.getByRole("button", { name: "Upgrade to Pro", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Upgrade to Pro" }).first()).toBeVisible()
  })
})

test.describe("Doctor portal", () => {
  async function linkedPair(page: Page, browser: Browser, sharing: { photos: boolean; labs: boolean }) {
    const pctx = await browser.newContext()
    const patient: TestUser = await createUser(await pctx.newPage(), { name: `Patient ${tag()}` })
    await pctx.close()
    const doctor = await createUser(page, { doctor: true, name: `Dr. Test ${tag()}` })
    await sql(
      `INSERT INTO doctor_patient (id, "doctorId", "patientId", status, "vaultAccessGranted", "labAccessGranted")
       VALUES (gen_random_uuid()::text, $1, $2, 'active', $3, $4)`,
      [doctor.id, patient.id, sharing.photos, sharing.labs],
    )
    return { doctor, patient }
  }

  test("shows only what the patient shared, and follows changes", async ({ page, browser }) => {
    const { doctor, patient } = await linkedPair(page, browser, { photos: true, labs: false })
    await seedPhoto(patient.id, "Crown", "2026-02-01T10:00:00.000Z")

    await page.goto("/doctor")
    await page.getByRole("button", { name: new RegExp(patient.name) }).click()
    await expect(page.getByRole("heading", { name: patient.name })).toBeVisible()
    await expect(page.getByAltText("Crown")).toBeVisible()
    await expect(page.getByText("The patient hasn't shared this with you.")).toHaveCount(1) // labs

    // Patient turns photos off: the server action itself stops returning them.
    await sql(`UPDATE doctor_patient SET "vaultAccessGranted" = false WHERE "doctorId" = $1 AND "patientId" = $2`, [doctor.id, patient.id])
    await page.reload()
    await page.getByRole("button", { name: new RegExp(patient.name) }).click()
    await expect(page.getByText("The patient hasn't shared this with you.")).toHaveCount(2)
    await expect(page.getByAltText("Crown")).toHaveCount(0)
  })

  test("disconnected patients disappear from the caseload", async ({ page, browser }) => {
    const { doctor, patient } = await linkedPair(page, browser, { photos: true, labs: true })
    await page.goto("/doctor")
    await expect(page.getByRole("button", { name: new RegExp(patient.name) })).toBeVisible()
    await sql(`UPDATE doctor_patient SET status = 'concluded' WHERE "doctorId" = $1 AND "patientId" = $2`, [doctor.id, patient.id])
    await page.reload()
    await expect(page.getByText("No patients are linked to your account yet.")).toBeVisible()
  })
})

