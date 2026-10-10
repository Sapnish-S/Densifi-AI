"use client"

import { useState } from "react"
import {
  Crown,
  Check,
  Bot,
  FlaskConical,
  SlidersHorizontal,
  Camera,
  BarChart3,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { upgradeToPremium } from "@/app/actions/profile"
import { cn } from "@/lib/utils"

const FREE_FEATURES = [
  { icon: Camera, label: "Progress photo uploads" },
  { icon: Bot, label: "1 AI agent question per day" },
]

const PRO_FEATURES = [
  { icon: Bot, label: "Unlimited AI conversations" },
  { icon: BarChart3, label: "Full dashboard & analytics" },
  { icon: FlaskConical, label: "Biomarker & lab report tracking" },
  { icon: SlidersHorizontal, label: "Protocol & medication management" },
  { icon: Camera, label: "Unlimited photo vault" },
  { icon: Sparkles, label: "Priority AI analysis" },
]

interface UpgradeViewProps {
  tier: "free" | "premium"
  onUpgraded: () => void
}

export function UpgradeView({ tier, onUpgraded }: UpgradeViewProps) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      await upgradeToPremium()
      onUpgraded()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="glass rounded-sm p-6 text-center">
        <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3">Densify Clinical Platform</p>
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <Crown className="h-5 w-5 text-foreground/60" />
          <span className="text-xl font-semibold tracking-tight">Densify Pro</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          The complete clinical toolkit for your hair restoration journey. Track every biomarker,
          upload lab reports, and have unlimited conversations with your AI hair analysis agent.
        </p>
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Free */}
        <div className={cn(
          "rounded-sm border p-5 flex flex-col gap-4 transition-all",
          tier === "free" ? "border-border/60 bg-card" : "border-border/30 bg-card/40 opacity-60",
        )}>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Free</p>
            {tier === "free" && (
              <Badge variant="outline" className="text-[9px] border-border/60 text-muted-foreground tracking-widest uppercase rounded-sm">Current</Badge>
            )}
          </div>
          <div>
            <span className="text-3xl font-semibold font-mono tracking-tight">$0</span>
            <span className="text-xs text-muted-foreground"> / month</span>
          </div>
          <div className="h-px bg-border/40" />
          <ul className="space-y-2.5">
            {FREE_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className={cn(
          "rounded-sm border p-5 flex flex-col gap-4",
          tier === "premium"
            ? "border-foreground/30 bg-foreground/5"
            : "border-foreground/20 bg-foreground/5",
        )}>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-foreground/70">Pro</p>
            {tier === "premium" ? (
              <Badge className="text-[9px] bg-foreground/10 text-foreground border border-foreground/20 tracking-widest uppercase rounded-sm">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-foreground/20 text-foreground/60 tracking-widest uppercase rounded-sm">Recommended</Badge>
            )}
          </div>
          <div>
            <span className="text-3xl font-semibold font-mono tracking-tight">$19</span>
            <span className="text-xs text-muted-foreground"> / month</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">7-day free trial</p>
          </div>
          <div className="h-px bg-foreground/10" />
          <ul className="space-y-2.5">
            {PRO_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-xs">
                <Check className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
                {label}
              </li>
            ))}
          </ul>

          {tier === "free" && (
            <Button
              className="mt-auto w-full gap-2 h-9 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crown className="h-3.5 w-3.5" />
              )}
              Start 7-day free trial
            </Button>
          )}
          {tier === "premium" && (
            <p className="text-[10px] text-foreground/40 text-center mt-auto tracking-wide">
              You are on Densify Pro. All features are unlocked.
            </p>
          )}
        </div>
      </div>

      {/* Feature deep-dive */}
      <div className="glass rounded-sm p-5 space-y-4">
        <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Everything included in Pro</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              icon: Bot,
              title: "Unlimited AI Analysis",
              desc: "Ask your agent as many questions as you need, every day.",
            },
            {
              icon: FlaskConical,
              title: "Lab Report Uploads",
              desc: "Upload blood panels and track DHT, Testosterone, Ferritin, and Vitamin D over time.",
            },
            {
              icon: BarChart3,
              title: "Full Dashboard",
              desc: "Longitudinal outcome charts, miniaturization curves, and compliance tracking.",
            },
            {
              icon: SlidersHorizontal,
              title: "Protocol Management",
              desc: "Log every compound, dose, and cadence. Monitor adherence week over week.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3 p-3 rounded-sm bg-card/50 border border-border/40">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-foreground/8 border border-border/40">
                <Icon className="h-3.5 w-3.5 text-foreground/50" />
              </div>
              <div>
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tier === "free" && (
        <Button
          className="w-full gap-2 h-10 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
          Upgrade to Pro — $19/month
        </Button>
      )}
    </div>
  )
}
