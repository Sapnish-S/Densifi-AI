"use client"

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SectionId = "free" | "pro"
type UserTier = "free" | "premium" | "pro"

interface TutorialStep {
  id: string
  section: SectionId
  targetId: string
  code: string
  headline: string
  body: string
  cta: string
  padding: number
  center?: boolean
  onEnter?: () => void
}

interface Section {
  id: SectionId
  code: string
  name: string
  subtitle: string
}

const SECTIONS: Section[] = [
  {
    id: "free",
    code: "PHASE 01",
    name: "Densify System Setup",
    subtitle: "Welcome to Densify. Let's configure your baseline.",
  },
  {
    id: "pro",
    code: "PHASE 02",
    name: "Densify Pro Arsenal",
    subtitle: "Your clinical capabilities have been upgraded.",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Spotlight rect tracker
// ─────────────────────────────────────────────────────────────────────────────

function useSpotlightRect(targetId: string, active: boolean, forceCenter?: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!active || forceCenter) { setRect(null); return }
    function measure() {
      // Look up by ID directly
      const el = document.getElementById(targetId)
      if (el) setRect(el.getBoundingClientRect())
      else setRect(null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    const el = document.getElementById(targetId)
    if (el) ro.observe(el)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [targetId, active, forceCenter])

  return rect
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel position: right > left > below > above of spotlight
// ─────────────────────────────────────────────────────────────────────────────

function getPanelStyle(
  rect: DOMRect | null,
  pad: number,
  vpW: number,
  vpH: number,
): React.CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
  const panelW = 340
  const panelH = 240
  const gap = 20

  const rightX = rect.right + pad + gap
  if (rightX + panelW < vpW - 16) {
    const top = Math.max(16, Math.min(rect.top + pad, vpH - panelH - 16))
    return { position: "fixed", top, left: rightX, width: panelW }
  }
  const leftX = rect.left - pad - gap - panelW
  if (leftX > 16) {
    const top = Math.max(16, Math.min(rect.top + pad, vpH - panelH - 16))
    return { position: "fixed", top, left: leftX, width: panelW }
  }
  const belowY = rect.bottom + pad + gap
  if (belowY + panelH < vpH - 16) {
    const left = Math.max(16, Math.min(rect.left + pad, vpW - panelW - 16))
    return { position: "fixed", top: belowY, left, width: panelW }
  }
  const aboveY = rect.top - pad - gap - panelH
  const left = Math.max(16, Math.min(rect.left + pad, vpW - panelW - 16))
  return { position: "fixed", top: Math.max(16, aboveY), left, width: panelW }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section intro screen — monochromatic, premium
// ─────────────────────────────────────────────────────────────────────────────

function SectionIntro({
  section,
  onBegin,
  onSkip,
}: {
  section: Section
  onBegin: () => void
  onSkip: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t) }, [])

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[oklch(0_0_0/0.65)] backdrop-blur-xl">
      <div
        className={cn(
          "relative flex w-[400px] flex-col gap-5 rounded-[3px] border border-[oklch(0.32_0_0)] bg-[oklch(0.06_0_0/0.99)] p-8 shadow-[0_24px_80px_oklch(0_0_0/0.7)] transition-all duration-400",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-[oklch(0.92_0_0/0.7)]" />
        {(["tl","tr","bl","br"] as const).map((c) => (
          <div key={c} className={cn(
            "pointer-events-none absolute h-3.5 w-3.5 border-[oklch(0.45_0_0)]",
            c === "tl" && "left-3 top-3 border-l border-t",
            c === "tr" && "right-3 top-3 border-r border-t",
            c === "bl" && "left-3 bottom-3 border-l border-b",
            c === "br" && "right-3 bottom-3 border-r border-b",
          )} />
        ))}
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] font-semibold tracking-[0.3em] uppercase text-[oklch(0.60_0_0)]">
            {section.code}
          </p>
          <h2 className="text-[17px] font-semibold tracking-tight text-[#FFFFFF]">
            {section.name}
          </h2>
          <p className="text-[11px] leading-relaxed text-[#E5E7EB] mb-2">{section.subtitle}</p>
        </div>
        <div className="relative h-px overflow-hidden bg-[oklch(0.16_0_0)]">
          <div
            className="absolute inset-y-0 left-0 bg-[oklch(0.82_0_0)] transition-all duration-[1100ms] ease-out"
            style={{ width: visible ? "100%" : "0%" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onBegin}
            className="flex-1 rounded-[2px] border border-transparent bg-white py-2.5 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] hover:bg-gray-100 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-[0.98]"
          >
            Initialize Module
          </button>
          <button
            onClick={onSkip}
            className="rounded-[2px] border border-[oklch(0.36_0_0)] px-3 py-2.5 font-mono text-[9px] tracking-[0.22em] uppercase text-[oklch(0.62_0_0)] transition-colors duration-150 hover:border-[oklch(0.54_0_0)] hover:text-[oklch(0.82_0_0)]"
          >
            Exit
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-[oklch(0.22_0_0)]" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step HUD card — instant fade-in, white/slate glow ring
// ─────────────────────────────────────────────────────────────────────────────

interface StepViewProps {
  step: TutorialStep
  stepIndex: number
  totalSteps: number
  section: Section
  onAdvance: () => void
  onSkip: () => void
}

function StepView({ step, stepIndex, totalSteps, section, onAdvance, onSkip }: StepViewProps) {
  const rect = useSpotlightRect(step.targetId, true, step.center)
  const [vpW, setVpW] = useState(0)
  const [vpH, setVpH] = useState(0)
  const pad = step.padding

  useEffect(() => {
    function updateVp() { setVpW(window.innerWidth); setVpH(window.innerHeight) }
    updateVp()
    window.addEventListener("resize", updateVp)
    return () => window.removeEventListener("resize", updateVp)
  }, [])

  useEffect(() => {
    if (step.center) return
    const el = document.getElementById(step.targetId)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [step.targetId, step.center])

  const spotX = rect ? rect.left - pad : 0
  const spotY = rect ? rect.top  - pad : 0
  const spotW = rect ? rect.width  + pad * 2 : 0
  const spotH = rect ? rect.height + pad * 2 : 0

  const panelStyle = getPanelStyle(rect, pad, vpW, vpH)

  return (
    <>
      {rect && (
        <svg className="pointer-events-none fixed inset-0 z-[9998]" width={vpW} height={vpH} style={{ position: "fixed", top: 0, left: 0 }}>
          <defs>
            <mask id="tut-mask">
              <rect width={vpW} height={vpH} fill="white" />
              <rect x={spotX} y={spotY} width={spotW} height={spotH} rx="4" fill="black" />
            </mask>
          </defs>
          <rect width={vpW} height={vpH} fill="oklch(0 0 0 / 0.65)" mask="url(#tut-mask)" />
        </svg>
      )}
      {!rect && (
         <div className="pointer-events-none fixed inset-0 z-[9998] bg-[oklch(0_0_0/0.65)] backdrop-blur-sm" />
      )}

      {rect && (
        <div
          className="pointer-events-none fixed z-[9999] rounded-[4px]"
          style={{
            left: spotX, top: spotY, width: spotW, height: spotH,
            boxShadow: "0 0 0 1px oklch(0.86 0 0 / 0.75), 0 0 16px 2px oklch(0.70 0 0 / 0.18)",
          }}
        />
      )}

      <div className="fixed z-[10000] pointer-events-auto animate-in fade-in duration-200" style={panelStyle}>
        <div className="relative rounded-[3px] overflow-hidden bg-[oklch(0.06_0_0/0.99)] backdrop-blur-2xl border border-[oklch(0.28_0_0)] shadow-[0_16px_56px_oklch(0_0_0/0.80)]">
          <div className="h-px w-full bg-[oklch(0.82_0_0/0.55)]" />
          <div className="pointer-events-none absolute inset-2.5">
            {(["tl","tr","bl","br"] as const).map((c) => (
              <div key={c} className={cn(
                "absolute h-3 w-3 border-[oklch(0.38_0_0)]",
                c === "tl" && "left-0 top-0 border-l border-t",
                c === "tr" && "right-0 top-0 border-r border-t",
                c === "bl" && "left-0 bottom-0 border-l border-b",
                c === "br" && "right-0 bottom-0 border-r border-b",
              )} />
            ))}
          </div>

          <div className="p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] font-semibold tracking-[0.3em] uppercase text-[oklch(0.60_0_0)]">
                  {step.code}
                </span>
                <span className="rounded-[2px] border border-[oklch(0.24_0_0)] bg-[oklch(0.10_0_0)] px-1.5 py-0.5 font-mono text-[7px] tracking-[0.2em] uppercase text-[oklch(0.54_0_0)]">
                  {section.code}
                </span>
              </div>
              <span className="font-mono text-[9px] text-[#E5E7EB] tracking-widest">
                {String(stepIndex + 1).padStart(2, "0")}&thinsp;/&thinsp;{String(totalSteps).padStart(2, "0")}
              </span>
            </div>
            <h3 className="text-[13px] font-semibold leading-snug tracking-wide text-[#FFFFFF]">
              {step.headline}
            </h3>
            <p className="text-[11px] leading-[1.68] text-[#E5E7EB]">
              {step.body}
            </p>
            <div className="flex items-center gap-1 pt-0.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className="h-px rounded-full flex-1 transition-all duration-200"
                  style={{
                    background:
                      i < stepIndex
                        ? "oklch(0.44 0 0)"
                        : i === stepIndex
                          ? "oklch(0.88 0 0)"
                          : "oklch(0.20 0 0)",
                    flexGrow: i === stepIndex ? 2 : 1,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onAdvance}
                className="flex-1 rounded-[2px] border border-transparent bg-white py-2 font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-black shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] hover:bg-gray-100 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-[0.98]"
              >
                {step.cta}
              </button>
              <button
                onClick={onSkip}
                className="rounded-[2px] border border-[oklch(0.36_0_0)] px-3 py-2 font-mono text-[8px] tracking-[0.2em] uppercase text-[oklch(0.62_0_0)] transition-colors duration-150 hover:border-[oklch(0.54_0_0)] hover:text-[oklch(0.82_0_0)]"
              >
                Exit
              </button>
            </div>
          </div>
          <div className="h-px w-full bg-[oklch(0.16_0_0)]" />
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion screen — monochromatic, no game copy
// ─────────────────────────────────────────────────────────────────────────────

function CompletionScreen({ onClose, title, body }: { onClose: () => void, title: string, body: string }) {
  const [tick, setTick] = useState(false)
  useEffect(() => { const t = setTimeout(() => setTick(true), 100); return () => clearTimeout(t) }, [])

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[oklch(0_0_0/0.65)] backdrop-blur-xl animate-in fade-in duration-250">
      <div className="relative flex w-[360px] flex-col items-center gap-5 rounded-[3px] border border-[oklch(0.30_0_0)] bg-[oklch(0.06_0_0/0.98)] p-8 text-center shadow-[0_24px_80px_oklch(0_0_0/0.72)]">
        <div className="absolute inset-x-0 top-0 h-px bg-[oklch(0.82_0_0/0.55)]" />
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-500"
          style={{
            borderColor: tick ? "oklch(0.86 0 0)" : "oklch(0.22 0 0)",
            boxShadow: tick ? "0 0 24px oklch(0.86 0 0 / 0.12)" : undefined,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke={tick ? "oklch(0.92 0 0)" : "oklch(0.28 0 0)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <polyline
              points="20 6 9 17 4 12"
              strokeDasharray="28"
              strokeDashoffset={tick ? "0" : "28"}
              style={{ transition: "stroke-dashoffset 0.5s ease 0.2s" }}
            />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[8px] font-semibold tracking-[0.32em] uppercase text-[oklch(0.60_0_0)]">
            System Overview Complete
          </p>
          <h3 className="text-base font-semibold tracking-tight text-[#FFFFFF]">
            {title}
          </h3>
          <p className="text-[11px] leading-relaxed text-[#E5E7EB] text-pretty mb-2">
            {body}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-[2px] border border-transparent bg-white py-2.5 font-mono text-[10px] font-bold tracking-[0.24em] uppercase text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] hover:bg-gray-100 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-[0.98]"
        >
          Enter Dashboard
        </button>
        <div className="absolute inset-x-0 bottom-0 h-px bg-[oklch(0.18_0_0)]" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported component — DB-backed onboarding persistence
// ─────────────────────────────────────────────────────────────────────────────

type Phase =
  | { type: "idle" }
  | { type: "section-intro"; tourType: "free" | "pro" }
  | { type: "step"; stepIndex: number; tourType: "free" | "pro" }
  | { type: "done"; tourType: "free" | "pro" }

export interface CampaignTutorialHandle {
  launch: (type: "free" | "pro") => void
}

interface CampaignTutorialProps {
  onNavigate?: (view: string) => void
  userTier: UserTier
  hasSeenFreeTour: boolean
  hasSeenProTour: boolean
  onTourComplete: (tourType: "free" | "pro") => void
}

export const CampaignTutorial = forwardRef<CampaignTutorialHandle, CampaignTutorialProps>(
  function CampaignTutorial({ userTier, hasSeenFreeTour, hasSeenProTour, onTourComplete }, ref) {
    const [phase, setPhase] = useState<Phase>({ type: "idle" })
    const [activeSteps, setActiveSteps] = useState<TutorialStep[]>([])

    const FREE_STEPS: TutorialStep[] = [
      {
        id: "f1",
        section: "free",
        targetId: "daily-checkin",
        code: "NODE-01",
        headline: "Welcome to Densify",
        body: "Start by logging your daily protocol here to build your clinical baseline.",
        cta: "Next",
        padding: 10,
      },
      {
        id: "f2",
        section: "free",
        targetId: "upload-vault",
        code: "NODE-02",
        headline: "The Vault",
        body: "Upload your weekly progression photos here for Bedrock AI extraction.",
        cta: "Next",
        padding: 10,
      },
      {
        id: "f3",
        section: "free",
        targetId: "correlation-engine",
        code: "NODE-03",
        headline: "Your Engine",
        body: "Watch your density and miniaturization correlate over time.",
        cta: "Next",
        padding: 10,
      },
      {
        id: "f4",
        section: "free",
        targetId: "upgrade-badge",
        code: "NODE-04",
        headline: "Unlock Pro",
        body: "Ready for clinical intervention? Upgrade to access our network of specialists.",
        cta: "Next",
        padding: 10,
      },
    ]

    const PRO_STEPS: TutorialStep[] = [
      {
        id: "p1",
        section: "pro",
        targetId: "pro-welcome",
        code: "PRO-01",
        headline: "Welcome to Densify Pro",
        body: "Your clinical arsenal has been upgraded.",
        cta: "Next",
        padding: 10,
        center: true,
      },
      {
        id: "p2",
        section: "pro",
        targetId: "specialist-marketplace",
        code: "PRO-02",
        headline: "Telehealth Network",
        body: "Browse and instantly book consultations with verified specialists.",
        cta: "Next",
        padding: 10,
      },
      {
        id: "p3",
        section: "pro",
        targetId: "advanced-analytics",
        code: "PRO-03",
        headline: "Pro Analytics",
        body: "You now have access to predictive timelines and deeper historical data.",
        cta: "Next",
        padding: 10,
      },
    ]

    // Robust Error Handling: Skip steps if target doesn't exist
    const getNextValidStepIndex = useCallback((startIndex: number, steps: TutorialStep[]): number => {
      for (let i = startIndex; i < steps.length; i++) {
        const s = steps[i]
        // TODO(known bug): no element in the app has these ids, so the free tour
        // never shows and the pro tour only shows its centered step. Fix: look up `[data-tutorial-id="tutorial-…"]`
        // targets instead, e.g. document.querySelector(`[data-tutorial-id="${s.targetId}"]`) with matching ids.
        if (s.center || document.getElementById(s.targetId)) {
          return i
        }
      }
      return steps.length // Out of bounds = finished
    }, [])

    useEffect(() => {
      const t = setTimeout(() => {
        if (!hasSeenFreeTour) {
          setActiveSteps(FREE_STEPS)
          const first = getNextValidStepIndex(0, FREE_STEPS)
          if (first < FREE_STEPS.length) {
            setPhase({ type: "section-intro", tourType: "free" })
          }
        } else if ((userTier === "pro" || userTier === "premium") && !hasSeenProTour) {
          setActiveSteps(PRO_STEPS)
          const first = getNextValidStepIndex(0, PRO_STEPS)
          if (first < PRO_STEPS.length) {
            setPhase({ type: "section-intro", tourType: "pro" })
          }
        }
      }, 800)
      return () => clearTimeout(t)
    }, [hasSeenFreeTour, hasSeenProTour, userTier, getNextValidStepIndex])

    useImperativeHandle(ref, () => ({
      launch(type: "free" | "pro") {
        const steps = type === "free" ? FREE_STEPS : PRO_STEPS
        setActiveSteps(steps)
        const first = getNextValidStepIndex(0, steps)
        if (first < steps.length) {
          setPhase({ type: "section-intro", tourType: type })
        }
      },
    }))

    function beginSection() {
      if (phase.type !== "section-intro") return
      const tType = phase.tourType
      const steps = tType === "free" ? FREE_STEPS : PRO_STEPS
      const firstValid = getNextValidStepIndex(0, steps)
      if (firstValid < steps.length) {
        steps[firstValid].onEnter?.()
        setTimeout(() => setPhase({ type: "step", stepIndex: firstValid, tourType: tType }), 350)
      } else {
        skip()
      }
    }

    function advance() {
      if (phase.type !== "step") return
      const nextIndex = phase.stepIndex + 1
      const nextValid = getNextValidStepIndex(nextIndex, activeSteps)

      if (nextValid >= activeSteps.length) {
        setPhase({ type: "done", tourType: phase.tourType })
        return
      }

      activeSteps[nextValid].onEnter?.()
      setPhase({ type: "step", stepIndex: nextValid, tourType: phase.tourType })
    }

    function skip() {
      if (phase.type === "idle") return
      const type = phase.type !== "done" ? phase.tourType : null
      setPhase({ type: "idle" })
      if (type) onTourComplete(type)
    }

    function close() {
      if (phase.type === "idle" || phase.type !== "done") return
      const tType = phase.tourType
      setPhase({ type: "idle" })
      onTourComplete(tType)
    }

    if (phase.type === "idle") return null
    
    if (phase.type === "done") {
      const title = phase.tourType === "free" ? "Core Platform Initialized" : "Pro Features Unlocked"
      const body = phase.tourType === "free" 
        ? "Your central command dashboard is now fully active."
        : "You now have access to advanced clinical metrics and verified specialists."
      return <CompletionScreen onClose={close} title={title} body={body} />
    }

    if (phase.type === "section-intro") {
      const section = SECTIONS.find(s => s.id === phase.tourType) ?? SECTIONS[0]
      return (
        <SectionIntro
          section={section}
          onBegin={beginSection}
          onSkip={skip}
        />
      )
    }

    const step = activeSteps[phase.stepIndex]
    if (!step) return null
    const section = SECTIONS.find((s) => s.id === step.section) ?? SECTIONS[0]

    return (
      <StepView
        step={step}
        stepIndex={phase.stepIndex}
        totalSteps={activeSteps.length}
        section={section}
        onAdvance={advance}
        onSkip={skip}
      />
    )
  }
)
