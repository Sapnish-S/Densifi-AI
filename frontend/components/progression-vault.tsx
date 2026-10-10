"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Camera,
  Crosshair,
  Check,
  Scan,
  ExternalLink,
  Package,
  Star,
  Image as ImageIcon
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getVaultMonths, type VaultMonth, type VaultPhoto } from "@/app/actions/telemetry"
import { getS3Url } from "@/lib/s3"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Selected {
  vault: VaultMonth
  photo: VaultPhoto
}

interface ProtocolItem {
  id: string
  name: string
  category: string
  description: string
  usage: string
  affiliateUrl: string
  imageUrl: string
  rating: number
}

// ── Protocol supply list ──────────────────────────────────────────────────────

const PROTOCOL_ITEMS: ProtocolItem[] = [
  {
    id: "minoxidil",
    name: "Minoxidil 5% Topical",
    category: "Vasodilator",
    description: "FDA-approved topical solution clinically proven to stimulate follicular re-growth and widen blood vessels around the scalp.",
    usage: "1 mL · Twice daily",
    affiliateUrl: "https://www.amazon.com/s?k=minoxidil+5+percent+topical",
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    rating: 4.8,
  },
  {
    id: "keto",
    name: "Ketoconazole 2% Shampoo",
    category: "Anti-fungal",
    description: "Reduces scalp DHT via anti-androgenic activity. Studies show comparable efficacy to 2% minoxidil in certain populations.",
    usage: "3–4 min contact · 2–3× per week",
    affiliateUrl: "https://www.amazon.com/s?k=ketoconazole+shampoo+2+percent",
    imageUrl: "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=400&q=80",
    rating: 4.7,
  },

  {
    id: "biotin",
    name: "Biotin + Collagen Complex",
    category: "Nutraceutical",
    description: "High-dose biotin (10 000 mcg) paired with hydrolysed collagen peptides to reinforce the structural integrity of the hair shaft.",
    usage: "2 capsules · Daily with food",
    affiliateUrl: "https://www.amazon.com/s?k=biotin+10000mcg+collagen+hair",
    imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&q=80",
    rating: 4.6,
  },
]

// ── Alignment overlay (reused from vault-panel) ───────────────────────────────

function AlignmentOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-primary/40" />
      <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-primary/40" />
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-primary/60" />
      <div className="absolute left-4 top-4 h-4 w-4 border-l-2 border-t-2 border-primary/70" />
      <div className="absolute right-4 top-4 h-4 w-4 border-r-2 border-t-2 border-primary/70" />
      <div className="absolute left-4 bottom-4 h-4 w-4 border-l-2 border-b-2 border-primary/70" />
      <div className="absolute right-4 bottom-4 h-4 w-4 border-r-2 border-b-2 border-primary/70" />
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
        <span className="flex items-center gap-1">
          <Crosshair className="h-3 w-3" /> Day 1 Alignment Guide
        </span>
      </div>
    </div>
  )
}

// ── Photo comparison card ─────────────────────────────────────────────────────

function ComparisonPhotoCard({
  label,
  date,
  src,
  onClick,
}: {
  label: string
  date: string
  src: string | null
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!src}
      className="group relative flex-1 min-w-0 aspect-[3/4] overflow-hidden rounded-xl border border-border/40 bg-card hover:border-foreground/30 transition-all duration-300 disabled:cursor-default shadow-sm"
    >
      {src ? (
        <Image
          src={src}
          alt={`${label} photo`}
          fill
          sizes="(max-width: 768px) 45vw, 260px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/5">
          <Camera className="h-8 w-8 text-muted-foreground/20" />
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground/30">No photo</p>
        </div>
      )}

      {/* Bottom overlay badge */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/80 mb-0.5 drop-shadow-sm">{label}</p>
            {date && (
              <p className="font-mono text-xs font-semibold text-white drop-shadow-sm">{date}</p>
            )}
          </div>
          <div className="rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[9px] font-semibold tracking-widest uppercase text-white/90 backdrop-blur-md">
            {label === "Baseline" ? "Day 1" : "Latest"}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Protocol supply component ─────────────────────────────────────────────────

function ProtocolSupply() {
  return (
    <div className="flex flex-col h-full bg-card/40">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/40 bg-card/60 shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background shadow-sm">
          <Package className="h-4 w-4 text-foreground/70" />
        </div>
        <div>
          <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-0.5">
            Densify Protocol
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground leading-none">
            Clinical Supply
          </h2>
        </div>
      </div>

      {/* Body with Independent Scroll */}
      <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/50 hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
        {PROTOCOL_ITEMS.map((item) => (
          <div key={item.id} className="group relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-border/40 bg-card hover:bg-secondary/20 hover:border-border/60 transition-all duration-300 shadow-sm">

            {/* Square Product Thumbnail */}
            <div className="relative shrink-0 w-full sm:w-24 aspect-square rounded-lg overflow-hidden border border-border/40 bg-secondary/30">
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 100vw, 96px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Product Details */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block rounded border border-border/40 bg-secondary/40 px-1.5 py-px text-[9px] font-semibold tracking-wider uppercase text-muted-foreground">
                      {item.category}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-foreground/70">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {item.rating}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-muted-foreground mt-1 mb-3 line-clamp-2">
                {item.description}
              </p>

              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono tracking-wide text-foreground/50 bg-secondary/30 border border-border/30 rounded px-2 py-1">
                  {item.usage}
                </span>
                <a
                  href={item.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background hover:bg-foreground hover:text-background px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all duration-200 shadow-sm"
                >
                  View on Amazon
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* Disclaimer */}
        <p className="pt-2 pb-4 text-[10px] text-center leading-relaxed text-muted-foreground/40">
          Links may be affiliate links. Densify earns a small commission at no extra cost to you. Always consult a dermatologist before starting a new regimen.
        </p>
      </div>
    </div>
  )
}

// ── Main exported component ───────────────────────────────────────────────────

export function ProgressionVaultCard({
  onNavigate,
  hasData = true,
}: {
  onNavigate?: (v: string) => void
  hasData?: boolean
}) {
  const [vaults, setVaults] = useState<VaultMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Selected | null>(null)

  useEffect(() => {
    getVaultMonths()
      .then((data) => {
        setVaults(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch vault months:", err)
        setError(true)
        setLoading(false)
      })
  }, [])

  // ── Derive baseline & current from all Front photos across all months ──────────────
  const allPhotos: { photo: VaultPhoto; vault: VaultMonth }[] = vaults.flatMap((vault) =>
    vault.photos
      .filter((photo) => photo.label === 'Front')
      .map((photo) => ({ photo, vault })),
  )
  // Sort ascending by taken_at to reliably find oldest / newest
  allPhotos.sort(
    (a, b) =>
      new Date(a.photo.taken_at || 0).getTime() -
      new Date(b.photo.taken_at || 0).getTime(),
  )

  const baselineEntry = allPhotos.length > 0 ? allPhotos[0] : null
  const currentEntry = allPhotos.length > 1 ? allPhotos[allPhotos.length - 1] : null
  const hasTwoPhotos = allPhotos.length >= 2

  function photoSrc(entry: { photo: VaultPhoto } | null): string | null {
    if (!entry) return null
    return entry.photo.data_url || null
  }

  function photoDate(entry: { photo: VaultPhoto } | null): string {
    if (!entry?.photo.taken_at) return ""
    const d = new Date(entry.photo.taken_at)
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-pulse">
        <div className="glass rounded-xl h-[450px] bg-card/40 border border-border/40 p-5">
          <div className="h-4 w-1/3 bg-foreground/10 rounded mb-4" />
        </div>
        <div className="glass rounded-xl h-[450px] bg-card/40 border border-border/40 p-5">
          <div className="h-4 w-1/3 bg-foreground/10 rounded mb-4" />
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────────

  if (error && hasData) {
    return (
      <div className="glass rounded-xl bg-card/40 border border-destructive/20 p-5 flex flex-col items-center justify-center text-center h-[320px]">
        <Scan className="h-8 w-8 text-destructive/40 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Failed to Load Vault</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Unable to fetch vault data at the moment. Please try again later.
        </p>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div data-tutorial-id="tutorial-vault" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

      {/* ── LEFT CONTAINER: Interactive Progression Archive ── */}
      <div className="glass rounded-xl overflow-hidden border border-border/40 bg-card/30 shadow-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border/40 bg-card/60 px-5 py-5 shrink-0">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-1">
              Visual Progression
            </p>
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-foreground/60" />
              Interactive Archive
            </h2>
          </div>
          {hasTwoPhotos && (
            <div className="hidden sm:flex items-center gap-1.5 rounded border border-chart-4/30 bg-chart-4/10 px-2.5 py-1">
              <Check className="h-3 w-3 text-chart-4" />
              <span className="text-[9px] font-semibold tracking-widest uppercase text-chart-4">
                Active Comparison
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 p-5 lg:p-6 bg-card/20 flex flex-col justify-center min-h-[300px]">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/80 mb-4">
            Baseline vs. Current
          </p>

          {vaults.length === 0 ? (
            /* No photos at all */
            <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-xl bg-card/40 py-12 px-4 shadow-inner">
              <Scan className="h-10 w-10 text-foreground/20 mb-4" />
              <p className="text-sm font-semibold text-foreground mb-1.5">No biometric scans yet</p>
              <p className="text-xs text-muted-foreground mb-6 max-w-xs leading-relaxed">
                Take your first photo to initialise your Miniaturization Matrix and unlock your progression archive.
              </p>
              <Button
                onClick={() => onNavigate?.("vault")}
                className="bg-foreground text-background hover:bg-foreground/90 font-semibold tracking-widest text-[11px] uppercase h-10 px-8 rounded-lg shadow-md transition-all"
              >
                Scan Biometric Photo
              </Button>
            </div>
          ) : !hasTwoPhotos ? (
            /* Only 1 photo — show baseline + unlock prompt */
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex gap-4 h-full">
                <ComparisonPhotoCard
                  label="Baseline"
                  date={photoDate(baselineEntry)}
                  src={photoSrc(baselineEntry)}
                  onClick={
                    baselineEntry
                      ? () => setSelected({ vault: baselineEntry.vault, photo: baselineEntry.photo })
                      : undefined
                  }
                />
                {/* Placeholder for current */}
                <div className="flex-1 aspect-[3/4] rounded-xl border border-dashed border-border/50 bg-card/40 flex flex-col items-center justify-center text-center px-5 shadow-inner">
                  <Camera className="h-8 w-8 text-muted-foreground/30 mb-4" />
                  <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground/60 mb-2">
                    Current
                  </p>
                  <p className="text-xs text-muted-foreground/50 leading-relaxed max-w-[140px]">
                    Upload your next photo to unlock progression comparison
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Two or more photos — full comparison */
            <div className="flex-1 flex gap-4">
              <ComparisonPhotoCard
                label="Baseline"
                date={photoDate(baselineEntry)}
                src={photoSrc(baselineEntry)}
                onClick={
                  baselineEntry
                    ? () => setSelected({ vault: baselineEntry.vault, photo: baselineEntry.photo })
                    : undefined
                }
              />
              <ComparisonPhotoCard
                label="Current"
                date={photoDate(currentEntry)}
                src={photoSrc(currentEntry)}
                onClick={
                  currentEntry
                    ? () => setSelected({ vault: currentEntry.vault, photo: currentEntry.photo })
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT CONTAINER: Densify Clinical Supply ── */}
      <div className="glass rounded-xl overflow-hidden border border-border/40 bg-card/30 shadow-sm max-h-[600px] lg:max-h-[580px] xl:max-h-[650px] flex flex-col">
        <ProtocolSupply />
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg border-border/60 bg-card/95 backdrop-blur-xl rounded-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                  <Camera className="h-4 w-4 text-foreground/60" />
                  {selected.photo.label} View · {selected.vault.month}
                </DialogTitle>
                <DialogDescription className="text-pretty text-xs leading-relaxed">
                  Guided Camera Alignment Overlay — confirm this capture matches your Day 1 baseline
                  framing for an accurate progression comparison.
                </DialogDescription>
              </DialogHeader>

              <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-lg border border-border/40 shadow-sm">
                {selected.photo.data_url ? (
                  <Image
                    src={selected.photo.data_url || "/placeholder.svg"}
                    alt={`${selected.photo.label} high resolution`}
                    fill
                    sizes="300px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 animate-pulse bg-foreground/5" />
                )}
                <AlignmentOverlay />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-4 py-3">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="text-muted-foreground tracking-wide">Captured</span>
                  <span className="rounded-[4px] border border-border/60 bg-background px-2.5 py-1 font-mono font-semibold text-foreground shadow-sm">
                    {new Date(selected.photo.taken_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase text-chart-4 bg-chart-4/10 px-2.5 py-1 rounded">
                  <Check className="h-3 w-3" />
                  Aligned
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
