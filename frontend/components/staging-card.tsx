"use client"

import { useState, useEffect } from "react"
import {
  ShieldAlert,
  Info,
  ChevronRight,
  Activity,
  User,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Stethoscope,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  classifyStage,
  getStagesForScale,
  type GenderPreference,
  type StageInfo,
  type StagingScale,
  NORWOOD_STAGES,
  LUDWIG_STAGES,
} from "@/lib/staging"

interface StagingCardProps {
  densityPercentage?: number
  miniaturizationIndex?: number
  initialGender?: GenderPreference
  onGenderChange?: (gender: GenderPreference) => void
  showScaleToggle?: boolean
  compact?: boolean
  className?: string
}

export function StagingCard({
  densityPercentage = 62.5,
  miniaturizationIndex = 0.31,
  initialGender = "male",
  onGenderChange,
  showScaleToggle = true,
  compact = false,
  className,
}: StagingCardProps) {
  const [gender, setGender] = useState<GenderPreference>(initialGender)
  const [guideOpen, setGuideOpen] = useState(false)

  // Current detected stage based on density + miniaturization + selected scale
  const detectedStage = classifyStage(densityPercentage, miniaturizationIndex, gender)

  // User can click through stages on the stepper to inspect other stages
  const [selectedStageNum, setSelectedStageNum] = useState<number>(detectedStage.stageNumber)

  useEffect(() => {
    setGender(initialGender)
    const reclassified = classifyStage(densityPercentage, miniaturizationIndex, initialGender)
    setSelectedStageNum(reclassified.stageNumber)
  }, [initialGender, densityPercentage, miniaturizationIndex])

  const activeScale: StagingScale = gender === "male" ? "norwood" : "ludwig"
  const allStages = getStagesForScale(activeScale)

  // Currently inspected stage (defaults to detected, can be clicked)
  const currentInspectStage =
    allStages.find((s) => s.stageNumber === selectedStageNum) || detectedStage

  function handleSwitchGender(newGender: GenderPreference) {
    setGender(newGender)
    onGenderChange?.(newGender)
    // Re-classify for the new gender scale
    const reclassified = classifyStage(densityPercentage, miniaturizationIndex, newGender)
    setSelectedStageNum(reclassified.stageNumber)
  }

  const severityBadgeStyles: Record<StageInfo["severity"], string> = {
    mild: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    moderate: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    advanced: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    severe: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  }

  return (
    <div
      className={cn(
        "glass rounded-sm overflow-hidden border border-border/40 transition-all duration-300",
        className,
      )}
    >
      {/* Header with Title and Male/Female Scale Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 px-5 py-3.5 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Clinical Classification
            </span>
            <span
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-xs font-mono uppercase tracking-wider border",
                severityBadgeStyles[currentInspectStage.severity],
              )}
            >
              {currentInspectStage.severity}
            </span>
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2 mt-0.5">
            <span>{currentInspectStage.stageLabel}</span>
            <span className="text-muted-foreground/60 font-normal">·</span>
            <span className="text-muted-foreground font-normal">{currentInspectStage.title}</span>
          </h3>
        </div>

        {/* Scale Switcher: Norwood (Men) / Ludwig (Women) */}
        {showScaleToggle && (
          <div className="flex items-center p-0.5 rounded-sm bg-card/60 border border-border/50 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleSwitchGender("male")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase rounded-xs transition-all",
                gender === "male"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Men · Norwood (1–7)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchGender("female")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase rounded-xs transition-all",
                gender === "female"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Women · Ludwig (I–III)</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Stage Metric & Description Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Main Stage Metric Card */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-3.5 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Diagnostic Scale
            </p>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {gender === "male"
                  ? `Stage ${currentInspectStage.stageNumber}`
                  : currentInspectStage.romanLabel || `Stage ${currentInspectStage.stageNumber}`}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {gender === "male" ? "Scale 1–7" : "Scale I–III"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-snug">
              {currentInspectStage.subtitle}
            </p>
          </div>

          {/* Density & Miniaturization Reference */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-3.5 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Stage Threshold Match
            </p>
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Est. Density:</span>
                <span className="font-mono font-medium text-foreground">
                  {Math.round(densityPercentage)}%{" "}
                  <span className="text-[10px] text-muted-foreground">
                    ({currentInspectStage.densityMin}%–{currentInspectStage.densityMax}%)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Miniaturization:</span>
                <span className="font-mono font-medium text-chart-4">
                  {Math.round(miniaturizationIndex * 100)}%{" "}
                  <span className="text-[10px] text-muted-foreground">
                    ({Math.round(currentInspectStage.miniaturizationMin * 100)}%–
                    {Math.round(currentInspectStage.miniaturizationMax * 100)}%)
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Primary Clinical Target */}
          <div className="rounded-sm border border-border/30 bg-card/40 p-3.5 space-y-1.5 flex flex-col justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Clinical Focus
              </p>
              <p className="text-xs text-foreground/90 mt-1 line-clamp-2 leading-relaxed">
                {currentInspectStage.recommendation}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="text-[10px] font-semibold text-foreground/70 hover:text-foreground tracking-wider uppercase inline-flex items-center gap-1 self-start pt-1 transition-colors"
            >
              Explore Full Guide <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Visual Stage Progression Stepper */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {gender === "male" ? "Norwood 7-Stage Spectrum" : "Ludwig 3-Stage Spectrum"}
            </p>
            <span className="text-[10px] text-muted-foreground">
              Tap any stage to view clinical criteria
            </span>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-7 gap-1.5 pt-1">
            {allStages.map((stage) => {
              const isDetected = stage.stageNumber === detectedStage.stageNumber
              const isInspected = stage.stageNumber === currentInspectStage.stageNumber

              return (
                <button
                  key={stage.stageNumber}
                  type="button"
                  onClick={() => setSelectedStageNum(stage.stageNumber)}
                  className={cn(
                    "relative flex flex-col items-center p-2 rounded-sm border transition-all text-center group",
                    isInspected
                      ? "border-foreground bg-foreground/10 shadow-xs"
                      : "border-border/40 bg-card/30 hover:border-border/80 hover:bg-card/60",
                  )}
                >
                  {/* Detected indicator badge */}
                  {isDetected && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 py-0.2 text-[8px] font-bold tracking-widest uppercase bg-foreground text-background rounded-xs whitespace-nowrap shadow-xs">
                      YOUR SCAN
                    </span>
                  )}

                  <span
                    className={cn(
                      "font-mono text-sm font-semibold transition-colors mt-0.5",
                      isInspected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {gender === "male"
                      ? stage.stageNumber
                      : stage.romanLabel?.split(" ")[1] || stage.stageNumber}
                  </span>

                  <span className="text-[9px] text-muted-foreground/70 tracking-tight truncate w-full hidden sm:block mt-0.5">
                    {stage.severity}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detailed Criteria for the selected stage */}
        <div className="rounded-sm border border-border/30 bg-secondary/20 p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              {currentInspectStage.stageLabel} Criteria: {currentInspectStage.title}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentInspectStage.description}
            </p>
          </div>

          <div className="border-t border-border/20 pt-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-medium">
              Diagnostic Biomarker Patterns:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-foreground/80">
              {currentInspectStage.patternHighlights.map((point, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-foreground/50 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Clinical Guide Modal */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-border/40 bg-background/95 backdrop-blur-xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-4 w-4 text-foreground/70" />
              Clinical Hair Loss Staging Guide
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reference guide for male pattern alopecia (Norwood Scale) and female pattern alopecia
              (Ludwig Scale).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Norwood Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h4 className="text-sm font-semibold tracking-tight text-foreground">
                  Norwood-Hamilton Scale for Men (7 Stages)
                </h4>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Hamilton-Norwood Standard
                </span>
              </div>
              <div className="space-y-2.5">
                {NORWOOD_STAGES.map((s) => (
                  <div
                    key={s.stageNumber}
                    className="p-3 rounded-sm border border-border/30 bg-card/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {s.stageLabel}: {s.title}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-xs font-mono uppercase tracking-wider border",
                          severityBadgeStyles[s.severity],
                        )}
                      >
                        {s.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                    <p className="text-[11px] text-foreground/70 pt-1 font-mono">
                      Target Protocol: {s.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ludwig Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h4 className="text-sm font-semibold tracking-tight text-foreground">
                  Ludwig Scale for Women (3 Stages)
                </h4>
                <span className="text-[10px] text-muted-foreground font-mono">Ludwig Standard</span>
              </div>
              <div className="space-y-2.5">
                {LUDWIG_STAGES.map((s) => (
                  <div
                    key={s.stageNumber}
                    className="p-3 rounded-sm border border-border/30 bg-card/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {s.stageLabel}: {s.title}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-xs font-mono uppercase tracking-wider border",
                          severityBadgeStyles[s.severity],
                        )}
                      >
                        {s.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                    <p className="text-[11px] text-foreground/70 pt-1 font-mono">
                      Target Protocol: {s.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
