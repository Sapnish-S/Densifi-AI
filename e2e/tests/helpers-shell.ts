import type { Page } from "@playwright/test"
import { sql } from "./helpers"

/** Force the profile tier directly in the DB (bypasses helpers.createUser's pro-tour localStorage init script). */
export async function setTier(userId: string, tier: "free" | "premium") {
  await sql(
    `INSERT INTO profile (id, "userId", tier) VALUES (gen_random_uuid()::text, $1, $2)
     ON CONFLICT ("userId") DO UPDATE SET tier = EXCLUDED.tier`,
    [userId, tier],
  )
}

export async function notifPrefs(userId: string) {
  const [row] = await sql(`SELECT * FROM notification_prefs WHERE user_id = $1`, [userId])
  return row as Record<string, any> | undefined
}

export async function retentionRow(userId: string) {
  const [row] = await sql(`SELECT * FROM retention_check_in WHERE user_id = $1`, [userId])
  return row as Record<string, any> | undefined
}

export async function profileRow(userId: string) {
  const [row] = await sql(`SELECT * FROM profile WHERE "userId" = $1`, [userId])
  return row as Record<string, any> | undefined
}

/** Sidebar (desktop rail) navigation button by its title attribute (works at md where labels are hidden). */
export function sidebarItem(page: Page, title: string) {
  return page.locator(`aside button[title="${title}"]`)
}

export const VALID_SUBSCRIPTION = {
  endpoint: "https://push.example.test/send/abc123",
  keys: { p256dh: "BPfake-p256dh-key", auth: "fake-auth-secret" },
}

/**
 * Headless Chromium always reports Notification.permission === "denied" (even when the context
 * grants "notifications" — requestPermission() resolves "granted" though). Shim the getter so the
 * NotificationEngine sees a realistic browser state. Test-environment shim only; no app change.
 */
export async function stubNotificationPermission(page: Page, value: "default" | "granted" | "denied") {
  await page.addInitScript((v) => {
    Object.defineProperty(Notification, "permission", { configurable: true, get: () => v })
  }, value)
}
