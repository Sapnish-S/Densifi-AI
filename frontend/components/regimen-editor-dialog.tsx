"use client"

import { useState } from "react"
import { Plus, Trash2, Loader2, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { type MedicationRow } from "@/app/actions/telemetry"
import { addMedication, deleteMedication } from "@/app/actions/medications"

export function RegimenEditorDialog({
  open,
  onOpenChange,
  medications,
  onUpdate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  medications: MedicationRow[]
  onUpdate: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [frequency, setFrequency] = useState("")

  async function handleAdd() {
    if (!name.trim()) return
    setLoading(true)
    try {
      await addMedication({ name, dosage, frequency })
      setName("")
      setDosage("")
      setFrequency("")
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setLoading(true)
    try {
      await deleteMedication(id)
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/60 bg-card/95 backdrop-blur-xl rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-wide uppercase">Edit Regimen</DialogTitle>
          <DialogDescription className="text-xs">
            Manage your daily active medications and treatments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {medications.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-4 border border-dashed border-border/40 rounded-sm">
                No active treatments configured.
              </p>
            ) : (
              <div className="divide-y divide-border/30 rounded-sm border border-border/40 bg-secondary/10">
                {medications.map((med) => (
                  <div key={med.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{med.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {med.dosage && <span>{med.dosage} </span>}
                        {med.frequency && <span>· {med.frequency}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(med.id)}
                      disabled={loading}
                      className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-sm border border-border/40 bg-secondary/20 p-3 space-y-3">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Add New Treatment</p>
            <input
              type="text"
              placeholder="Medication Name (e.g. Finasteride)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 rounded-sm border border-border/50 bg-background px-2.5 text-xs focus:outline-none focus:border-foreground/30"
              disabled={loading}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Dosage (e.g. 1mg)"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full h-8 rounded-sm border border-border/50 bg-background px-2.5 text-xs focus:outline-none focus:border-foreground/30"
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Frequency (e.g. Daily)"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full h-8 rounded-sm border border-border/50 bg-background px-2.5 text-xs focus:outline-none focus:border-foreground/30"
                disabled={loading}
              />
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!name.trim() || loading}
              className="w-full h-8 text-[10px] font-semibold tracking-widest uppercase rounded-sm gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add Treatment
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full h-8 text-[11px] font-semibold tracking-wide rounded-sm border border-border bg-card hover:bg-secondary/50"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
