import { expect, test, type Page } from "@playwright/test"
import { createUser } from "./helpers"
import {
  notifPrefs,
  profileRow,
  retentionRow,
  setTier,
  sidebarItem,
  stubNotificationPermission,
  VALID_SUBSCRIPTION,
} from "./helpers-shell"

// Dashboard shell, account, upgrade, notifications, retention dialog and campaign
// tutorial. Copy matches frontend/components/*.

const VIEW_META = {
  overview: ["Dashboard Overview", "Core metrics, daily check-in, and visual progression at a glance"],
  clinical: ["Clinical Analytics", "Protocol & Regimen, Multi-Modal Biomarker Grid, and Treatment Outcome Correlation Engine"],
  doctor: ["Clinical Doctor Network", "Connect, chat, and schedule appointments with local trichologists and hair restoration specialists"],
  vault: ["Progression Vault", "Monthly photo archive — Front, Crown, and Side views organised into dated subfolders"],
  agent: ["AI Hair Analysis Agent", "Visual comparison, regional density breakdown, and conversational follow-up"],
  account: ["Account Settings", "Manage your profile, plan, and preferences"],
  upgrade: ["Upgrade to Pro", "Unlock the full Densify clinical toolkit"],
  notifications: ["Notification Engine", "Web push alerts, daily reminders, and retention settings — wired to your device"],
} as const

async function expectView(page: Page, view: keyof typeof VIEW_META) {
  const [title, subtitle] = VIEW_META[view]
  // CSS locator (not role): an open Radix dialog aria-hides the rest of the page.
  await expect(page.locator("main h1")).toHaveText(title)
  await expect(page.locator("main h1 + p")).toHaveText(subtitle)
}

async function gotoDashboard(page: Page) {
  await page.goto("/")
  await expectView(page, "overview")
}

const header = (page: Page) => page.locator("header")

// ───────────────────────────── Header ─────────────────────────────
test.describe("dashboard header", () => {
  test("free: Upgrade button, no Pro chip, initials, logo/bell/avatar navigation", async ({ page }) => {
    await createUser(page, { name: "Marcus Reed" })
    await gotoDashboard(page)
    const h = header(page)
    await expect(h.getByRole("button", { name: "Upgrade" })).toBeVisible()
    await expect(h.getByText("Pro", { exact: true })).toHaveCount(0)

    const avatar = h.getByRole("button", { name: "Account settings" })
    await expect(avatar).toHaveText("MR")
    await expect(avatar).toHaveAttribute("title", "Marcus Reed")

    await h.getByRole("button", { name: "Notification settings" }).click()
    await expectView(page, "notifications")
    await avatar.click()
    await expectView(page, "account")
    await h.getByRole("button", { name: "Go to overview" }).click()
    await expectView(page, "overview")
    await h.getByRole("button", { name: "Upgrade" }).click()
    await expectView(page, "upgrade")
  })

  test("premium: Pro chip, no Upgrade button", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await gotoDashboard(page)
    const h = header(page)
    await expect(h.getByText("Pro", { exact: true })).toBeVisible()
    await expect(h.getByRole("button", { name: "Upgrade" })).toHaveCount(0)
  })

  test("camera shortcut opens Vault + Direct Capture dialog", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    await header(page).getByRole("button", { name: "Open camera capture" }).click()
    await expectView(page, "vault")
    await expect(page.getByRole("dialog", { name: "Direct Capture — Monthly Photos" })).toBeVisible()
  })

  test("theme toggle flips html.light and aria label", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    const html = page.locator("html")
    await expect(html).not.toHaveClass(/(^|\s)light(\s|$)/)
    await header(page).getByRole("button", { name: "Switch to light mode" }).click()
    await expect(html).toHaveClass(/(^|\s)light(\s|$)/)
    expect(await page.evaluate(() => localStorage.getItem("densify-theme"))).toBe("light")
    await header(page).getByRole("button", { name: "Switch to dark mode" }).click()
    await expect(html).not.toHaveClass(/(^|\s)light(\s|$)/)
    await expect(header(page).getByRole("button", { name: "Switch to light mode" })).toBeVisible()
  })
})

// ───────────────────────────── Sidebar ─────────────────────────────
test.describe("sidebar @ lg (1440)", () => {
  test("labels, 240px width, lock icons for free, promo, System Instruction", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    const aside = page.locator("aside")
    expect((await aside.boundingBox())!.width).toBe(240)
    for (const label of ["Overview", "Clinical", "Doctors", "Vault", "AI Agent", "Account"]) {
      await expect(aside.getByText(label, { exact: true })).toBeVisible()
    }
    await expect(aside.locator("svg.lucide-lock")).toHaveCount(2)
    await expect(sidebarItem(page, "Clinical").locator("svg.lucide-lock")).toBeVisible()
    await expect(sidebarItem(page, "Doctors").locator("svg.lucide-lock")).toBeVisible()
    await expect(aside.getByRole("button", { name: "System Instruction" })).toBeVisible()

    const promo = aside.getByRole("button", { name: /Upgrade to Pro/ })
    await expect(promo).toContainText("Unlock unlimited AI, biomarker tracking, lab reports, and full analytics.")
    await expect(promo).toContainText("Start free trial →")
    await promo.click()
    await expectView(page, "upgrade")
  })

  test("premium: no lock icons, no promo", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await gotoDashboard(page)
    const aside = page.locator("aside")
    await expect(aside.locator("svg.lucide-lock")).toHaveCount(0)
    await expect(aside.getByText("Upgrade to Pro")).toHaveCount(0)
  })

  test("each view's heading title + subtitle via sidebar/header", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    const nav: [string, keyof typeof VIEW_META][] = [
      ["Clinical", "clinical"],
      ["Doctors", "doctor"],
      ["Vault", "vault"],
      ["AI Agent", "agent"],
      ["Account", "account"],
      ["Overview", "overview"],
    ]
    for (const [title, view] of nav) {
      await sidebarItem(page, title).click()
      await expectView(page, view)
      await expect(page.locator("main").getByText("Densify Clinical Platform").first()).toBeVisible()
    }
    await page.locator("aside").getByRole("button", { name: /Upgrade to Pro/ }).click()
    await expectView(page, "upgrade")
    await header(page).getByRole("button", { name: "Notification settings" }).click()
    await expectView(page, "notifications")
  })
})

test.describe("sidebar @ md (800)", () => {
  test.use({ viewport: { width: 800, height: 900 } })
  test("64px icon rail, no labels, no promo, no bottom bar", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    const aside = page.locator("aside")
    await expect(aside).toBeVisible()
    expect((await aside.boundingBox())!.width).toBe(64)
    await expect(aside.getByText("Overview", { exact: true })).toBeHidden()
    await expect(aside.getByText("System Instruction")).toBeHidden()
    await expect(aside.getByText("Upgrade to Pro")).toBeHidden()
    await expect(aside.locator("svg.lucide-lock").first()).toBeHidden()
    await expect(page.locator("nav.bottom-0")).toBeHidden()
    await sidebarItem(page, "Vault").click()
    await expectView(page, "vault")
  })
})

test.describe("mobile bottom bar (<768)", () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test("5 items, no Account, sidebar hidden, Upgrade button hidden", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    await expect(page.locator("aside")).toBeHidden()
    const bar = page.locator("nav.bottom-0")
    await expect(bar).toBeVisible()
    const items = bar.getByRole("button")
    await expect(items).toHaveCount(5)
    await expect(items).toHaveText(["Overview", "Clinical", "Doctors", "Vault", "AI"])
    await expect(bar.getByText("Account")).toHaveCount(0)
    await expect(header(page).getByRole("button", { name: "Upgrade" })).toBeHidden()
    await items.nth(4).click()
    await expectView(page, "agent")
  })

  test("premium mobile: crown-only chip (no Pro text)", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await gotoDashboard(page)
    await expect(header(page).getByText("Pro", { exact: true })).toBeHidden()
    await expect(header(page).locator("span.sm\\:hidden svg.lucide-crown")).toBeVisible()
  })
})

// ───────────────────────────── Account ─────────────────────────────
test.describe("account view", () => {
  test("free: profile, plan copy, edit display name (U20 quirk), upgrade CTA", async ({ page }) => {
    const user = await createUser(page)
    await gotoDashboard(page)
    await header(page).getByRole("button", { name: "Account settings" }).click()
    await expectView(page, "account")
    const main = page.locator("main")
    await expect(main.getByText(user.email).first()).toBeVisible()
    await expect(main.getByText("Free", { exact: true })).toBeVisible()
    await expect(main.getByText("Display name")).toBeVisible()
    await expect(main.getByText("Email address")).toBeVisible()
    await expect(main.getByText("Subscription plan")).toBeVisible()
    await expect(main.getByText("Densify Free")).toBeVisible()
    await expect(main.getByText("1 AI question per day, photo uploads. Upgrade for unlimited access.")).toBeVisible()

    // Edit display name → profile."displayName"; header keeps Better Auth user.name (U20)
    await main.getByRole("button", { name: "Edit name" }).click()
    const input = main.getByRole("textbox")
    await expect(input).toHaveValue("Marcus Reed")
    await expect(input).toBeFocused()
    await input.fill("Marc Tester")
    await input.locator("xpath=following-sibling::button").click()
    await expect(main.getByRole("button", { name: "Edit name" })).toBeVisible()
    await expect(main.getByText("Marc Tester", { exact: true })).toBeVisible()
    await expect.poll(async () => (await profileRow(user.id))?.displayName).toBe("Marc Tester")
    await expect(header(page).getByRole("button", { name: "Account settings" })).toHaveText("MR")
    await expect(header(page).getByRole("button", { name: "Account settings" })).toHaveAttribute("title", "Marcus Reed")
    // After reload the field shows user.name again
    await page.reload()
    await header(page).getByRole("button", { name: "Account settings" }).click()
    await expect(main.getByText("Marcus Reed", { exact: true }).last()).toBeVisible()
    await expect(main.getByText("Marc Tester")).toHaveCount(0)

    await main.getByRole("button", { name: "Upgrade to Pro — $19/mo" }).click()
    await expectView(page, "upgrade")
  })

  test("premium: Pro chip and plan copy", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await gotoDashboard(page)
    await sidebarItem(page, "Account").click()
    const main = page.locator("main")
    await expect(main.getByText("Pro", { exact: true })).toBeVisible()
    await expect(main.getByText("Densify Pro")).toBeVisible()
    await expect(main.getByText("Unlimited AI conversations, lab uploads, biomarker tracking, and full protocol analytics.")).toBeVisible()
    await expect(main.getByText("Your Pro subscription is active. Manage billing through the account settings.")).toBeVisible()
    await expect(main.getByRole("button", { name: /Upgrade to Pro/ })).toHaveCount(0)
  })

  test("sign out → /sign-in", async ({ page }) => {
    await createUser(page)
    await gotoDashboard(page)
    await sidebarItem(page, "Account").click()
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    const res = await page.request.get("/", { maxRedirects: 0 })
    expect([302, 307]).toContain(res.status())
  })
})

// ───────────────────────────── Upgrade ─────────────────────────────
test.describe("upgrade view", () => {
  test("plans copy, Start 7-day free trial → premium, back to overview, Pro chip, Pro tour", async ({ page }) => {
    const user = await createUser(page)
    await gotoDashboard(page)
    await header(page).getByRole("button", { name: "Upgrade" }).click()
    await expectView(page, "upgrade")
    const main = page.locator("main")
    for (const text of [
      "The complete clinical toolkit for your hair restoration journey. Track every biomarker, upload lab reports, and have unlimited conversations with your AI hair analysis agent.",
      "$0",
      "$19",
      "7-day free trial",
      "Current",
      "Recommended",
      "Progress photo uploads",
      "1 AI agent question per day",
      "Unlimited AI conversations",
      "Full dashboard & analytics",
      "Biomarker & lab report tracking",
      "Protocol & medication management",
      "Unlimited photo vault",
      "Priority AI analysis",
      "Everything included in Pro",
      "Ask your agent as many questions as you need, every day.",
      "Upload blood panels and track DHT, Testosterone, Ferritin, and Vitamin D over time.",
      "Longitudinal outcome charts, miniaturization curves, and compliance tracking.",
      "Log every compound, dose, and cadence. Monitor adherence week over week.",
    ]) {
      await expect(main.getByText(text, { exact: true }).first()).toBeVisible()
    }
    await expect(main.getByRole("button", { name: "Upgrade to Pro — $19/month" })).toBeVisible()

    await main.getByRole("button", { name: "Start 7-day free trial" }).click()
    await expectView(page, "overview")
    await expect.poll(async () => (await profileRow(user.id))?.tier).toBe("premium")
    const upgraded = await profileRow(user.id)
    expect(upgraded?.tierChangedBy).toBe(user.id)
    expect(upgraded?.tierChangedAt).toBeTruthy()
    await expect(header(page).getByText("Pro", { exact: true })).toBeVisible()
    await expect(header(page).getByRole("button", { name: "Upgrade" })).toHaveCount(0)
    // Tier change re-runs the tutorial effect: Pro tour intro auto-starts (05 §13 / 09 §6)
    await expect(page.getByText("PHASE 02")).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: "Exit" }).click()
    await expect(page.getByText("PHASE 02")).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem("densify_hasSeenProTour"))).toBe("true")
    // Promo and locks gone
    await expect(page.locator("aside").getByText("Upgrade to Pro")).toHaveCount(0)
  })

  // The premium note "You are on Densify Pro. All features are unlocked." is rendered by
  // upgrade-view.tsx for tier=premium, but no UI entry point reaches the upgrade view for
  // premium users (header Upgrade, sidebar promo, account CTA and ProGate are all free-only).
  test.fixme("premium note in upgrade view (unreachable via UI for premium users)", async () => {})
})

// ───────────────────────────── Notifications ─────────────────────────────
test.describe("notifications view", () => {
  test("free, push inactive: disabled toggles, footer, Pro chip on Daily Medication", async ({ page }) => {
    await createUser(page)
    await stubNotificationPermission(page, "default") // a normal browser's initial state
    await gotoDashboard(page)
    await header(page).getByRole("button", { name: "Notification settings" }).click()
    await expectView(page, "notifications")
    const main = page.locator("main")
    await expect(main.getByText("Web Push Notifications")).toBeVisible()
    await expect(main.getByText("Blocked", { exact: true })).toHaveCount(0)
    await expect(main.getByText("Active", { exact: true })).toHaveCount(0)
    await expect(
      main.getByText(
        "Allow Densify to send native push notifications directly to your phone's lock screen — no email required. Used for medication reminders, photo check-ins, and re-engagement alerts.",
      ),
    ).toBeVisible()
    await expect(main.getByRole("button", { name: "Enable Push Notifications" })).toBeVisible()
    await expect(main.getByText("Notification Types")).toBeVisible()
    for (const label of ["Daily Medication Reminder", "Daily Photo Check-In", "Unlock Pro Features", "Inactivity Re-Engagement"]) {
      await expect(main.getByText(label, { exact: true })).toBeVisible()
    }
    await expect(main.getByText("\"Did you take your medication today?\" — sent each morning at 9 AM.")).toBeVisible()
    await expect(main.getByText("\"Did you upload your picture today?\" — sent each evening at 7 PM.")).toBeVisible()
    await expect(main.getByText("Timely reminders about Pro features you are missing — sent weekly.")).toBeVisible()
    await expect(
      main.getByText(
        "\"You have stopped tracking your hair growth, we would love to help you get back on track.\" — triggered after 7 days of no activity.",
      ),
    ).toBeVisible()
    const switches = main.getByRole("switch")
    await expect(switches).toHaveCount(4)
    for (let i = 0; i < 4; i++) await expect(switches.nth(i)).toBeDisabled()
    await expect(main.getByText("Enable push notifications above to activate these toggles.")).toBeVisible()
    await expect(main.getByText("Pro", { exact: true })).toBeVisible()
    await expect(main.getByText("Upgrade to Pro to enable this reminder")).toBeVisible()
  })

  test("premium: Unlock Pro Features hidden, no Pro chip", async ({ page }) => {
    await createUser(page, { tier: "premium" })
    await gotoDashboard(page)
    await header(page).getByRole("button", { name: "Notification settings" }).click()
    const main = page.locator("main")
    await expect(main.getByText("Daily Medication Reminder")).toBeVisible()
    await expect(main.getByText("Unlock Pro Features")).toHaveCount(0)
    await expect(main.getByRole("switch")).toHaveCount(3)
    await expect(main.getByText("Upgrade to Pro to enable this reminder")).toHaveCount(0)
  })

  test("push-subscribe route contract (U23: DELETE keeps endpoint)", async ({ page }) => {
    const user = await createUser(page)
    let res = await page.request.post("/api/push-subscribe", { data: { endpoint: "x" } })
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid subscription object" })

    res = await page.request.post("/api/push-subscribe", { data: VALID_SUBSCRIPTION })
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    let row = await notifPrefs(user.id)
    expect(row?.push_enabled).toBe(true)
    expect(row?.push_endpoint).toBe(VALID_SUBSCRIPTION.endpoint)
    expect(row?.push_p256dh).toBe(VALID_SUBSCRIPTION.keys.p256dh)
    expect(row?.push_auth).toBe(VALID_SUBSCRIPTION.keys.auth)

    res = await page.request.delete("/api/push-subscribe")
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    row = await notifPrefs(user.id)
    expect(row?.push_enabled).toBe(false)
    // Documented COALESCE bug: endpoint/keys are NOT cleared
    expect(row?.push_endpoint).toBe(VALID_SUBSCRIPTION.endpoint)
    expect(row?.push_p256dh).toBe(VALID_SUBSCRIPTION.keys.p256dh)
  })

  test("push-subscribe requires a session", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" })
    const res = await ctx.post("/api/push-subscribe", { data: VALID_SUBSCRIPTION })
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    await ctx.dispose()
  })

  test.describe("with notifications permission granted", () => {
    test.use({ permissions: ["notifications"] })

    test("Enable Push Notifications click in headless Chromium", async ({ page }) => {
      const user = await createUser(page)
      await stubNotificationPermission(page, "default")
      const posts: string[] = []
      const errors: string[] = []
      page.on("request", (r) => {
        if (r.url().includes("/api/push-subscribe") && r.method() === "POST") posts.push(r.url())
      })
      page.on("pageerror", (e) => errors.push(e.message))
      await gotoDashboard(page)
      await header(page).getByRole("button", { name: "Notification settings" }).click()
      const main = page.locator("main")
      const btn = main.getByRole("button", { name: "Enable Push Notifications" })
      await btn.click()
      // Either the subscription succeeds (pushEnabled → Active / Disable button) or
      // pushManager.subscribe rejects (no catch in the code) and the UI stays as-is.
      const active = main.getByRole("button", { name: "Disable Push Notifications" })
      await expect
        .poll(async () => errors.length > 0 || (await active.count()) > 0, { timeout: 10_000 })
        .toBe(true)
      const outcome = (await active.count()) > 0 ? "subscribed" : "failed"
      if (outcome === "subscribed") {
        expect(posts.length).toBe(1)
        expect((await notifPrefs(user.id))?.push_enabled).toBe(true)
        await expect(main.getByText("Active", { exact: true })).toBeVisible()
        await expect(main.getByRole("switch").nth(1)).toBeEnabled()
      } else {
        // subscribe() rejects as an unhandled error (try/finally without catch in
        // notification-engine.tsx); nothing is POSTed. With the local VAPID key configured,
        // headless Chromium has no push service ("Registration failed - permission denied");
        // without a key it fails on the applicationServerKey instead.
        expect(errors.join(" ")).toMatch(/Registration failed|applicationServerKey/)
        expect(posts.length).toBe(0)
        await expect(btn).toBeEnabled()
        await expect(main.getByText("Active", { exact: true })).toHaveCount(0)
        expect(posts.length).toBe(0)
        expect((await notifPrefs(user.id))?.push_enabled ?? false).toBe(false)
        await expect(main.getByText("Enable push notifications above to activate these toggles.")).toBeVisible()
      }
    })

    test("push active (subscription stored): Active badge, toggles enabled, save → Saved, disable", async ({ page }) => {
      const user = await createUser(page)
      const res = await page.request.post("/api/push-subscribe", { data: VALID_SUBSCRIPTION })
      expect(res.ok()).toBeTruthy()
      await stubNotificationPermission(page, "granted")
      await gotoDashboard(page)
      await header(page).getByRole("button", { name: "Notification settings" }).click()
      const main = page.locator("main")
      await expect(main.getByText("Active", { exact: true })).toBeVisible()
      await expect(main.getByRole("button", { name: "Disable Push Notifications" })).toBeVisible()
      await expect(main.getByText("Enable push notifications above to activate these toggles.")).toHaveCount(0)

      const switches = main.getByRole("switch")
      await expect(switches.nth(0)).toBeDisabled() // Daily Medication locked for free
      await expect(switches.nth(1)).toBeEnabled()
      await expect(switches.nth(1)).toHaveAttribute("aria-checked", "true")
      await switches.nth(1).click()
      await expect(switches.nth(1)).toHaveAttribute("aria-checked", "false")
      await expect(main.getByText("Saved", { exact: true })).toBeVisible()
      await expect.poll(async () => (await notifPrefs(user.id))?.daily_photo).toBe(false)
      await expect(main.getByText("Saved", { exact: true })).toBeHidden({ timeout: 4_000 })

      await main.getByRole("button", { name: "Disable Push Notifications" }).click()
      await expect(main.getByRole("button", { name: "Enable Push Notifications" })).toBeVisible()
      await expect.poll(async () => (await notifPrefs(user.id))?.push_enabled).toBe(false)
      expect((await notifPrefs(user.id))?.push_endpoint).toBe(VALID_SUBSCRIPTION.endpoint)
    })
  })

  test.describe("with notifications permission denied", () => {
    test.use({ permissions: [] })
    test("denied → Blocked badge and message", async ({ page, context }) => {
      await context.clearPermissions()
      await createUser(page)
      await stubNotificationPermission(page, "denied")
      await gotoDashboard(page)
      await header(page).getByRole("button", { name: "Notification settings" }).click()
      const main = page.locator("main")
      await expect(main.getByText("Blocked", { exact: true })).toBeVisible()
      await expect(
        main.getByText(
          "Notifications are blocked in your browser settings. Please enable them in your browser permissions and reload the page.",
        ),
      ).toBeVisible()
      await expect(main.getByRole("button", { name: /Push Notifications/ })).toHaveCount(0)
    })
  })
})

// ───────────────────────────── Wellness Check ─────────────────────────────
test.describe("wellness check (retention) dialog", () => {
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Are you taking your medications regularly?" })

  test("inactive ≥7 days → auto-opens; Yes path saves adherent=true", async ({ page }) => {
    const user = await createUser(page, { lastSeenDaysAgo: 8 })
    await page.goto("/")
    await expect(page.getByText("Densify — Wellness Check")).toBeVisible({ timeout: 5_000 })
    const d = page.getByRole("dialog")
    await expect(dialog(page)).toBeVisible()
    await expect(d.getByText("Medication Adherence")).toBeVisible()
    await expect(
      d.getByText(
        "Consistent treatment adherence is the single largest predictor of outcome. Your answer helps us personalise your tracking.",
      ),
    ).toBeVisible()
    await d.getByRole("button", { name: "Yes" }).click()
    await expect(d.getByText("Thanks for checking in")).toBeVisible()
    await expect(d.getByText("Saved", { exact: true })).toBeVisible()
    await expect(
      d.getByText(
        "Your response has been recorded. We have updated your adherence timeline and adjusted your reminders accordingly.",
      ),
    ).toBeVisible()
    const row = await retentionRow(user.id)
    expect(row?.medication_adherent).toBe(true)
    expect(row?.planned_start_date).toBeNull()
    expect(row?.restart_date).toBeNull()
    await d.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    // last_seen_at was touched on page load
    const prefs = await notifPrefs(user.id)
    expect(Date.now() - new Date(prefs!.last_seen_at).getTime()).toBeLessThan(60_000)
  })

  test("No → path-select → planned date (Back works) → saves planned_start_date", async ({ page }) => {
    const user = await createUser(page, { lastSeenDaysAgo: 10 })
    await page.goto("/")
    const d = page.getByRole("dialog")
    await expect(dialog(page)).toBeVisible({ timeout: 5_000 })
    await d.getByRole("button", { name: "No" }).click()
    await expect(d.getByText("No Worries — Let's Adjust")).toBeVisible()
    await expect(d.getByText("What best describes your situation?")).toBeVisible()
    await expect(d.getByText("We will update your tracking and reminders accordingly.")).toBeVisible()
    await expect(d.getByText("Set a planned start date so we can prepare your protocol and send a timely reminder.")).toBeVisible()
    await expect(
      d.getByText("Log the exact restart date to keep your timeline accurate and adherence score up to date."),
    ).toBeVisible()

    await d.getByRole("button", { name: /When are you planning to start taking it\?/ }).click()
    await expect(d.getByText("Planned Start Date", { exact: true })).toBeVisible()
    await expect(d.getByText("We will send you a push reminder the morning of your chosen date.")).toBeVisible()
    await expect(d.getByText("Planned start date", { exact: true })).toBeVisible()
    const confirm = d.getByRole("button", { name: "Confirm Date" })
    await expect(confirm).toBeDisabled()
    // Back → path-select
    await d.getByRole("button", { name: "Back" }).click()
    await expect(d.getByText("What best describes your situation?")).toBeVisible()
    await d.getByRole("button", { name: /When are you planning to start taking it\?/ }).click()
    await d.locator('input[type="date"]').fill("2026-11-01")
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(d.getByText("Thanks for checking in")).toBeVisible()
    const row = await retentionRow(user.id)
    expect(row?.medication_adherent).toBe(false)
    expect(row?.planned_start_date).toBe("2026-11-01")
    expect(row?.restart_date).toBeNull()
    await d.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("No → restart date (Back works) → saves restart_date; Dismiss closes", async ({ page }) => {
    const user = await createUser(page, { lastSeenDaysAgo: 7 })
    await page.goto("/")
    const d = page.getByRole("dialog")
    await expect(dialog(page)).toBeVisible({ timeout: 5_000 })
    await d.getByRole("button", { name: "No" }).click()
    await d.getByRole("button", { name: /I missed a few days and started again/ }).click()
    await expect(d.getByText("Restart Date", { exact: true })).toBeVisible()
    await expect(d.getByText("When did you start taking it again?")).toBeVisible()
    await expect(
      d.getByText(
        "Logging the restart date accurately corrects your adherence score and keeps your correlation data meaningful.",
      ),
    ).toBeVisible()
    await expect(d.getByText("Restart date", { exact: true })).toBeVisible()
    await d.getByRole("button", { name: "Back" }).click()
    await expect(d.getByText("What best describes your situation?")).toBeVisible()
    await d.getByRole("button", { name: /I missed a few days and started again/ }).click()
    const log = d.getByRole("button", { name: "Log Restart" })
    await expect(log).toBeDisabled()
    await d.locator('input[type="date"]').fill("2026-10-01")
    await log.click()
    await expect(d.getByText("Thanks for checking in")).toBeVisible()
    const row = await retentionRow(user.id)
    expect(row?.medication_adherent).toBe(false)
    expect(row?.restart_date).toBe("2026-10-01")
    expect(row?.planned_start_date).toBeNull()
    await d.getByRole("button", { name: "Dismiss" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("recently active user → no dialog", async ({ page }) => {
    await createUser(page, { lastSeenDaysAgo: 1 })
    await gotoDashboard(page)
    await page.waitForTimeout(2_000)
    await expect(page.getByText("Densify — Wellness Check")).toHaveCount(0)
  })
})

// ───────────────────────────── Campaign tutorial (known bug) ─────────────────────────────────────
test.describe("campaign tutorial (known bug: tour targets missing)", () => {
  test("free user, onboarding not completed → no tour (target ids never exist)", async ({ page }) => {
    const user = await createUser(page, { onboarded: false })
    await gotoDashboard(page)
    await page.waitForTimeout(2_000)
    await expect(page.getByText("PHASE 01")).toHaveCount(0)
    await expect(page.getByText("Densify System Setup")).toHaveCount(0)
    // System Instruction re-launch also shows nothing
    await page.locator("aside").getByRole("button", { name: "System Instruction" }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText("PHASE 01")).toHaveCount(0)
    // Onboarding is never marked complete
    expect((await notifPrefs(user.id))?.has_completed_onboarding ?? null).not.toBe(true)
  })

  test("premium, pro tour unseen → PHASE 02 intro → PRO-01 only → completion → localStorage", async ({ page }) => {
    const user = await createUser(page) // free → no pro-tour init script
    await setTier(user.id, "premium")
    await gotoDashboard(page)
    await expect(page.getByText("PHASE 02", { exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("Densify Pro Arsenal")).toBeVisible()
    await expect(page.getByText("Your clinical capabilities have been upgraded.")).toBeVisible()
    await page.getByRole("button", { name: "Initialize Module" }).click()

    await expect(page.getByText("PRO-01", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Welcome to Densify Pro" })).toBeVisible()
    await expect(page.getByText("Your clinical arsenal has been upgraded.")).toBeVisible()
    await expect(page.getByText(/01\s*\/\s*03/)).toBeVisible()
    // Centered panel (no spotlight target)
    const panel = page.locator("div.fixed.z-\\[10000\\]")
    await page.waitForTimeout(500) // let the animate-in transform settle
    const box = (await panel.boundingBox())!
    const vp = page.viewportSize()!
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(4)
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(4)

    await panel.getByRole("button", { name: "Next" }).click()
    // PRO-02 / PRO-03 targets never exist → straight to completion
    await expect(page.getByText("PRO-02")).toHaveCount(0)
    await expect(page.getByText("System Overview Complete")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Pro Features Unlocked" })).toBeVisible()
    await expect(page.getByText("You now have access to advanced clinical metrics and verified specialists.")).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("densify_hasSeenProTour"))).toBeNull()
    await page.getByRole("button", { name: "Enter Dashboard" }).click()
    await expect(page.getByText("Pro Features Unlocked")).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem("densify_hasSeenProTour"))).toBe("true")

    // Not shown again after reload
    await page.reload()
    await expectView(page, "overview")
    await page.waitForTimeout(1_500)
    await expect(page.getByText("PHASE 02")).toHaveCount(0)
  })
})

// ───────────────────────────── Error boundary ─────────────────────────────
// app/error.tsx cannot be triggered at runtime without modifying app code; verified statically.
test.skip("error boundary (app/error.tsx) — not triggerable without app changes", async () => {})
