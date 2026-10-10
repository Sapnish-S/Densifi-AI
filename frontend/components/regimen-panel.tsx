"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getActiveMedications, type MedicationRow } from "@/app/actions/telemetry"
import { Loader2, Plus, Edit2, Pill } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RegimenEditorDialog } from "@/components/regimen-editor-dialog"

export function RegimenPanel() {
  const [meds, setMeds] = useState<MedicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getActiveMedications().then((data) => {
      setMeds(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <Card data-tutorial-id="tutorial-regimen" className="border-border bg-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Protocol & Regimen</h2>
          <p className="mt-1 text-xs text-muted-foreground">Active daily medications</p>
        </div>
        <Button 
          onClick={() => setEditOpen(true)}
          size="sm" 
          variant="outline" 
          className="h-8 gap-1.5 text-[10px] tracking-widest uppercase bg-secondary/30 hover:bg-secondary/60 text-foreground border-border/50"
        >
          <Edit2 className="h-3 w-3" /> Edit & Add
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-2 border-y border-border bg-secondary/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Compound</span>
          <span>Dose</span>
          <span>Cadence</span>
          <span className="text-right">Added</span>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        ) : meds.length === 0 ? (
          <div className="px-4 py-10 flex flex-col items-center justify-center text-center">
            <Pill className="h-8 w-8 text-foreground/20 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No protocol initialized</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">
              Add your current medications and dosages to enable daily adherence tracking and AI compliance insights.
            </p>
            <Button
              onClick={() => setEditOpen(true)}
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 h-8 px-5 gap-2 text-[10px] font-semibold tracking-widest uppercase rounded-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Initialize Protocol
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {meds.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-2 px-4 py-3 hover:bg-secondary/20 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{item.dosage || "—"}</span>
                <span className="text-xs text-muted-foreground">{item.frequency || "—"}</span>
                <span className="text-right font-mono text-[10px] text-muted-foreground/60">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      <RegimenEditorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        medications={meds}
        onUpdate={load}
      />
    </Card>
  )
}
