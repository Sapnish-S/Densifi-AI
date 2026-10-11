"use client"

import { useEffect, useState, useTransition } from "react"
import { SITE_ASSETS_BASE } from "@/lib/site-assets"
import {
  Bell,
  BellOff,
  BellRing,
  Camera,
  Crown,
  Pill,
  ShieldAlert,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { saveNotificationPrefs, getNotificationPrefs } from "@/app/actions/notifications"
import type { NotificationPrefs } from "@/app/actions/notifications"

interface NotificationEngineProps {
  tier: "free" | "premium"
}

// Human-readable definitions for each notification type shown in the UI
const NOTIFICATION_DEFS = [
  {
    key: "dailyMedication" as keyof NotificationPrefs,
    icon: Pill,
    label: "Daily Medication Reminder",
    description: "\"Did you take your medication today?\" — sent each morning at 9 AM.",
    proOnly: true,
    freeLabel: "Pro only",
  },
  {
    key: "dailyPhoto" as keyof NotificationPrefs,
    icon: Camera,
    label: "Daily Photo Check-In",
    description: "\"Did you upload your picture today?\" — sent each evening at 7 PM.",
    proOnly: false,
    freeLabel: null,
  },
  {
    key: "proUpsell" as keyof NotificationPrefs,
    icon: Crown,
    label: "Unlock Pro Features",
    description: "Timely reminders about Pro features you are missing — sent weekly.",
    proOnly: false,
    freeLabel: "Free tier only",
    hideForPro: true,
  },
  {
    key: "inactivityRetention" as keyof NotificationPrefs,
    icon: ShieldAlert,
    label: "Inactivity Re-Engagement",
    description: "\"You have stopped tracking your hair growth, we would love to help you get back on track.\" — triggered after 7 days of no activity.",
    proOnly: false,
    freeLabel: null,
  },
]

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-foreground" : "bg-border",
        disabled && "cursor-not-allowed opacity-30",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  )
}

export function NotificationEngine({ tier }: NotificationEngineProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [pushStatus, setPushStatus] = useState<"unknown" | "granted" | "denied" | "unsupported">("unknown")
  const [subscribing, setSubscribing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // Load prefs on mount
  useEffect(() => {
    getNotificationPrefs().then(setPrefs)
    if (!("Notification" in window)) {
      setPushStatus("unsupported")
    } else {
      setPushStatus(Notification.permission as "granted" | "denied" | "unknown")
    }
  }, [])

  async function requestPushPermission() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      setPushStatus(permission as "granted" | "denied")
      if (permission !== "granted") return

      const reg = await navigator.serviceWorker.register(`/sw.js?assets=${encodeURIComponent(SITE_ASSETS_BASE)}`)
      await navigator.serviceWorker.ready

      // Subscribe — VAPID public key would come from env in production.
      // For now we store the subscription endpoint in PostgreSQL via the API.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // In production, replace with real VAPID public key from env
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
            "<WELL_KNOWN_PUBLIC_DEMO_VAPID_KEY>",
        ),
      })

      await fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })

      setPrefs((p) => p ? { ...p, pushEnabled: true } : p)
    } finally {
      setSubscribing(false)
    }
  }

  async function disablePush() {
    setSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js")
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        await sub?.unsubscribe()
      }
      await fetch("/api/push-subscribe", { method: "DELETE" })
      setPrefs((p) => p ? { ...p, pushEnabled: false } : p)
    } finally {
      setSubscribing(false)
    }
  }

  function handleToggle(key: keyof NotificationPrefs, value: boolean) {
    setPrefs((p) => p ? { ...p, [key]: value } : p)
    startTransition(async () => {
      await saveNotificationPrefs({ [key]: value })
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 1600)
    })
  }

  if (!prefs) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pushActive = prefs.pushEnabled && pushStatus === "granted"

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Push permission card */}
      <div className="glass rounded-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/40 px-5 py-3.5">
          {pushActive ? (
            <BellRing className="h-3.5 w-3.5 text-foreground/60" />
          ) : (
            <BellOff className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Web Push Notifications
          </p>
          {pushStatus === "granted" && prefs.pushEnabled && (
            <span className="ml-auto text-[9px] font-semibold tracking-widest uppercase border border-foreground/20 bg-foreground/8 text-foreground/60 px-2 py-0.5 rounded-sm">
              Active
            </span>
          )}
          {pushStatus === "denied" && (
            <span className="ml-auto text-[9px] font-semibold tracking-widest uppercase border border-destructive/30 bg-destructive/8 text-destructive/70 px-2 py-0.5 rounded-sm">
              Blocked
            </span>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Allow Densify to send native push notifications directly to your phone&apos;s lock screen —
            no email required. Used for medication reminders, photo check-ins, and re-engagement alerts.
          </p>

          {pushStatus === "unsupported" && (
            <p className="text-xs text-destructive/70 border border-destructive/20 bg-destructive/8 rounded-sm px-3 py-2">
              Push notifications are not supported in this browser.
            </p>
          )}

          {pushStatus === "denied" && (
            <p className="text-xs text-destructive/70 border border-destructive/20 bg-destructive/8 rounded-sm px-3 py-2">
              Notifications are blocked in your browser settings. Please enable them in your browser permissions and reload the page.
            </p>
          )}

          {pushStatus !== "unsupported" && pushStatus !== "denied" && (
            <button
              onClick={pushActive ? disablePush : requestPushPermission}
              disabled={subscribing}
              className={cn(
                "flex items-center gap-2 rounded-sm px-4 py-2 text-[11px] font-semibold tracking-widest uppercase transition-all duration-200",
                pushActive
                  ? "border border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {subscribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : pushActive ? (
                <BellOff className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              {pushActive ? "Disable Push Notifications" : "Enable Push Notifications"}
            </button>
          )}
        </div>
      </div>

      {/* Notification type toggles */}
      <div className="glass rounded-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/40 px-5 py-3.5">
          <Bell className="h-3.5 w-3.5 text-foreground/60" />
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Notification Types
          </p>
        </div>

        <div className="divide-y divide-border/30">
          {NOTIFICATION_DEFS.filter((d) => !(d.hideForPro && tier === "premium")).map((def) => {
            const Icon = def.icon
            const isLocked = def.proOnly && tier === "free"
            const currentValue = prefs[def.key] as boolean
            const isSaved = savedKey === def.key

            return (
              <div key={def.key} className="flex items-start gap-4 px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border/40 bg-card/60 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold">{def.label}</p>
                    {def.proOnly && tier === "free" && (
                      <span className="text-[8px] font-semibold tracking-widest uppercase border border-foreground/20 bg-foreground/5 text-foreground/40 px-1.5 py-0.5 rounded-sm">
                        Pro
                      </span>
                    )}
                    {def.freeLabel && !def.proOnly && tier === "premium" && (
                      <span className="text-[8px] font-semibold tracking-widest uppercase border border-border/40 text-muted-foreground/50 px-1.5 py-0.5 rounded-sm">
                        {def.freeLabel}
                      </span>
                    )}
                    {isSaved && (
                      <span className="flex items-center gap-1 text-[9px] text-foreground/40 ml-auto">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pr-4">
                    {def.description}
                  </p>
                  {isLocked && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                      <Crown className="h-3 w-3" />
                      <span>Upgrade to Pro to enable this reminder</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  <Toggle
                    checked={currentValue}
                    onChange={(v) => handleToggle(def.key, v)}
                    disabled={isLocked || !pushActive}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {!pushActive && (
          <div className="border-t border-border/30 px-5 py-3 flex items-center gap-2">
            <BellOff className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Enable push notifications above to activate these toggles.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}

// Utility: convert VAPID base64 key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
