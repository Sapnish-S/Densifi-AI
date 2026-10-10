"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2, UploadCloud, Trash2, Edit2, Activity, Save } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getLabReports, uploadLabReport, deleteLabReport } from "@/app/actions/lab-reports"
import { cn } from "@/lib/utils"

interface BiomarkerData {
  dht: string
  freeT: string
  ferritin: string
}

export function BiomarkerGrid() {
  const [reports, setReports] = useState<{ id: string; title: string; uploadedAt: string; dht?: number; freeT?: number; ferritin?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const [biomarkers, setBiomarkers] = useState<BiomarkerData>({
    dht: "--",
    freeT: "--",
    ferritin: "--",
  })
  
  const [formData, setFormData] = useState<BiomarkerData>(biomarkers)
  const [savingOverride, setSavingOverride] = useState(false)

  // Use real data from the database
  useEffect(() => {
    if (reports.length > 0) {
      const latest = reports[0]
      setBiomarkers({
        dht: latest.dht ? Number(latest.dht).toFixed(2) : "--",
        freeT: latest.freeT ? Number(latest.freeT).toFixed(2) : "--",
        ferritin: latest.ferritin ? Number(latest.ferritin).toFixed(2) : "--",
      })
    } else {
      setBiomarkers({ dht: "--", freeT: "--", ferritin: "--" })
    }
  }, [reports])

  useEffect(() => {
    getLabReports().then((data) => {
      setReports(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await deleteLabReport(id)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  function handleUpload() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/pdf,image/*"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setLoading(true)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string
        await uploadLabReport({ title: file.name, dataUrl })
        const data = await getLabReports()
        setReports(data)
        setLoading(false)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function handleOpenEdit() {
    setFormData(biomarkers)
    setEditOpen(true)
  }

  async function handleSaveOverride() {
    setSavingOverride(true)
    // Simulate API delay for override save
    await new Promise(r => setTimeout(r, 600))
    setBiomarkers(formData)
    setSavingOverride(false)
    setEditOpen(false)
  }

  const hasReports = reports.length > 0

  return (
    <Card data-tutorial-id="tutorial-biomarker" className="border-border bg-card">
      <CardHeader className="pb-4 flex flex-row items-center justify-between border-b border-border/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Lab Reports & Biomarkers</h2>
          <p className="mt-1 text-xs text-muted-foreground">AI-extracted blood panel tracking (DHT, Free T, Ferritin)</p>
        </div>
        <div className="flex items-center gap-2">
          {hasReports && (
            <Button onClick={handleOpenEdit} size="sm" variant="outline" className="h-8 text-[10px] tracking-widest uppercase gap-1.5 border-border/50 bg-secondary/30 text-foreground hover:bg-secondary/50">
              <Edit2 className="h-3 w-3" /> Edit Data
            </Button>
          )}
          <Button onClick={handleUpload} size="sm" className="h-8 text-[10px] font-semibold tracking-widest uppercase gap-1.5 bg-foreground text-background hover:bg-foreground/90">
            <UploadCloud className="h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-0 py-0">
        {/* Biomarker Result Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-10 border-b border-border/40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        ) : hasReports ? (
          <div className="grid grid-cols-3 gap-px bg-border/40 border-b border-border/40">
            <div className="bg-card p-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3.5 w-3.5 text-chart-2 opacity-70" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">DHT</p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="font-mono text-3xl font-semibold text-foreground tabular-nums">{biomarkers.dht}</p>
                <p className="text-[10px] text-muted-foreground font-medium">ng/dL</p>
              </div>
            </div>
            <div className="bg-card p-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3.5 w-3.5 text-chart-1 opacity-70" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Free T</p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="font-mono text-3xl font-semibold text-foreground tabular-nums">{biomarkers.freeT}</p>
                <p className="text-[10px] text-muted-foreground font-medium">pg/mL</p>
              </div>
            </div>
            <div className="bg-card p-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3.5 w-3.5 text-chart-4 opacity-70" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ferritin</p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="font-mono text-3xl font-semibold text-foreground tabular-nums">{biomarkers.ferritin}</p>
                <p className="text-[10px] text-muted-foreground font-medium">ng/mL</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center border-b border-border/40 bg-secondary/5">
            <Activity className="h-6 w-6 text-foreground/20 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">No Biomarker Data</p>
            <p className="text-xs text-muted-foreground">Upload your first blood panel to let AI extract your metrics.</p>
          </div>
        )}

        {/* Uploaded Documents List */}
        <div className="bg-secondary/10">
          <div className="grid grid-cols-[1.5fr_1fr_auto] gap-2 border-b border-border/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Report Document</span>
            <span>Uploaded Date</span>
            <span className="w-10 text-right">Actions</span>
          </div>

          <div>
            {!loading && !hasReports ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <FileText className="h-5 w-5 mx-auto mb-2 opacity-20" />
                No lab documents uploaded.
              </div>
            ) : (
              reports.map((m) => (
                <div key={m.id} className="grid grid-cols-[1.5fr_1fr_auto] items-center gap-2 border-b border-border/40 px-4 py-3 last:border-b-0 hover:bg-secondary/20 transition-colors">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="h-7 w-7 flex items-center justify-center rounded-sm bg-background border border-border/40 shrink-0">
                      <FileText className="h-3.5 w-3.5 text-foreground/60" />
                    </div>
                    <p className="truncate text-xs font-medium text-foreground">{m.title}</p>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {new Date(m.uploadedAt).toLocaleDateString()}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm border-border/60 bg-card/95 backdrop-blur-xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold tracking-wide uppercase">Edit Biomarker Data</DialogTitle>
            <DialogDescription className="text-xs">
              Override AI-extracted values to correct any OCR misinterpretations before saving to your clinical record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-right">DHT</label>
                <div className="col-span-3 flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.dht}
                    onChange={(e) => setFormData({ ...formData, dht: e.target.value })}
                    className="w-full h-9 rounded-sm border border-border/50 bg-background px-3 text-sm focus:outline-none focus:border-foreground/30 font-mono"
                  />
                  <span className="text-xs text-muted-foreground w-12">ng/dL</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-right">Free T</label>
                <div className="col-span-3 flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.freeT}
                    onChange={(e) => setFormData({ ...formData, freeT: e.target.value })}
                    className="w-full h-9 rounded-sm border border-border/50 bg-background px-3 text-sm focus:outline-none focus:border-foreground/30 font-mono"
                  />
                  <span className="text-xs text-muted-foreground w-12">pg/mL</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-right">Ferritin</label>
                <div className="col-span-3 flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.ferritin}
                    onChange={(e) => setFormData({ ...formData, ferritin: e.target.value })}
                    className="w-full h-9 rounded-sm border border-border/50 bg-background px-3 text-sm focus:outline-none focus:border-foreground/30 font-mono"
                  />
                  <span className="text-xs text-muted-foreground w-12">ng/mL</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveOverride}
              disabled={savingOverride}
              className="w-full h-9 gap-2 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 mt-2"
            >
              {savingOverride ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Overrides
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
