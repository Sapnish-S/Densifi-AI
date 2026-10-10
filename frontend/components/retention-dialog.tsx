"use client"

import { useState, useTransition } from "react"
import { Pill, CalendarDays, RotateCcw, Check, ChevronRight, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { saveRetentionCheckIn } from "@/app/actions/notifications"

type DialogStep =
  | "question"       // "Are you taking your medications regularly?"
  | "path-select"    // "When are you planning..." vs "I missed a few days..."
  | "planned-date"   // custom date picker for planned start
  | "restart-date"   // custom date picker for restart date
  | "done"           // confirmation state

interface RetentionDialogProps {
  open: boolean
  onClose: () => void
}

function DatePickerInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-10 rounded-sm border border-border/50 bg-card/60 px-3 text-sm",
          "text-foreground placeholder:text-muted-foreground/40",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          // Force dark calendar picker on chromium
          "[color-scheme:dark]",
        )}
      />
    </div>
  )
}

function PathCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-start gap-4 rounded-sm border border-border/40 bg-card/40 px-4 py-4 text-left",
        "hover:border-foreground/30 hover:bg-foreground/5 transition-all duration-200",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border/40 bg-background/60 mt-0.5 group-hover:border-foreground/30 transition-colors">
        <Icon className="h-3.5 w-3.5 text-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight mb-0.5">{title}</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 mt-1 group-hover:text-foreground/40 transition-colors" />
    </button>
  )
}

export function RetentionDialog({ open, onClose }: RetentionDialogProps) {
  const [step, setStep] = useState<DialogStep>("question")
  const [selectedDate, setSelectedDate] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleYes() {
    startTransition(async () => {
      await saveRetentionCheckIn({ medicationAdherent: true })
      setStep("done")
    })
  }

  function handleNo() {
    setStep("path-select")
  }

  function handlePlannedPath() {
    setStep("planned-date")
  }

  function handleRestartPath() {
    setStep("restart-date")
  }

  function handleSubmitPlanned() {
    if (!selectedDate) return
    startTransition(async () => {
      await saveRetentionCheckIn({ medicationAdherent: false, plannedStartDate: selectedDate })
      setStep("done")
    })
  }

  function handleSubmitRestart() {
    if (!selectedDate) return
    startTransition(async () => {
      await saveRetentionCheckIn({ medicationAdherent: false, restartDate: selectedDate })
      setStep("done")
    })
  }

  function handleClose() {
    // Reset state for next open
    setTimeout(() => {
      setStep("question")
      setSelectedDate("")
    }, 300)
    onClose()
  }

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retention-dialog-title"
    >
      {/* Blurred overlay */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-md"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md overflow-hidden rounded-sm",
          "glass",
          // Entrance animation via tw-animate-css
          "animate-in fade-in slide-in-from-bottom-4 duration-300",
        )}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Densify — Wellness Check
          </p>
          <button
            onClick={handleClose}
            className="flex h-6 w-6 items-center justify-center rounded-sm border border-border/40 text-muted-foreground/50 hover:border-foreground/30 hover:text-foreground transition-all"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content — animated between steps */}
        <div className="px-5 py-6 space-y-5">

          {/* ── STEP: QUESTION ─────────────────────────────────────────── */}
          {step === "question" && (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border/40 bg-card/60">
                  <Pill className="h-4.5 w-4.5 text-foreground/50" />
                </div>
                <div>
                  <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                    Medication Adherence
                  </p>
                  <h2
                    id="retention-dialog-title"
                    className="text-base font-semibold tracking-tight text-balance leading-snug"
                  >
                    Are you taking your medications regularly?
                  </h2>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Consistent treatment adherence is the single largest predictor of outcome. Your answer helps us personalise your tracking.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                {/* YES */}
                <button
                  onClick={handleYes}
                  disabled={isPending}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-10 rounded-sm text-[11px] font-semibold tracking-widest uppercase transition-all duration-200",
                    "bg-foreground text-background hover:bg-foreground/90",
                    "disabled:opacity-40",
                  )}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Yes
                </button>
                {/* NO */}
                <button
                  onClick={handleNo}
                  disabled={isPending}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-10 rounded-sm text-[11px] font-semibold tracking-widest uppercase transition-all duration-200",
                    "border border-border/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    "disabled:opacity-40",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                  No
                </button>
              </div>
            </>
          )}

          {/* ── STEP: PATH SELECT ──────────────────────────────────────── */}
          {step === "path-select" && (
            <>
              <div>
                <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                  No Worries — Let&apos;s Adjust
                </p>
                <h2 className="text-base font-semibold tracking-tight text-balance leading-snug">
                  What best describes your situation?
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  We will update your tracking and reminders accordingly.
                </p>
              </div>

              <div className="space-y-2.5">
                <PathCard
                  icon={CalendarDays}
                  title="When are you planning to start taking it?"
                  description="Set a planned start date so we can prepare your protocol and send a timely reminder."
                  onClick={handlePlannedPath}
                />
                <PathCard
                  icon={RotateCcw}
                  title="I missed a few days and started again"
                  description="Log the exact restart date to keep your timeline accurate and adherence score up to date."
                  onClick={handleRestartPath}
                />
              </div>
            </>
          )}

          {/* ── STEP: PLANNED DATE ────────────────────────────────────── */}
          {step === "planned-date" && (
            <>
              <div>
                <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                  Planned Start Date
                </p>
                <h2 className="text-base font-semibold tracking-tight text-balance leading-snug">
                  When are you planning to start taking it?
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  We will send you a push reminder the morning of your chosen date.
                </p>
              </div>

              <DatePickerInput
                label="Planned start date"
                value={selectedDate}
                onChange={setSelectedDate}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("path-select")}
                  className="h-9 px-4 rounded-sm border border-border/40 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all duration-200"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitPlanned}
                  disabled={!selectedDate || isPending}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-sm bg-foreground text-background text-[11px] font-semibold tracking-widest uppercase hover:bg-foreground/90 disabled:opacity-40 transition-all duration-200"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirm Date
                </button>
              </div>
            </>
          )}

          {/* ── STEP: RESTART DATE ───────────────────────────────────── */}
          {step === "restart-date" && (
            <>
              <div>
                <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                  Restart Date
                </p>
                <h2 className="text-base font-semibold tracking-tight text-balance leading-snug">
                  When did you start taking it again?
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Logging the restart date accurately corrects your adherence score and keeps your correlation data meaningful.
                </p>
              </div>

              <DatePickerInput
                label="Restart date"
                value={selectedDate}
                onChange={setSelectedDate}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("path-select")}
                  className="h-9 px-4 rounded-sm border border-border/40 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all duration-200"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitRestart}
                  disabled={!selectedDate || isPending}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-sm bg-foreground text-background text-[11px] font-semibold tracking-widest uppercase hover:bg-foreground/90 disabled:opacity-40 transition-all duration-200"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Log Restart
                </button>
              </div>
            </>
          )}

          {/* ── STEP: DONE ───────────────────────────────────────────── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-foreground/20 bg-foreground/8">
                <Check className="h-5 w-5 text-foreground/70" />
              </div>
              <div>
                <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-1.5">
                  Saved
                </p>
                <p className="text-base font-semibold tracking-tight">Thanks for checking in</p>
                <p className="mt-1.5 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Your response has been recorded. We have updated your adherence timeline and adjusted your reminders accordingly.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-1 h-9 px-6 rounded-sm bg-foreground text-background text-[11px] font-semibold tracking-widest uppercase hover:bg-foreground/90 transition-all duration-200"
              >
                Continue
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
