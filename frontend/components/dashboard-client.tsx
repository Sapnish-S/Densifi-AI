"use client"

import { useRef, useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { OverviewPanel } from "@/components/overview-panel"
import { CorrelationChart } from "@/components/correlation-chart"
import { BiomarkerGrid } from "@/components/biomarker-grid"
import { RegimenPanel } from "@/components/regimen-panel"
import { VaultPanel } from "@/components/vault-panel"
import { ProGate } from "@/components/pro-gate"
import { AgentView } from "@/components/agent-view"
import { AccountView } from "@/components/account-view"
import { NotificationEngine } from "@/components/notification-engine"
import { CampaignTutorial, type CampaignTutorialHandle } from "@/components/campaign-tutorial"
import { DoctorPanel } from "@/components/doctor-panel"
import { UpgradeView } from "@/components/upgrade-view"
import type { AnalysisResult } from "@/app/actions/telemetry"

type ViewId = "overview" | "clinical" | "doctor" | "vault" | "agent" | "account" | "upgrade" | "notifications"

const VIEW_META: Record<ViewId, { title: string; subtitle: string }> = {
  overview: {
    title: "Dashboard Overview",
    subtitle: "Core metrics, daily check-in, and visual progression at a glance",
  },
  clinical: {
    title: "Clinical Analytics",
    subtitle: "Protocol & Regimen, Multi-Modal Biomarker Grid, and Treatment Outcome Correlation Engine",
  },
  doctor: {
    title: "Clinical Doctor Network",
    subtitle: "Connect, chat, and schedule appointments with local trichologists and hair restoration specialists",
  },
  vault: {
    title: "Progression Vault",
    subtitle: "Monthly photo archive — Front, Crown, and Side views organised into dated subfolders",
  },
  agent: {
    title: "AI Hair Analysis Agent",
    subtitle: "Visual comparison, regional density breakdown, and conversational follow-up",
  },
  account: {
    title: "Account Settings",
    subtitle: "Manage your profile, plan, and preferences",
  },
  upgrade: {
    title: "Upgrade to Pro",
    subtitle: "Unlock the full Densify clinical toolkit",
  },
  notifications: {
    title: "Notification Engine",
    subtitle: "Web push alerts, daily reminders, and retention settings — wired to your device",
  },
}

interface DashboardClientProps {
  user: { id: string; name: string; email: string }
  tier: "free" | "premium"
  gender?: "male" | "female"
  lastSeenAt?: string | null
  hasCompletedOnboarding: boolean
}

export function DashboardClient({ user, tier: initialTier, gender: initialGender = "male", lastSeenAt, hasCompletedOnboarding }: DashboardClientProps) {
  const [view, setView] = useState<ViewId>("overview")
  const [tier, setTier] = useState(initialTier)
  const [gender, setGender] = useState<"male" | "female">(initialGender)
  const [vaultCaptureOpen, setVaultCaptureOpen] = useState(false)
  const [forwardedReport, setForwardedReport] = useState<AnalysisResult | null>(null)
  
  // Track tour states locally
  const [hasSeenFreeTour, setHasSeenFreeTour] = useState(hasCompletedOnboarding)
  const [hasSeenProTour, setHasSeenProTour] = useState(false)

  const meta = VIEW_META[view] ?? VIEW_META["overview"]
  const tutorialRef = useRef<CampaignTutorialHandle>(null)

  const handleNavigate = (v: string) => setView(v as ViewId)

  // Initialize Pro tour state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("densify_hasSeenProTour") === "true") {
      setHasSeenProTour(true)
    }
  }, [])

  function handleTourComplete(tourType: "free" | "pro") {
    if (tourType === "free") {
      setHasSeenFreeTour(true)
      import("@/app/actions/notifications").then(m => m.markOnboardingComplete().catch(() => {}))
    } else {
      setHasSeenProTour(true)
      if (typeof window !== "undefined") {
        localStorage.setItem("densify_hasSeenProTour", "true")
      }
    }
  }


  function openCamera() {
    setView("vault")
    setVaultCaptureOpen(true)
  }

  function handleUpgrade() {
    setView("upgrade")
  }

  function handleUpgraded() {
    setTier("premium")
    setView("overview")
  }

  function handleForwardReport(report: AnalysisResult) {
    setForwardedReport(report)
    setView("doctor")
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden z-0">
      {/* Subtle Clinical Glow Backgrounds */}
      <div className="pointer-events-none fixed inset-0 z-[-1] flex items-center justify-center overflow-hidden">
        <div className="absolute top-[20%] left-[10%] h-[800px] w-[800px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.03)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-10%] right-[5%] h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.02)_0%,transparent_70%)] blur-3xl" />
      </div>

      <CampaignTutorial
        ref={tutorialRef}
        userTier={tier === "premium" ? "pro" : "free"}
        hasSeenFreeTour={hasSeenFreeTour}
        hasSeenProTour={hasSeenProTour}
        onTourComplete={handleTourComplete}
      />
      <DashboardHeader
        user={user}
        tier={tier}
        onNavigate={handleNavigate}
        onCamera={openCamera}
        lastSeenAt={lastSeenAt}
      />
      <DashboardSidebar
        active={view as any}
        tier={tier}
        onSelect={handleNavigate}
        onReRunTour={() => tutorialRef.current?.launch(tier === "premium" ? "pro" : "free")}
      />

      <main className="pt-20 pb-20 md:pb-6 md:pl-16 lg:pl-60">
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6">

          {/* Page heading */}
          <div className="mb-6 border-b border-border/60 pb-4">
            <p className="mb-1 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/90">
              Densify Clinical Platform
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">{meta.title}</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground text-pretty">{meta.subtitle}</p>
          </div>

          {/* OVERVIEW */}
          {view === "overview" && (
            <OverviewPanel onNavigate={handleNavigate} gender={gender} onGenderChange={setGender} />
          )}

          {/* CLINICAL — Protocol + Biomarkers + Correlation Engine, all gated */}
          {view === "clinical" && (
            <ProGate tier={tier} feature="Clinical Analytics" onUpgrade={handleUpgrade}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <RegimenPanel />
                  <BiomarkerGrid />
                </div>
                <CorrelationChart />
              </div>
            </ProGate>
          )}

          {/* DOCTOR NETWORK — Gated */}
          {view === "doctor" && (
            <ProGate tier={tier} feature="Doctor Network" onUpgrade={handleUpgrade}>
              <DoctorPanel report={forwardedReport} />
            </ProGate>
          )}

          {/* VAULT */}
          {view === "vault" && (
            <VaultPanel
              captureOpen={vaultCaptureOpen}
              onCaptureOpenChange={setVaultCaptureOpen}
              gender={gender}
            />
          )}

          {/* AGENT */}
          {view === "agent" && (
            <AgentView 
              user={user} 
              tier={tier} 
              gender={gender}
              onGenderChange={setGender}
              onUpgrade={handleUpgrade} 
              onForwardReport={handleForwardReport} 
            />
          )}

          {/* ACCOUNT */}
          {view === "account" && (
            <AccountView 
              user={user} 
              tier={tier} 
              gender={gender}
              onGenderChange={setGender}
              onUpgrade={handleUpgrade} 
            />
          )}

          {/* UPGRADE */}
          {view === "upgrade" && (
            <UpgradeView tier={tier} onUpgraded={handleUpgraded} />
          )}

          {/* NOTIFICATIONS */}
          {view === "notifications" && (
            <NotificationEngine tier={tier} />
          )}

        </div>
      </main>
    </div>
  )
}
