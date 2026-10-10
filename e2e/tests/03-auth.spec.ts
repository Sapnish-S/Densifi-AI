import { expect, test } from "@playwright/test"
import { createUser, readOtp, signInViaUi, sql, uniqueEmail } from "./helpers"

// Auth journeys: sign-up, verification, sign-in and password reset.

async function typeOtp(page, otp: string) {
  const boxes = page.locator('input[autocomplete="one-time-code"]')
  await expect(boxes).toHaveCount(6)
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(otp[i])
}

test.describe("J1 sign-up & verification", () => {
  test("sign-up → OTP → verify → dashboard", async ({ page }) => {
    const email = uniqueEmail("signup")
    await page.goto("/sign-up")
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    await expect(page.getByText("Start tracking your hair restoration journey.")).toBeVisible()
    await page.getByPlaceholder("Marcus Reed").fill("Marcus Reed")
    await page.getByPlaceholder("you@example.com").fill(email)
    await page.locator("#password").fill("Densify-Test-Pass1")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(`/verify?email=${encodeURIComponent(email)}`)
    await expect(page.getByRole("heading", { name: "Verify Account" })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    // Unverified session: middleware forces /verify for the dashboard.
    const guard = await page.request.get("/", { maxRedirects: 0 })
    expect(guard.status()).toBe(307)
    expect(guard.headers()["location"]).toContain(`/verify?email=${encodeURIComponent(email)}`)

    // Incomplete code
    await page.getByRole("button", { name: "Verify Account" }).click({ force: true })
    const otp = await readOtp(email)
    await typeOtp(page, otp)
    await page.getByRole("button", { name: "Verify Account" }).click()
    await expect(page.getByText("Verification successful. Redirecting to dashboard...")).toBeVisible()
    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await expect(page.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible()

    const [u] = await sql(`SELECT "emailVerified", account.password FROM "user" JOIN account ON account."userId" = "user".id WHERE email = $1`, [email])
    expect(u.emailVerified).toBe(true)
    expect(u.password).toMatch(/^\$2[ab]\$12\$/) // bcrypt-ts cost 12
  })

  test("duplicate sign-up shows Better Auth error", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const existing = await createUser(await ctx.newPage())
    await ctx.close()
    await page.goto("/sign-up")
    await page.getByPlaceholder("Marcus Reed").fill("Dup")
    await page.getByPlaceholder("you@example.com").fill(existing.email)
    await page.locator("#password").fill("Densify-Test-Pass1")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.locator(".text-red-400\\/90")).toBeVisible()
    await expect(page).toHaveURL("/sign-up")
  })

  test("verify page without email param + resend", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const user = await createUser(await ctx.newPage(), { verified: false })
    await ctx.close()

    await page.goto("/verify")
    await expect(page.getByText("Enter the 6-digit clinical security code sent to your email.")).toBeVisible()
    await expect(page.getByPlaceholder("patient@example.com")).toBeVisible()

    await page.getByRole("button", { name: /Resend Code/ }).click()
    await expect(page.getByText("Please provide your email address to resend the code.")).toBeVisible()

    await page.getByPlaceholder("patient@example.com").fill(user.email)
    await page.getByRole("button", { name: /Resend Code/ }).click()
    await expect(page.getByText("A new 6-digit code has been sent to your email.")).toBeVisible()

    await typeOtp(page, "999999" === (await readOtp(user.email)) ? "999998" : "999999")
    await page.getByRole("button", { name: "Verify Account" }).click()
    await expect(page.getByText("Invalid or expired verification code.")).toBeVisible()
  })

  test("OTP boxes auto-advance and backspace moves back", async ({ page }) => {
    await page.goto("/verify?email=x%40example.com")
    const boxes = page.locator('input[autocomplete="one-time-code"]')
    await boxes.nth(0).click()
    await page.keyboard.type("12")
    await expect(boxes.nth(0)).toHaveValue("1")
    await expect(boxes.nth(1)).toHaveValue("2")
    await expect(boxes.nth(2)).toBeFocused()
    await page.keyboard.press("Backspace")
    await expect(boxes.nth(1)).toBeFocused()
  })
})

test.describe("J2 sign-in", () => {
  test("wrong password → 'Invalid credentials'", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const user = await createUser(await ctx.newPage())
    await ctx.close()
    await signInViaUi(page, user.email, "wrong-password")
    await expect(page.getByText("Invalid credentials")).toBeVisible()
  })

  test("unverified user → resend + /verify", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const user = await createUser(await ctx.newPage(), { verified: false })
    await ctx.close()
    await signInViaUi(page, user.email, user.password)
    await expect(page).toHaveURL(`/verify?email=${encodeURIComponent(user.email)}`)
    expect(await readOtp(user.email)).toMatch(/^\d{6}$/)
  })

  test("verified user → dashboard; sign-in page then redirects to /", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const user = await createUser(await ctx.newPage())
    await ctx.close()
    await signInViaUi(page, user.email, user.password)
    await expect(page).toHaveURL("/")
    await expect(page.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible()
    await page.goto("/sign-in")
    await expect(page).toHaveURL("/")
  })

  test("forgot links on sign-in", async ({ page }) => {
    await page.goto("/sign-in")
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    await page.getByRole("link", { name: "Forgot password?" }).click()
    await expect(page).toHaveURL("/forgot-password")
    await page.goto("/sign-in")
    await page.getByText("Reset Password").click()
    await expect(page).toHaveURL("/forgot-password")
  })
})

test.describe("J3 password reset", () => {
  test("forgot → reset (validation, same-password, success) → sign in with new password", async ({ page, browser }) => {
    const ctx = await browser.newContext()
    const user = await createUser(await ctx.newPage())
    await ctx.close()

    await page.goto("/forgot-password")
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible()
    await page.getByPlaceholder("patient@example.com").fill(user.email)
    await page.getByRole("button", { name: "Send Verification Code" }).click()
    await expect(page).toHaveURL(`/reset-password?email=${encodeURIComponent(user.email)}`)
    await expect(page.getByRole("heading", { name: "Create New Password" })).toBeVisible()

    const otp = await readOtp(`reset:${user.email}`)
    const [pw, confirm] = [page.getByPlaceholder("••••••••").nth(0), page.getByPlaceholder("••••••••").nth(1)]
    await page.getByPlaceholder("123456").fill(otp)
    await pw.fill("short")
    await expect(page.getByText("Password must be at least 8 characters long.")).toBeVisible()
    await confirm.fill("shorter")
    await expect(page.getByText("Passwords do not match.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeDisabled()

    await pw.fill(user.password)
    await confirm.fill(user.password)
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(page.getByText("Your new password cannot be the same as your old password.")).toBeVisible()

    await pw.fill("Brand-New-Pass2")
    await confirm.fill("Brand-New-Pass2")
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(page.getByText("Password reset successful. Redirecting to sign in...")).toBeVisible()
    await expect(page).toHaveURL("/sign-in", { timeout: 10_000 })

    // Python-written bcrypt hash verified by Better Auth (bcrypt-ts) on sign-in.
    await signInViaUi(page, user.email, "Brand-New-Pass2")
    await expect(page).toHaveURL("/")
  })

  test("invalid reset code", async ({ page }) => {
    await page.goto(`/reset-password?email=${encodeURIComponent(uniqueEmail("nobody"))}`)
    await page.getByPlaceholder("123456").fill("000000")
    await page.getByPlaceholder("••••••••").nth(0).fill("Brand-New-Pass2")
    await page.getByPlaceholder("••••••••").nth(1).fill("Brand-New-Pass2")
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(page.getByText("Invalid or expired reset code.")).toBeVisible()
  })
})
