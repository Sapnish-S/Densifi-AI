"use client"

import { useEffect, useState, useCallback } from "react"
import {
  TrendingDown,
  Target,
  ShieldCheck,
  Info,
  X,
  Check,
  Camera,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProgressionVaultCard } from "@/components/progression-vault"
import { cn } from "@/lib/utils"
import { getTelemetry, submitCheckin, getActiveMedications, type Telemetry, type MedicationRow } from "@/app/actions/telemetry"
import { RegimenEditorDialog } from "@/components/regimen-editor-dialog"

// ── Tiny sparkline (pure SVG) ─────────────────────────────────────────────────
function MiniSparkline({ values, color, invert }: { values: number[]; color: string; invert?: boolean }) {
  const w = 56, h = 24
  if (values.length < 2) return <svg width={w} height={h} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = invert ? ((v - min) / range) * h : h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <polyline points={pts} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Circular compliance ring ──────────────────────────────────────────────────
function ComplianceRing({ value }: { value: number }) {
  const r = 18, circ = 2 * Math.PI * r, dash = (value / 100) * circ
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r={r} strokeWidth="3" stroke="currentColor" className="text-border/40" fill="none" />
      <circle cx="24" cy="24" r={r} strokeWidth="3" stroke="var(--chart-4)" fill="none"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }} />
      <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" className="text-foreground">{value}</text>
    </svg>
  )
}

// ── Clinical glossary ─────────────────────────────────────────────────────────
const TOUR_STEPS = [
  { term: "Miniaturization", def: "The thinning of individual hair fibres over time. Lower % = healthier, thicker follicles responding to treatment." },
  { term: "Dread Shed",      def: "A temporary shedding phase (wk 3–6) where dormant follicles are replaced by stronger, anagen-phase hairs. Expected and positive." },
  { term: "Norwood Grade",   def: "A 7-level clinical scale measuring the degree of androgenic alopecia. Lower grades indicate less recession." },
  { term: "Compliance Score",def: "The percentage of days all prescribed treatments were completed as directed. 90%+ is clinical optimal." },
]

export function OverviewPanel({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [medications, setMedications] = useState<MedicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tourOpen, setTourOpen] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [editRegimenOpen, setEditRegimenOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, meds] = await Promise.all([getTelemetry(), getActiveMedications()])
      setTelemetry(t)
      setMedications(meds)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] }
    setChecked(next)
    const allDone = medications.every((m) => next[m.id])
    if (allDone && !submitting) {
      setSubmitting(true)
      // Browser Intl timezone (server falls back to the x-client-timezone header, then UTC).
      let tz: string | undefined
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { tz = undefined }
      try { await submitCheckin(true, "Daily regimen completed via check-in panel.", tz) }
      finally { setSubmitting(false); load() }
    }
  }

  const matrix       = telemetry?.miniaturization_matrix ?? []
  const miniTrend    = matrix.map((d) => d.miniaturization_index * 100)
  const miniDrop     = matrix.length >= 2
    ? Math.round((matrix[0].miniaturization_index - matrix[matrix.length - 1].miniaturization_index) * 100)
    : 0
  const avgCompliance = Math.round(telemetry?.compliance_score ?? 0)
  const dataPoints   = telemetry?.progress_analytics.data_points ?? 0
  const trend        = telemetry?.progress_analytics.trend ?? "insufficient_data"
  const checkedCount = Object.values(checked).filter(Boolean).length
  const allChecked   = medications.length > 0 && checkedCount === medications.length

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        {/* Vault Skeleton */}
        <div className="glass rounded-sm h-[320px] bg-card/40 border border-border/40 p-5">
          <div className="h-4 w-1/3 bg-foreground/10 rounded-sm mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 w-32 bg-foreground/5 rounded-sm shrink-0" />
            ))}
          </div>
        </div>
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-sm h-28 bg-card/40 border border-border/40 p-4 flex flex-col justify-between">
              <div className="h-3 w-1/2 bg-foreground/10 rounded-sm" />
              <div className="h-8 w-1/3 bg-foreground/10 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ProgressionVaultCard onNavigate={onNavigate} hasData={dataPoints > 0} />

      {!tourOpen ? (
        <button onClick={() => setTourOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-sm border border-border/40 bg-card/60 px-4 py-2.5 text-left hover:bg-foreground/5 transition-all duration-200 group">
          <div className="flex items-center gap-2.5">
            <Info className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
            <span className="text-[11px] text-muted-foreground">
              New to Densify?{" "}
              <span className="font-semibold text-foreground/70 group-hover:text-foreground transition-colors">
                Learn what each metric means →
              </span>
            </span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        </button>
      ) : (
        <div className="glass rounded-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-foreground/50" />
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-foreground/70">Clinical Glossary</p>
            </div>
            <button onClick={() => setTourOpen(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/20 p-px">
            {TOUR_STEPS.map((step) => (
              <div key={step.term} className="bg-card px-4 py-3">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-foreground/60 mb-1">{step.term}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{step.def}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div data-tutorial-id="tutorial-mini-matrix" className="glass rounded-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Miniaturization Reduced</p>
            <TrendingDown className="h-3.5 w-3.5 text-chart-4 opacity-60" />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-mono text-4xl font-semibold tracking-tight leading-none text-chart-4">
                {miniDrop > 0 ? `${miniDrop}%` : dataPoints >= 2 ? `${miniDrop}%` : "—"}
              </p>
              <p className="mt-1.5 text-[10px] tracking-widest uppercase text-muted-foreground/60">since baseline</p>
            </div>
            {miniTrend.length >= 2 && (
              <div className="mb-1">
                <MiniSparkline values={miniTrend} color="var(--chart-4)" invert />
              </div>
            )}
          </div>
        </div>

        <div data-tutorial-id="tutorial-compliance" className="glass rounded-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Avg. Compliance</p>
            <Target className="h-3.5 w-3.5 text-foreground/40 opacity-60" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-4xl font-semibold tracking-tight leading-none text-foreground">{avgCompliance}%</p>
              <p className="mt-1.5 text-[10px] tracking-widest uppercase text-muted-foreground/60">daily adherence</p>
            </div>
            <ComplianceRing value={avgCompliance} />
          </div>
        </div>

        <div data-tutorial-id="tutorial-progress-analytics" className="glass rounded-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">Progress Status</p>
            <ShieldCheck className="h-3.5 w-3.5 text-chart-4 opacity-60" />
          </div>
          <div>
            <p className="font-mono text-4xl font-semibold tracking-tight leading-none text-foreground capitalize">
              {trend === "insufficient_data" ? "—" : trend}
            </p>
            <p className="mt-1.5 text-[10px] tracking-widest uppercase text-muted-foreground/60">
              {dataPoints} data point{dataPoints !== 1 ? "s" : ""}
            </p>
          </div>
          {trend !== "insufficient_data" && (
            <div className="flex items-center gap-1.5 rounded-sm border border-chart-4/20 bg-chart-4/8 px-2.5 py-1.5">
              <Check className="h-3 w-3 text-chart-4 shrink-0" />
              <p className="text-[10px] font-semibold tracking-wide text-chart-4 capitalize">{trend}</p>
            </div>
          )}
        </div>
      </div>

      <div data-tutorial-id="tutorial-daily-checkin" className="glass rounded-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-0.5">Daily Check-In</p>
            <p className="text-xs font-semibold text-foreground">
              {medications.length === 0
                ? "No regimen added yet."
                : allChecked
                ? "All done for today"
                : `${checkedCount}/${medications.length} completed`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allChecked && medications.length > 0 && (
              <span className="flex items-center gap-1 rounded-sm border border-chart-4/30 bg-chart-4/10 px-2 py-1 text-[9px] font-semibold tracking-widest uppercase text-chart-4">
                <Check className="h-2.5 w-2.5" /> Complete
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditRegimenOpen(true)}
              className="h-7 text-[10px] font-semibold tracking-widest uppercase rounded-sm border-border/50 bg-secondary/30 text-foreground hover:bg-secondary/50"
            >
              Edit Regimen
            </Button>
          </div>
        </div>

        <div className="divide-y divide-border/30">
          {medications.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground/70 mb-3">No regimen added yet.</p>
              <Button
                size="sm"
                onClick={() => setEditRegimenOpen(true)}
                className="h-8 gap-2 text-[10px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90"
              >
                Configure Treatment Routine
              </Button>
            </div>
          ) : medications.map((med) => {
            const done = !!checked[med.id]
            return (
              <button key={med.id} onClick={() => toggle(med.id)}
                className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-foreground/5", done && "opacity-60")}>
                <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-all duration-200",
                  done ? "border-chart-4/60 bg-chart-4/15" : "border-border/60 bg-card/40")}>
                  {done && <Check className="h-3 w-3 text-chart-4" />}
                </div>
                <span className={cn("text-sm font-medium transition-colors", done ? "line-through text-muted-foreground/50" : "text-foreground")}>
                  {med.name}{med.dosage ? ` ${med.dosage}` : ""}
                </span>
                {med.frequency && (
                  <span className="ml-auto text-[10px] text-muted-foreground/40 shrink-0">{med.frequency}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="border-t border-border/40 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Camera className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground/70">Weekly Photo Check-In</p>
              <p className="text-[10px] text-muted-foreground">Upload your weekly progress photos to the Vault</p>
            </div>
          </div>
          <Button size="sm" variant="outline"
            className="h-7 shrink-0 gap-1.5 text-[10px] font-semibold tracking-widest uppercase border-border/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground rounded-sm"
            onClick={() => onNavigate("vault")}>
            Upload
          </Button>
        </div>
      </div>
      
      <RegimenEditorDialog
        open={editRegimenOpen}
        onOpenChange={setEditRegimenOpen}
        medications={medications}
        onUpdate={load}
      />
    </div>
  )
}
