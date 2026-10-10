"use server"

import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// ─── Notification Preferences ────────────────────────────────────────────────

export interface NotificationPrefs {
  pushEnabled: boolean
  pushEndpoint: string | null
  pushP256dh: string | null
  pushAuth: string | null
  // Per-notification-type toggles
  dailyMedication: boolean   // PRO only
  dailyPhoto: boolean        // FREE + PRO
  proUpsell: boolean         // FREE only
  inactivityRetention: boolean
  lastSeenAt: string | null
  hasCompletedOnboarding: boolean
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const userId = await getUserId()
  const res = await query(
    `SELECT
       push_enabled              AS "pushEnabled",
       push_endpoint             AS "pushEndpoint",
       push_p256dh               AS "pushP256dh",
       push_auth                 AS "pushAuth",
       daily_medication          AS "dailyMedication",
       daily_photo               AS "dailyPhoto",
       pro_upsell                AS "proUpsell",
       inactivity_retention      AS "inactivityRetention",
       last_seen_at              AS "lastSeenAt",
       has_completed_onboarding  AS "hasCompletedOnboarding"
     FROM notification_prefs
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  )
  if (res.rows.length === 0) {
    return {
      pushEnabled: false,
      pushEndpoint: null,
      pushP256dh: null,
      pushAuth: null,
      dailyMedication: true,
      dailyPhoto: true,
      proUpsell: true,
      inactivityRetention: true,
      lastSeenAt: null,
      hasCompletedOnboarding: false,
    }
  }
  const row = res.rows[0] as NotificationPrefs
  // Treat NULL as false for the onboarding flag (nullable column)
  return { ...row, hasCompletedOnboarding: row.hasCompletedOnboarding ?? false }
}

export async function saveNotificationPrefs(
  prefs: Partial<Omit<NotificationPrefs, "lastSeenAt">>,
): Promise<void> {
  const userId = await getUserId()
  const existing = await query(
    `SELECT id FROM notification_prefs WHERE user_id = $1 LIMIT 1`,
    [userId],
  )

  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO notification_prefs
         (id, user_id, push_enabled, push_endpoint, push_p256dh, push_auth,
          daily_medication, daily_photo, pro_upsell, inactivity_retention)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        randomUUID(),
        userId,
        prefs.pushEnabled ?? false,
        prefs.pushEndpoint ?? null,
        prefs.pushP256dh ?? null,
        prefs.pushAuth ?? null,
        prefs.dailyMedication ?? true,
        prefs.dailyPhoto ?? true,
        prefs.proUpsell ?? true,
        prefs.inactivityRetention ?? true,
      ],
    )
  } else {
    await query(
      `UPDATE notification_prefs SET
         push_enabled         = COALESCE($1, push_enabled),
         push_endpoint        = COALESCE($2, push_endpoint),
         push_p256dh          = COALESCE($3, push_p256dh),
         push_auth            = COALESCE($4, push_auth),
         daily_medication     = COALESCE($5, daily_medication),
         daily_photo          = COALESCE($6, daily_photo),
         pro_upsell           = COALESCE($7, pro_upsell),
         inactivity_retention = COALESCE($8, inactivity_retention),
         updated_at           = now()
       WHERE user_id = $9`,
      [
        prefs.pushEnabled ?? null,
        prefs.pushEndpoint ?? null,
        prefs.pushP256dh ?? null,
        prefs.pushAuth ?? null,
        prefs.dailyMedication ?? null,
        prefs.dailyPhoto ?? null,
        prefs.proUpsell ?? null,
        prefs.inactivityRetention ?? null,
        userId,
      ],
    )
  }
  revalidatePath("/")
}

export async function touchLastSeen(): Promise<void> {
  const userId = await getUserId()
  await query(
    `UPDATE notification_prefs SET last_seen_at = now() WHERE user_id = $1`,
    [userId],
  )
}

export async function markOnboardingComplete(): Promise<void> {
  const userId = await getUserId()
  // Upsert so it works even if no prefs row exists yet
  const existing = await query(
    `SELECT id FROM notification_prefs WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  if (existing.rows.length === 0) {
    const { randomUUID } = await import("crypto")
    await query(
      `INSERT INTO notification_prefs
         (id, user_id, has_completed_onboarding, push_enabled,
          daily_medication, daily_photo, pro_upsell, inactivity_retention)
       VALUES ($1, $2, true, false, true, true, true, true)`,
      [randomUUID(), userId],
    )
  } else {
    await query(
      `UPDATE notification_prefs SET has_completed_onboarding = true WHERE user_id = $1`,
      [userId],
    )
  }
  revalidatePath("/")
}

// ─── Retention / Medication Check-In ─────────────────────────────────────────

export interface RetentionCheckIn {
  medicationAdherent: boolean | null
  restartDate: string | null
  plannedStartDate: string | null
  updatedAt: string | null
}

export async function getRetentionCheckIn(): Promise<RetentionCheckIn> {
  const userId = await getUserId()
  const res = await query(
    `SELECT
       medication_adherent   AS "medicationAdherent",
       restart_date          AS "restartDate",
       planned_start_date    AS "plannedStartDate",
       updated_at            AS "updatedAt"
     FROM retention_check_in
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  )
  if (res.rows.length === 0) return { medicationAdherent: null, restartDate: null, plannedStartDate: null, updatedAt: null }
  return res.rows[0] as RetentionCheckIn
}

export async function saveRetentionCheckIn(data: {
  medicationAdherent: boolean
  restartDate?: string | null
  plannedStartDate?: string | null
}): Promise<void> {
  const userId = await getUserId()
  const existing = await query(
    `SELECT id FROM retention_check_in WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO retention_check_in (id, user_id, medication_adherent, restart_date, planned_start_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), userId, data.medicationAdherent, data.restartDate ?? null, data.plannedStartDate ?? null],
    )
  } else {
    await query(
      `UPDATE retention_check_in SET
         medication_adherent  = $1,
         restart_date         = COALESCE($2, restart_date),
         planned_start_date   = COALESCE($3, planned_start_date),
         updated_at           = now()
       WHERE user_id = $4`,
      [data.medicationAdherent, data.restartDate ?? null, data.plannedStartDate ?? null, userId],
    )
  }
  revalidatePath("/")
}
