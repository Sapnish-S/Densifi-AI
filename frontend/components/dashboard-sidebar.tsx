"use client"

import {
  LayoutDashboard,
  FlaskConical,
  FolderOpen,
  User,
  Crown,
  Lock,
  RotateCcw,
  Stethoscope,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ViewId = "overview" | "clinical" | "doctor" | "vault" | "agent" | "account" | "upgrade"

function AiStarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Capital A */}
      <path d="M5 20l5-13 5 13" />
      <path d="M7 15h6" />
      {/* Lowercase i stem */}
      <path d="M18 11v9" />
      {/* Sparkle/Star instead of dot on the 'i' */}
      <path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none" />
    </svg>
  )
}

const NAV_ITEMS: {
  id: ViewId
  label: string
  icon: React.ElementType
  proOnly?: boolean
}[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "clinical", label: "Clinical", icon: FlaskConical, proOnly: true },
    { id: "doctor", label: "Doctors", icon: Stethoscope, proOnly: true },
    { id: "vault", label: "Vault", icon: FolderOpen },
    { id: "agent", label: "AI Agent", icon: AiStarIcon },
  ]

const BOTTOM_ITEMS: { id: ViewId; label: string; icon: React.ElementType }[] = [
  { id: "account", label: "Account", icon: User },
]

interface DashboardSidebarProps {
  active: ViewId
  tier: "free" | "premium"
  onSelect: (id: ViewId) => void
  onReRunTour: () => void
}

function NavItem({
  item,
  isActive,
  tier,
  onSelect,
}: {
  item: (typeof NAV_ITEMS)[0]
  isActive: boolean
  tier: "free" | "premium"
  onSelect: (id: ViewId) => void
}) {
  const Icon = item.icon
  const locked = item.proOnly && tier === "free"

  return (
    <button
      data-tutorial-id={
        item.id === "agent" ? "tutorial-nav-agent" :
          item.id === "overview" ? "tutorial-nav-overview" :
            item.id === "clinical" ? "tutorial-nav-clinical" :
              item.id === "doctor" ? "tutorial-nav-doctor" :
                item.id === "vault" ? "tutorial-nav-vault" :
                  undefined
      }
      onClick={() => onSelect(item.id)}
      title={item.label}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-xs font-medium tracking-wide uppercase transition-all duration-200",
        isActive
          ? "bg-foreground/10 text-foreground border-l-2 border-foreground"
          : "text-sidebar-foreground/50 hover:bg-foreground/5 hover:text-sidebar-foreground border-l-2 border-transparent",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
      <span className="hidden lg:inline leading-tight text-left flex-1">{item.label}</span>
      {locked && (
        <Lock className="hidden lg:block h-3 w-3 shrink-0 text-muted-foreground/30 ml-auto" />
      )}
    </button>
  )
}

export function DashboardSidebar({ active, tier, onSelect, onReRunTour }: DashboardSidebarProps) {
  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:flex fixed left-0 top-20 bottom-0 w-16 lg:w-60 flex-col border-r border-border/60 bg-sidebar z-30">
        <nav className="flex flex-col gap-0.5 p-2 lg:p-3 flex-1 pt-4">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isActive={active === item.id}
              tier={tier}
              onSelect={onSelect}
            />
          ))}

          <div className="my-2 h-px bg-border/40 mx-3" />

          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                title={item.label}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-sm px-3 py-2 text-xs font-medium tracking-wide uppercase transition-all duration-200 border-l-2",
                  active === item.id
                    ? "bg-foreground/10 text-foreground border-foreground"
                    : "text-sidebar-foreground/50 hover:bg-foreground/5 hover:text-sidebar-foreground border-transparent",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active === item.id ? "text-foreground" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70")} />
                <span className="hidden lg:inline leading-tight text-left">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Go Pro promo (free tier only) */}
        {tier === "free" && (
          <div className="hidden lg:block p-3">
            <button
              onClick={() => onSelect("upgrade")}
              className="glass w-full rounded-sm p-3 text-left hover:bg-foreground/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="h-3.5 w-3.5 text-foreground/60" />
                <p className="text-[10px] font-semibold tracking-widest uppercase text-foreground/60">Upgrade to Pro</p>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Unlock unlimited AI, biomarker tracking, lab reports, and full analytics.
              </p>
              <p className="mt-2 text-[10px] font-semibold tracking-wider uppercase text-foreground/50 group-hover:text-foreground/80 transition-colors">
                Start free trial →
              </p>
            </button>
          </div>
        )}

        {/* System Instruction — re-run tour, always visible */}
        <div className="p-2 lg:p-3 pb-5">
          <button
            onClick={onReRunTour}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm border border-border/40 px-3 py-2.5 transition-all duration-200",
              "text-muted-foreground/60 hover:border-foreground/30 hover:text-foreground/80 hover:bg-foreground/5",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden lg:inline font-mono text-[9px] font-semibold tracking-[0.22em] uppercase">
              System Instruction
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-[100] border-t border-border/60 bg-sidebar/95 backdrop-blur-xl">
        <div className="grid grid-cols-5">
          {[...NAV_ITEMS, ...BOTTOM_ITEMS].slice(0, 5).map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[9px] font-semibold tracking-widest uppercase transition-colors",
                  isActive ? "text-foreground" : "text-sidebar-foreground/40",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-none">{item.label.split(" ")[0]}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
