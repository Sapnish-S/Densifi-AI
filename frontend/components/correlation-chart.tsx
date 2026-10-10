"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts"
import { Info } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getTelemetry, type MiniaturizationPoint } from "@/app/actions/telemetry"

// Chart data shape expected by Recharts
interface ChartPoint {
  week: string
  miniaturization: number
  density: number
}

type RangeKey = "all" | "last-12" | "first-12"

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "last-12",  label: "Last 12 Points" },
  { key: "first-12", label: "First 12 Points" },
  { key: "all",      label: "All Time" },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">
            {entry.dataKey === "miniaturization" ? "Miniaturization" : "Density"}
          </span>
          <span className="ml-auto font-mono font-medium text-popover-foreground">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Grid lines skeleton */}
      <div className="flex-1 border-b border-border/20 relative">
        <div className="absolute inset-x-0 bottom-1/4 h-px bg-border/20" />
        <div className="absolute inset-x-0 bottom-2/4 h-px bg-border/20" />
        <div className="absolute inset-x-0 bottom-3/4 h-px bg-border/20" />
        {/* Wavy fake line skeleton */}
        <div className="absolute inset-0 flex items-end justify-around px-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-1.5 rounded-t-sm bg-chart-1/20" style={{ height: `${Math.max(20, Math.random() * 80)}%` }} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end justify-around px-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-1.5 rounded-t-sm bg-chart-2/20" style={{ height: `${Math.max(20, Math.random() * 80)}%` }} />
          ))}
        </div>
      </div>
      {/* Axis ticks skeleton */}
      <div className="flex justify-between px-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-2 w-6 rounded-sm bg-foreground/10" />
        ))}
      </div>
    </div>
  )
}

export function CorrelationChart() {
  const [matrix, setMatrix] = useState<MiniaturizationPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>("all")
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    getTelemetry().then((t) => {
      setMatrix(t.miniaturization_matrix)
      setLoading(false)
    })
  }, [])

  // Map miniaturization_matrix into chart-ready rows
  const allPoints: ChartPoint[] = matrix.map((p, i) => ({
    week:            `Wk ${i + 1}`,
    miniaturization: Math.round(p.miniaturization_index * 100),
    density:         Math.round(p.density_percentage),
  }))

  const data = useMemo(() => {
    if (range === "last-12") return allPoints.slice(-12)
    if (range === "first-12") return allPoints.slice(0, 12)
    return allPoints
  }, [allPoints, range])

  return (
    <Card data-tutorial-id="tutorial-correlation" className="border-border bg-card">
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Treatment Outcome Correlation Engine</h2>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">LIVE</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Miniaturization index vs. density percentage — live from Bedrock AI analysis
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-secondary/50 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button key={opt.key} onClick={() => setRange(opt.key)}
                className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  range === opt.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-1" />
            Miniaturization %
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
            Density %
          </div>
          <TooltipProvider delay={100}>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1.5 rounded-md border border-chart-5/40 bg-chart-5/10 px-2 py-1 text-xs font-medium text-chart-5 transition-colors hover:bg-chart-5/20">
                <span className="h-2.5 w-2.5 rounded-sm bg-chart-5/40 ring-1 ring-chart-5/60" />
                Dread Shed Zone
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-pretty leading-relaxed">
                <p className="font-semibold">The &ldquo;Dread Shed&rdquo; is expected — and a good sign.</p>
                <p className="mt-1 text-xs">
                  Between weeks 3–6, dormant follicles in the <span className="font-medium">Telogen</span> phase are
                  pushed out as stronger hairs enter the <span className="font-medium">Anagen</span> phase.
                  A temporary density dip here is visual proof your follicle cycle is resetting.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        <div className="h-[280px] min-h-[280px] w-full">
          {loading ? (
            <ChartSkeleton />
          ) : data.length < 2 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-muted-foreground">No chart data yet</p>
              <p className="text-xs text-muted-foreground/60">
                Upload progress photos and run AI analysis to populate this chart.
              </p>
            </div>
          ) : mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fill: "var(--chart-1)", fontSize: 11 }}
                  tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]}
                  tick={{ fill: "var(--chart-2)", fontSize: 11 }}
                  tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />

                {/* Dread shed annotation — weeks 3–6 if they exist in the data */}
                {data.some((d) => d.week === "Wk 3") && data.some((d) => d.week === "Wk 6") && (
                  React.createElement(ReferenceArea, {
                    yAxisId: "left",
                    x1: "Wk 3",
                    x2: "Wk 6",
                    fill: "var(--chart-5)",
                    fillOpacity: 0.14,
                    stroke: "var(--chart-5)",
                    strokeOpacity: 0.4,
                    strokeDasharray: "4 4",
                  } as any)
                )}

                <Line yAxisId="left" type="monotone" dataKey="miniaturization"
                  stroke="var(--chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="density"
                  stroke="var(--chart-2)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
