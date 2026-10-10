"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error details for observability without leaking them to the UI
    console.error("[dashboard] render error:", error.message, "digest:", error.digest)
  }, [error])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="glass rounded-sm border border-destructive/20 bg-card/60 backdrop-blur-xl p-8 max-w-md w-full text-center space-y-5">
        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive/70" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Densify Clinical Platform
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Unable to Load Dashboard
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
            A panel failed to render. Your data is safe — this is a temporary
            rendering issue. Try refreshing the page.
          </p>
        </div>

        {/* Digest (dev only) */}
        {error.digest && (
          <div className="rounded-sm border border-border/40 bg-secondary/20 px-3 py-2">
            <p className="font-mono text-[10px] text-muted-foreground/60 tracking-widest">
              ref: {error.digest}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={reset}
            className="h-9 gap-2 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/")}
            className="h-9 text-[11px] font-semibold tracking-widest uppercase rounded-sm border-border/50 text-muted-foreground hover:text-foreground"
          >
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  )
}
