"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Crown, LogOut, Pencil, Check, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { updateProfile } from "@/app/actions/profile"
import { cn } from "@/lib/utils"

interface AccountViewProps {
  user: { name: string; email: string }
  tier: "free" | "premium"
  onUpgrade: () => void
}

export function AccountView({ user, tier, onUpgrade }: AccountViewProps) {
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name)
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSaveName() {
    setSavingName(true)
    try {
      await updateProfile({ displayName: name })
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Profile card */}
      <div className="glass rounded-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border/40">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-border/60 bg-card text-foreground font-semibold text-base">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{user.email}</p>
          </div>
          <span className={cn(
            "text-[9px] font-semibold tracking-[0.18em] uppercase px-2 py-1 rounded-sm border",
            tier === "premium"
              ? "border-foreground/20 bg-foreground/8 text-foreground/70"
              : "border-border/60 bg-card text-muted-foreground",
          )}>
            {tier === "premium" ? "Pro" : "Free"}
          </span>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Display name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              <User className="h-3 w-3" /> Display name
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/60 h-9 rounded-sm border-border/60 text-sm"
                  autoFocus
                />
                <Button size="icon" className="h-9 w-9 rounded-sm bg-foreground text-background hover:bg-foreground/90 shrink-0" onClick={handleSaveName} disabled={savingName}>
                  {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between h-9 rounded-sm border border-border/40 bg-card/60 px-3 text-sm">
                <span>{name}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                  aria-label="Edit name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Email address</label>
            <div className="flex h-9 items-center rounded-sm border border-border/30 bg-muted/40 px-3 text-sm text-muted-foreground">
              {user.email}
            </div>
          </div>
        </div>
      </div>

      {/* Plan card */}
      <div className="glass rounded-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/40">
          <Crown className="h-3.5 w-3.5 text-foreground/40" />
          <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Subscription plan</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className={cn(
            "rounded-sm border p-4 flex items-start gap-4",
            tier === "premium" ? "border-foreground/20 bg-foreground/5" : "border-border/40 bg-card/40",
          )}>
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border",
              tier === "premium" ? "bg-foreground/10 border-foreground/20" : "bg-muted/40 border-border/40",
            )}>
              {tier === "premium"
                ? <ShieldCheck className="h-4 w-4 text-foreground/60" />
                : <User className="h-4 w-4 text-muted-foreground/60" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {tier === "premium" ? "Densify Pro" : "Densify Free"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {tier === "premium"
                  ? "Unlimited AI conversations, lab uploads, biomarker tracking, and full protocol analytics."
                  : "1 AI question per day, photo uploads. Upgrade for unlimited access."}
              </p>
            </div>
          </div>

          {tier === "free" && (
            <Button
              className="w-full gap-2 h-9 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
              onClick={onUpgrade}
            >
              <Crown className="h-3.5 w-3.5" />
              Upgrade to Pro — $19/mo
            </Button>
          )}

          {tier === "premium" && (
            <p className="text-[10px] text-muted-foreground text-center tracking-wide">
              Your Pro subscription is active. Manage billing through the account settings.
            </p>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div className="glass rounded-sm p-4">
        <Button
          variant="outline"
          className="w-full gap-2 text-xs font-semibold tracking-widest uppercase h-9 rounded-sm border-border/40 text-muted-foreground hover:border-destructive/50 hover:text-destructive hover:bg-destructive/8 transition-all duration-200"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Sign out
        </Button>
      </div>
    </div>
  )
}
