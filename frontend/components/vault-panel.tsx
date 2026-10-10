"use client"

import { createPortal } from "react-dom"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { FolderOpen, Folder, Camera, Check, Crosshair, ChevronRight, Plus, Loader2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { BiometricScanner, type CaptureView } from "@/components/biometric-scanner"
import { getVaultMonths, type VaultMonth, type VaultPhoto } from "@/app/actions/telemetry"
import { getS3Url } from "@/lib/s3"

function AlignmentOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground/20" />
      <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-foreground/20" />
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-foreground/30" />
      <div className="absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-foreground/40" />
      <div className="absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-foreground/40" />
      <div className="absolute left-3 bottom-3 h-4 w-4 border-l-2 border-b-2 border-foreground/40" />
      <div className="absolute right-3 bottom-3 h-4 w-4 border-r-2 border-b-2 border-foreground/40" />
      <div className="absolute left-1/2 top-2.5 -translate-x-1/2 flex items-center gap-1 rounded-sm bg-foreground/80 px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase text-background">
        <Crosshair className="h-2.5 w-2.5" />
        Day 1 Alignment
      </div>
    </div>
  )
}

interface Selected {
  vault: VaultMonth
  photo: VaultPhoto
}

function PhotoThumb({ photo, vault, size = "md", onOpen }: { photo: VaultPhoto; vault: VaultMonth; size?: "sm" | "md" | "lg"; onOpen: (s: Selected) => void }) {
  const heightClass = size === "lg" ? "aspect-[3/4]" : size === "md" ? "aspect-[3/4]" : "aspect-square"
  const src = photo.data_url || null
  return (
    <button onClick={() => onOpen({ vault, photo })} className={cn("group relative overflow-hidden rounded-sm border border-border/40 bg-secondary/20 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:border-foreground/30 transition-all duration-300 w-full", heightClass)}>
      {src ? (
        <Image src={src} alt={`${photo.label} — ${vault.month}`} fill sizes="(max-width: 768px) 33vw, 200px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-foreground/5" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent px-2 pb-2 pt-5">
        <p className="text-[8px] font-semibold tracking-widest uppercase text-foreground/70">{photo.label}</p>
      </div>
    </button>
  )
}

function MonthFolder({ vault, isOpen, onToggle, onOpen }: { vault: VaultMonth; isOpen: boolean; onToggle: () => void; onOpen: (s: Selected) => void }) {
  const FolderIcon = isOpen ? FolderOpen : Folder
  const photoCount = vault.photos.length
  return (
    <div className="glass rounded-sm overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-foreground/5 transition-colors duration-200 group">
        <FolderIcon className={cn("h-4 w-4 shrink-0 transition-colors duration-200", isOpen ? "text-foreground/70" : "text-muted-foreground/40 group-hover:text-foreground/50")} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold tracking-tight text-foreground">{vault.month}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{vault.date} · {photoCount} photo{photoCount !== 1 ? "s" : ""}</p>
        </div>
        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
      </button>
      {isOpen && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {vault.photos.map((photo) => <PhotoThumb key={photo.id} photo={photo} vault={vault} size="md" onOpen={onOpen} />)}
            {(["Front", "Crown", "Side"] as const).filter((v) => !vault.photos.find((p) => p.label === v)).map((view) => (
              <div key={view} className="aspect-[3/4] flex flex-col items-center justify-center rounded-sm border border-dashed border-border/30 bg-card/30 gap-1">
                <Camera className="h-4 w-4 text-muted-foreground/20" />
                <p className="text-[8px] tracking-widest uppercase text-muted-foreground/30">{view}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function VaultPanel({
  captureOpen,
  onCaptureOpenChange,
  gender = "male",
}: {
  captureOpen?: boolean
  onCaptureOpenChange?: (open: boolean) => void
  gender?: "male" | "female"
} = {}) {
  const [vaults, setVaults] = useState<VaultMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Selected | null>(null)

  const [uploadOpenInternal, setUploadOpenInternal] = useState(false)
  const uploadOpen = captureOpen ?? uploadOpenInternal
  function setUploadOpen(val: boolean) {
    setUploadOpenInternal(val)
    onCaptureOpenChange?.(val)
  }

  const [scannerView, setScannerView] = useState<CaptureView | null>(null)
  const [uploading, setUploading] = useState<Partial<Record<CaptureView, "uploading" | "done" | "error">>>({})
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadView, setUploadView] = useState<CaptureView | null>(null)
  const [validatingUpload, setValidatingUpload] = useState<{ file: File; view: CaptureView; previewUrl: string } | null>(null)

  useEffect(() => {
    if (validatingUpload) {
      const timer = setTimeout(() => {
        handleCapture(validatingUpload.file, validatingUpload.view, validatingUpload.file.type)
        URL.revokeObjectURL(validatingUpload.previewUrl)
        setValidatingUpload(null)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [validatingUpload])

  const load = () => {
    getVaultMonths().then((data) => {
      // Show newest first
      const sorted = [...data].sort((a, b) => b.id.localeCompare(a.id))
      setVaults(sorted)
      if (sorted.length > 0 && Object.keys(openFolders).length === 0) {
        setOpenFolders({ [sorted[0].id]: true })
      }
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  function toggleFolder(id: string) { setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] })) }

  const totalPhotos = vaults.reduce((a, v) => a + v.photos.length, 0)
  const monthCount = vaults.length

  async function handleDelete(photo: VaultPhoto) {
    if (!confirm("Are you sure you want to delete this photo?")) return
    try {
      await fetch("/api/vault-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id }),
      })
      setSelected(null)
      load()
    } catch (e) {
      console.error(e)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadView) return
    
    if (fileInputRef.current) fileInputRef.current.value = ""
    
    const previewUrl = URL.createObjectURL(file)
    setValidatingUpload({ file, view: uploadView, previewUrl })
    setUploadView(null)
  }

  async function handleCapture(blob: Blob, view: CaptureView, contentType: string = "image/png") {
    setScannerView(null)
    setUploading((prev) => ({ ...prev, [view]: "uploading" }))
    try {
      const res = await fetch("/api/vault-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view, contentType }),
      })
      if (!res.ok) throw new Error("Failed to get upload URL")
      const { uploadUrl, key } = await res.json()

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      })
      if (!put.ok) throw new Error("S3 upload failed")

      const save = await fetch("/api/vault-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, view, takenAt: new Date().toISOString() }),
      })
      if (!save.ok) throw new Error("Failed to save photo record")

      setUploading((prev) => ({ ...prev, [view]: "done" }))
      load() // refresh vault list
    } catch {
      setUploading((prev) => ({ ...prev, [view]: "error" }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass rounded-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-border/40">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-1">Visual Progression Vault</p>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Monthly Photo Archive</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Each folder is a month of treatment — Front, Crown, and Side views stored with alignment verification.</p>
          </div>
          <Button onClick={() => setUploadOpen(true)} className="h-8 gap-2 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Add This Month
          </Button>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/40 sm:grid-cols-3">
          <div className="flex flex-col items-center justify-center py-3 gap-0.5">
            <p className="font-mono text-xl font-semibold text-foreground">{loading ? "-" : monthCount}</p>
            <p className="text-[9px] tracking-widest uppercase text-muted-foreground/60">Months tracked</p>
          </div>
          <div className="flex flex-col items-center justify-center py-3 gap-0.5">
            <p className="font-mono text-xl font-semibold text-foreground">{loading ? "-" : totalPhotos}</p>
            <p className="text-[9px] tracking-widest uppercase text-muted-foreground/60">Total photos</p>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center py-3 gap-0.5">
            <p className="font-mono text-xl font-semibold text-foreground">{loading ? "-" : (totalPhotos > 0 ? "Active" : "—")}</p>
            <p className="text-[9px] tracking-widest uppercase text-muted-foreground/60">Vault Status</p>
          </div>
        </div>
      </div>

      <div data-tutorial-id="tutorial-vault-archive" className="space-y-2">
        {loading ? (
          <div className="glass rounded-sm py-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : vaults.length === 0 ? (
          <div className="glass rounded-sm text-center py-12 text-sm text-muted-foreground">
            <Folder className="h-6 w-6 mx-auto mb-2 opacity-20" />
            No monthly captures yet. Tap "Add This Month" to start.
          </div>
        ) : (
          vaults.map((vault) => <MonthFolder key={vault.id} vault={vault} isOpen={!!openFolders[vault.id]} onToggle={() => toggleFolder(vault.id)} onOpen={setSelected} />)
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md border-border/60 bg-card/95 backdrop-blur-xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"><Camera className="h-3.5 w-3.5 text-foreground/60" />Direct Capture — Monthly Photos</DialogTitle>
            <DialogDescription className="text-xs text-pretty">Tap each view to open the biometric scanner. Images are automatically snapped when quality conditions are met and uploaded directly to secure storage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(["Front", "Crown", "Side"] as const).map((view) => {
              const state = uploading[view]
              const done = state === "done", busy = state === "uploading", err = state === "error"
              return (
                <div key={view} 
                  className={cn("flex w-full items-center gap-3 rounded-sm border px-4 py-3 text-left transition-all duration-200",
                    done ? "border-foreground/25 bg-foreground/5" : busy ? "border-border/30 bg-secondary/10" : "border-border/40 bg-secondary/20 hover:bg-foreground/5 hover:border-foreground/30")}>
                  <button type="button" className="flex items-center gap-3 flex-1 text-left" onClick={() => { if (!done && !busy) setScannerView(view) }} disabled={done || busy}>
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border transition-all",
                      done ? "border-foreground/25 bg-foreground/8" : busy ? "border-border/30 bg-card/40" : "border-border/40 bg-card/60")}>
                      {busy ? <Loader2 className="h-4 w-4 text-muted-foreground/70 animate-spin" /> : done ? <Check className="h-4 w-4 text-foreground/70" /> : <Camera className="h-4 w-4 text-muted-foreground/50" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-xs font-semibold", done ? "text-foreground" : "text-foreground")}>{view} View</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{busy ? "Uploading to vault..." : done ? "Captured & uploaded" : err ? "Upload failed — tap to retry" : "Tap to open scanner"}</p>
                    </div>
                  </button>
                  {!done && !busy && (
                    <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-border/40">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-8 w-8 rounded-full" 
                         onClick={() => {
                           setUploadView(view);
                           fileInputRef.current?.click();
                         }}
                         title="Upload from device"
                       >
                         <Upload className="h-4 w-4 text-muted-foreground" />
                       </Button>
                       <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              )
            })}
            <Button className="w-full h-9 gap-2 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all"
              onClick={() => { setUploadOpen(false); setUploading({}) }}>
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg border-border/60 bg-card/95 backdrop-blur-xl rounded-sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"><Camera className="h-3.5 w-3.5 text-foreground/60" />{selected.photo.label} View · {selected.vault.month}</DialogTitle>
                <DialogDescription className="text-xs text-pretty">Guided Camera Alignment Overlay — confirm this capture matches your Day 1 baseline framing.</DialogDescription>
              </DialogHeader>
              <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-sm border border-border/40">
                <Image src={selected.photo.data_url || "/placeholder.svg"} alt={`${selected.photo.label} full size`} fill sizes="280px" className="object-cover" />
                <AlignmentOverlay />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-border/40 bg-secondary/30 px-3 py-2.5 mt-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground tracking-wide">Captured</span>
                  <span className="rounded-sm border border-foreground/20 bg-foreground/10 px-2 py-0.5 font-mono font-semibold text-foreground">{new Date(selected.photo.taken_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase text-chart-4 mr-2"><Check className="h-3 w-3" />Aligned</div>
                  <Button variant="destructive" size="sm" className="h-7 text-[10px] px-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600 border border-red-500/20" onClick={() => handleDelete(selected.photo)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!validatingUpload} onOpenChange={() => {}}> 
        <DialogContent className="max-w-md border-blue-500/30 bg-zinc-950 backdrop-blur-xl rounded-sm p-0 overflow-hidden [&>button]:hidden">
          {validatingUpload && (
            <div className="relative w-full aspect-[4/3] bg-zinc-950">
              <Image src={validatingUpload.previewUrl} alt="Validating Upload" fill className="object-cover opacity-90 grayscale-[20%]" />
              <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay" />
              <div className="absolute top-0 left-0 w-full h-[30%] bg-gradient-to-b from-blue-500/30 to-transparent blur-md animate-[scan_2.5s_ease-in-out_infinite]" />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_20px_rgba(96,165,250,1)] animate-[scan-line_2.5s_ease-in-out_infinite]" />

              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
                <div className="bg-zinc-950/80 backdrop-blur-xl px-6 py-4 rounded-xl shadow-2xl flex flex-col items-center border border-zinc-800/80 transform translate-y-4">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-3" />
                  <span className="text-white text-sm font-medium tracking-wide">
                    Analyzing Clinical Suitability
                  </span>
                  <span className="text-zinc-400 text-xs mt-1">
                    Checking lighting & focus...
                  </span>
                </div>
              </div>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes scan {
                  0% { transform: translateY(-100%); opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { transform: translateY(500%); opacity: 0; }
                }
                @keyframes scan-line {
                  0% { transform: translateY(-10px); }
                  100% { transform: translateY(800px); }
                }
              `}} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Portalled to <body>: inside the dashboard's z-0 stacking context the scanner rendered
          beneath the (portalled) Direct Capture dialog and could not be operated. */}
      {scannerView && createPortal(<BiometricScanner view={scannerView} gender={gender} onCapture={handleCapture} onClose={() => setScannerView(null)} />, document.body)}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  )
}
