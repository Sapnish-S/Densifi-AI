import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getProfile } from "@/app/actions/profile"
import { getNotificationPrefs, touchLastSeen } from "@/app/actions/notifications"
import { DashboardClient } from "@/components/dashboard-client"

// Vercel: server actions invoked from this page (lab-report OCR, AI chat) can run
// 20–60 s while the model responds. Ignored outside Vercel.
export const maxDuration = 60

export default async function DensifyPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/landing")

  // A failed profile/prefs query must not take down the whole dashboard — log the real
  // error (visible in server logs) and render with safe defaults.
  const [profile, notifPrefs] = await Promise.all([
    getProfile().catch((err) => {
      console.error("[dashboard] getProfile failed:", err)
      return { tier: "free" as const, gender: "male" as const }
    }),
    getNotificationPrefs().catch((err) => {
      console.error("[dashboard] getNotificationPrefs failed:", err)
      return { lastSeenAt: null, hasCompletedOnboarding: true }
    }),
  ])

  // Update last_seen_at in the background — non-blocking
  touchLastSeen().catch(() => {})

  return (
    <DashboardClient
      user={{ id: session.user.id, name: session.user.name, email: session.user.email }}
      tier={profile.tier}
      gender={profile.gender}
      lastSeenAt={notifPrefs.lastSeenAt}
      hasCompletedOnboarding={notifPrefs.hasCompletedOnboarding}
    />
  )
}
