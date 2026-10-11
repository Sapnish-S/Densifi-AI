import { expect, type Page } from "@playwright/test"
import pg from "pg"

const pool = new pg.Pool({
  connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://densify:densify@db:5432/densify",
  max: 2,
})

export async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}

export function uniqueEmail(tag = "e2e"): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@autotest.internal`
}

/** Poll the verification table for the OTP FastAPI stored for this identifier. */
export async function readOtp(identifier: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const rows = await sql<{ value: string }>(
      `SELECT value FROM verification WHERE identifier = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [identifier],
    )
    if (rows[0]) return rows[0].value
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no OTP for ${identifier}`)
}

export interface TestUser {
  id: string
  name: string
  email: string
  password: string
}

/**
 * Create a user through Better Auth's real sign-up endpoint (bcrypt-ts hash, session
 * cookie lands in the page's browser context), then mark it verified / set the tier.
 */
export async function createUser(
  page: Page,
  opts: {
    verified?: boolean
    tier?: "free" | "premium"
    name?: string
    lastSeenDaysAgo?: number
    onboarded?: boolean
    doctor?: boolean // signs up with the "I'm a doctor" choice (accountType: "doctor")
  } = {},
): Promise<TestUser> {
  const user = {
    name: opts.name ?? "Marcus Reed",
    email: uniqueEmail(),
    password: "Densify-Test-Pass1", // gitleaks:allow — E2E fixture, not a credential
  }
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { ...user, accountType: opts.doctor ? "doctor" : "patient" },
    headers: { Origin: "http://localhost:3000" },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const [{ id }] = await sql<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [user.email])
  if (opts.verified !== false) {
    await sql(`UPDATE "user" SET "emailVerified" = true WHERE id = $1`, [id])
  }
  if (opts.tier) {
    await sql(
      `INSERT INTO profile (id, "userId", tier) VALUES (gen_random_uuid()::text, $1, $2)
       ON CONFLICT ("userId") DO UPDATE SET tier = EXCLUDED.tier`,
      [id, opts.tier],
    )
  }
  // Default: tour already completed, so the onboarding overlay doesn't cover the UI.
  if (opts.onboarded !== false || opts.lastSeenDaysAgo !== undefined) {
    await sql(
      `INSERT INTO notification_prefs (id, user_id, has_completed_onboarding, last_seen_at)
       VALUES (gen_random_uuid()::text, $1, $2, CASE WHEN $3::int IS NULL THEN NULL ELSE now() - make_interval(days => $3::int) END)
       ON CONFLICT (user_id) DO UPDATE SET has_completed_onboarding = EXCLUDED.has_completed_onboarding, last_seen_at = EXCLUDED.last_seen_at`,
      [id, opts.onboarded !== false, opts.lastSeenDaysAgo ?? null],
    )
  }
  if (opts.tier === "premium") {
    await page.addInitScript(() => localStorage.setItem("densify_hasSeenProTour", "true"))
  }
  return { id, ...user }
}

export async function signInViaUi(page: Page, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email address").fill(email)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
}
