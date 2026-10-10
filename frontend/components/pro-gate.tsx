"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProGateProps {
  children: React.ReactNode
  tier: "free" | "premium"
  feature?: string
  onUpgrade: () => void
}

export function ProGate({ children, tier, feature = "this feature", onUpgrade }: ProGateProps) {
  if (tier === "premium") return <>{children}</>

  return (
    <div className="relative overflow-hidden rounded-sm">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none" aria-hidden="true">
        <div className="blur-[3px] opacity-30 saturate-0">{children}</div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-5 text-center px-8 py-6">
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-border/60 bg-card/80">
            <Lock className="h-5 w-5 text-foreground/60" />
          </div>
          {/* Copy */}
          <div>
            <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-1.5">Pro Feature</p>
            <p className="text-base font-semibold tracking-tight text-balance">Unlock {feature}</p>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed text-pretty">
              Upgrade to Densify Pro for the full clinical analytics suite, unlimited AI, and complete biomarker tracking.
            </p>
          </div>
          {/* CTA */}
          <Button
            onClick={onUpgrade}
            className="mt-1 h-9 px-6 text-xs font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
          >
            Upgrade to Pro
          </Button>
        </div>
      </div>
    </div>
  )
}
