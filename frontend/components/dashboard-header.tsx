"use client"

import { useEffect, useState } from "react"
import { Bell, Camera, Crown, Moon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RetentionDialog } from "@/components/retention-dialog"
import { useTheme } from "@/components/theme-provider"
import { DensifyLogomark } from "@/components/densify-logomark"
import { cn } from "@/lib/utils"

type ViewId = "account" | "upgrade" | "overview" | "agent" | "clinical" | "vault" | "notifications"

interface DashboardHeaderProps {
  user: { name: string; email: string }
  tier: "free" | "premium"
  onNavigate: (view: ViewId) => void
  onCamera: () => void
  /** ISO string of last_seen_at from DB — used to detect inactive users */
  lastSeenAt?: string | null
}

export function DashboardHeader({ user, tier, onNavigate, onCamera, lastSeenAt }: DashboardHeaderProps) {
  const [retentionOpen, setRetentionOpen] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  // Auto-open retention dialog if user has been inactive for >= 7 days
  useEffect(() => {
    if (!lastSeenAt) return
    const daysSince = (Date.now() - new Date(lastSeenAt).getTime()) / 1000 / 60 / 60 / 24
    if (daysSince >= 7) {
      // Small delay so dashboard has time to render first
      const t = setTimeout(() => setRetentionOpen(true), 1200)
      return () => clearTimeout(t)
    }
  }, [lastSeenAt])

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
          {/* Brand — clickable, navigates to overview */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate("overview")}
              className="flex items-center focus-visible:outline-none"
              aria-label="Go to overview"
            >
              <DensifyLogomark variant="navbar" height={52} />
            </button>
            {tier === "premium" && (
              <>
                {/* Mobile: crown icon only */}
                <span className="flex sm:hidden items-center justify-center rounded-sm border border-foreground/20 bg-foreground/8 p-1 text-foreground/70">
                  <Crown className="h-3 w-3" />
                </span>
                {/* Desktop: crown + "Pro" text */}
                <span className="hidden sm:inline-flex items-center gap-1 rounded-sm border border-foreground/20 bg-foreground/8 px-1.5 py-0.5 text-[9px] font-semibold tracking-widest uppercase text-foreground/70 self-center mt-[10px]">
                  <Crown className="h-2.5 w-2.5" />
                  Pro
                </span>
              </>
            )}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            {tier === "free" && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[11px] tracking-wide uppercase hidden sm:flex bg-foreground text-background hover:bg-foreground/90 rounded-sm px-3 font-semibold transition-all duration-200"
                onClick={() => onNavigate("upgrade")}
              >
                <Crown className="h-3 w-3" />
                Upgrade
              </Button>
            )}

            {/* Camera shortcut — opens Direct Capture from anywhere */}
            <button
              onClick={onCamera}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-card transition-all duration-200",
                "text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-accent",
              )}
              aria-label="Open camera capture"
            >
              <Camera className="h-4 w-4" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-card transition-all duration-200",
                "text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-accent",
              )}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark"
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />
              }
            </button>

            {/* Notification bell */}
            <button
              data-tutorial-id="tutorial-notifications"
              onClick={() => onNavigate("notifications")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-card transition-all duration-200",
                "text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-accent",
              )}
              aria-label="Notification settings"
            >
              <Bell className="h-4 w-4" />
            </button>

            {/* Avatar */}
            <button
              data-tutorial-id="tutorial-account"
              onClick={() => onNavigate("account")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-card text-[10px] font-semibold tracking-wider uppercase transition-all duration-200",
                "text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-accent",
              )}
              aria-label="Account settings"
              title={user.name}
            >
              {initials || <User className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <RetentionDialog
        open={retentionOpen}
        onClose={() => setRetentionOpen(false)}
      />
    </>
  )
}
