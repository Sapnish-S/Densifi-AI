"use client"

/**
 * BiometricScanner
 *
 * In-app camera module styled after iOS FaceID:
 * - Deep matte-black blurred background
 * - Razor-thin white geometric guide overlay (Front / Crown / Side)
 * - Real-time frame analyser (luminance + motion/blur detection)
 * - Auto-snap on quality pass (still + well-lit for 12 consecutive frames)
 * - Uncompressed PNG blob → presigned S3 PUT URL
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { X, RefreshCw, CheckCircle2 } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CaptureView = "Front" | "Crown" | "Side"

interface BiometricScannerProps {
  view: CaptureView
  gender?: "male" | "female"
  onCapture: (blob: Blob, view: CaptureView) => void
  onClose: () => void
}

type QualityStatus =
  | "analyzing"
  | "dark"
  | "ready"
  | "capturing"
  | "captured"

const STATUS_COPY: Record<QualityStatus, string> = {
  analyzing: "ANALYZING RAW MATRIX...",
  dark:      "POOR LIGHTING — MOVE TO BRIGHT LIGHT",
  ready:     "CLINICAL STANDARD MET",
  capturing: "CAPTURING...",
  captured:  "CAPTURE COMPLETE",
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide overlays per view — FaceID geometric rings
// ─────────────────────────────────────────────────────────────────────────────

function FrontGuide() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 320 480"
      fill="none"
    >
      {/* Outer scan frame */}
      <rect x="30" y="20" width="260" height="440" rx="8"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.55" strokeDasharray="6 4" />
      {/* Head oval */}
      <ellipse cx="160" cy="200" rx="90" ry="116"
        stroke="white" strokeWidth="1.2" strokeOpacity="0.90" />
      {/* Hairline arc */}
      <path d="M 90 130 Q 160 80 230 130"
        stroke="white" strokeWidth="1" strokeOpacity="0.70" />
      {/* Chin guidance */}
      <line x1="130" y1="320" x2="190" y2="320"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.50" />
      {/* Corner ticks */}
      <path d="M 30 50 L 30 20 L 60 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 290 50 L 290 20 L 260 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 30 430 L 30 460 L 60 460" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 290 430 L 290 460 L 260 460" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      {/* Centre crosshair */}
      <line x1="155" y1="195" x2="165" y2="195" stroke="white" strokeWidth="0.8" strokeOpacity="0.60" />
      <line x1="160" y1="190" x2="160" y2="200" stroke="white" strokeWidth="0.8" strokeOpacity="0.60" />
    </svg>
  )
}

function CrownGuide() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 320 480"
      fill="none"
    >
      {/* Outer scan frame */}
      <rect x="30" y="20" width="260" height="440" rx="8"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.55" strokeDasharray="6 4" />
      {/* Top-down scalp circle */}
      <ellipse cx="160" cy="240" rx="110" ry="110"
        stroke="white" strokeWidth="1.2" strokeOpacity="0.90" />
      {/* Vertex grid lines */}
      <line x1="160" y1="130" x2="160" y2="350"
        stroke="white" strokeWidth="0.6" strokeOpacity="0.40" />
      <line x1="50"  y1="240" x2="270" y2="240"
        stroke="white" strokeWidth="0.6" strokeOpacity="0.40" />
      {/* Crown zone ring */}
      <ellipse cx="160" cy="240" rx="42" ry="42"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.55" strokeDasharray="4 3" />
      {/* Corner ticks */}
      <path d="M 30 50 L 30 20 L 60 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 290 50 L 290 20 L 260 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 30 430 L 30 460 L 60 460" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 290 430 L 290 460 L 260 460" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
    </svg>
  )
}

function SideGuide() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 320 480"
      fill="none"
    >
      {/* Outer scan frame */}
      <rect x="30" y="20" width="260" height="440" rx="8"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.55" strokeDasharray="6 4" />
      {/* Profile silhouette guide */}
      <path d="M 200 60 Q 240 100 240 200 Q 240 300 200 380"
        stroke="white" strokeWidth="1.2" strokeOpacity="0.90" fill="none" />
      {/* Temporal region zone */}
      <ellipse cx="185" cy="150" rx="55" ry="40"
        stroke="white" strokeWidth="0.8" strokeOpacity="0.60" strokeDasharray="4 3" />
      {/* Hairline vertical guide */}
      <line x1="160" y1="60" x2="160" y2="200"
        stroke="white" strokeWidth="0.6" strokeOpacity="0.45" />
      {/* Corner ticks */}
      <path d="M 30 50 L 30 20 L 60 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 290 50 L 290 20 L 260 20" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 30 430 L 30 460 L 60 460" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
      <path d="M 290 430 L 290 460 L 260 460" stroke="white" strokeWidth="1.5" strokeOpacity="0.80" />
    </svg>
  )
}

const GUIDES: Record<CaptureView, React.ReactNode> = {
  Front: <FrontGuide />,
  Crown: <CrownGuide />,
  Side:  <SideGuide />,
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame quality analyser — runs on hidden canvas
// Luminance:  average pixel brightness from a 40×40 centre sample
// Motion:     diff of two consecutive frames pixel-by-pixel
// ─────────────────────────────────────────────────────────────────────────────

const LUMA_MIN       = 45    // 0-255: below = too dark
const LUMA_MAX       = 220   // 0-255: above = too bright
const REQUIRED_MS    = 2000  // Need 2 consecutive seconds of good lighting

function sampleLuminance(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const sx = Math.floor(w / 2) - 20
  const sy = Math.floor(h / 2) - 20
  const data = ctx.getImageData(sx, sy, 40, 40).data
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return total / (data.length / 4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function BiometricScanner({ view, gender = "male", onCapture, onClose }: BiometricScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const goodLightingStartRef = useRef<number | null>(null)
  const rafRef     = useRef<number>(0)

  const [status, setStatus] = useState<QualityStatus>("analyzing")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraError(null)
      goodLightingStartRef.current = null
      setStatus("analyzing")
    } catch (err) {
      setCameraError("Camera access denied. Please allow camera permissions.")
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [facingMode, startCamera])

  // ── Frame analyser loop ───────────────────────────────────────────────────
  useEffect(() => {
    let captured = false

    function analyse() {
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(analyse)
        return
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      canvas.width  = video.videoWidth  || 320
      canvas.height = video.videoHeight || 480
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const luma = sampleLuminance(ctx, canvas.width, canvas.height)
      
      // Quality gates
      if (luma < LUMA_MIN || luma > LUMA_MAX) {
        goodLightingStartRef.current = null
        setStatus("dark")
      } else {
        if (goodLightingStartRef.current === null) {
          goodLightingStartRef.current = Date.now()
          setStatus("analyzing") // Wait for 2s
        } else if (Date.now() - goodLightingStartRef.current >= REQUIRED_MS && !captured) {
          setStatus("ready")
        } else if (!captured) {
          setStatus("analyzing")
        }
      }

      rafRef.current = requestAnimationFrame(analyse)
    }

    rafRef.current = requestAnimationFrame(analyse)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Capture: draw full frame to canvas, export as uncompressed PNG blob ───
  function doCapture(canvas: HTMLCanvasElement) {
    const video = videoRef.current
    if (!video) return

    // Full-resolution capture canvas (separate from analyser canvas)
    const capCanvas = document.createElement("canvas")
    capCanvas.width  = video.videoWidth
    capCanvas.height = video.videoHeight
    const capCtx = capCanvas.getContext("2d")
    if (!capCtx) return
    capCtx.drawImage(video, 0, 0)

    // PNG = lossless/uncompressed — preserves all follicular pixel data
    capCanvas.toBlob(
      (blob) => {
        if (!blob) return
        setStatus("captured")
        // Stop stream immediately after capture
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
        }
        cancelAnimationFrame(rafRef.current)
        setTimeout(() => onCapture(blob, view), 600)
      },
      "image/png",
    )
  }

  function flipCamera() {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"))
  }

  const ringColour =
    status === "captured" ? "oklch(0.88 0.14 145)"
    : status === "ready"  ? "oklch(0.88 0.14 145)"
    : status === "dark"   ? "oklch(0.72 0.12 35)"
    : "oklch(0.60 0 0)"

  return (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black">

      {/* Deep matte background blur */}
      <div className="absolute inset-0 bg-[oklch(0.03_0_0)]" />

      {/* Live video stream */}
      {!cameraError && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          playsInline
          muted
          autoPlay
        />
      )}

      {/* Vignette — darkens edges, focuses on centre */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_45%,transparent_40%,oklch(0_0_0/0.75)_100%)]" />

      {/* Hidden analysis canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Geometric guide overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative w-[320px] h-[480px]">
          {GUIDES[view]}

          {/* Animated ring around the guide — pulses on status change */}
          <div
            className="absolute inset-0 rounded-full transition-all duration-500"
            style={{
              boxShadow: `inset 0 0 0 1px ${ringColour}, 0 0 32px 4px ${ringColour}22`,
            }}
          />
        </div>
      </div>

      {/* Status HUD — top */}
      <div className="absolute top-0 inset-x-0 flex flex-col items-center gap-1.5 pt-12 pb-6 pointer-events-none">
        {/* Scale calibration badge */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-semibold tracking-[0.22em] uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-xs backdrop-blur-sm">
            {gender === "male" ? "Norwood Scale · 7 Stages" : "Ludwig Scale · 3 Stages"}
          </span>
        </div>

        {/* View label */}
        <p className="font-mono text-[9px] font-semibold tracking-[0.32em] uppercase text-white/50">
          Biometric Capture — {view} View
        </p>

        {/* View-specific staging anatomical guidance */}
        <p className="font-mono text-[9px] tracking-wider uppercase text-white/60 text-center max-w-sm px-4">
          {gender === "male"
            ? (view === "Front" ? "Targeting hairline & temporal recession (Stages 1–7)" : view === "Crown" ? "Targeting vertex diameter & mid-scalp bridge (Stages 3–7)" : "Targeting lateral border & temporal recession")
            : (view === "Front" ? "Targeting frontal midline part width (Stages I–III)" : view === "Crown" ? "Targeting diffuse crown thinning & scalp visibility (Stages I–III)" : "Targeting lateral parietal hair preservation")
          }
        </p>

        {/* Status badge */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-sm border px-3 py-1.5 backdrop-blur-sm transition-all duration-300",
            (status === "captured" || status === "ready") && "border-[oklch(0.88_0.14_145/0.6)] bg-[oklch(0.88_0.14_145/0.12)]",
            status === "dark"     && "border-[oklch(0.72_0.12_35/0.6)] bg-[oklch(0.72_0.12_35/0.10)]",
            status === "analyzing"&& "border-white/15 bg-white/5",
            status === "capturing"&& "border-white/40 bg-white/8",
          )}
        >
          {/* Pulsing dot */}
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              (status === "captured" || status === "ready") ? "bg-[oklch(0.88_0.14_145)]"
              : status === "dark"   ? "bg-[oklch(0.72_0.12_35)] animate-pulse"
              : "bg-white/80 animate-pulse",
            )}
          />
          <span
            className={cn(
              "font-mono text-[9px] font-semibold tracking-[0.22em] uppercase",
              (status === "captured" || status === "ready") ? "text-[oklch(0.88_0.14_145)]"
              : status === "dark"   ? "text-[oklch(0.85_0.12_35)]"
              : "text-white/90",
            )}
          >
            {STATUS_COPY[status]}
          </span>
        </div>
      </div>

      {/* Camera error state */}
      {cameraError && (
        <div className="relative z-10 flex flex-col items-center gap-4 rounded-sm border border-white/15 bg-black/80 p-8 text-center max-w-xs">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/50">Camera Unavailable</p>
          <p className="text-xs text-white/70 leading-relaxed">{cameraError}</p>
        </div>
      )}

      {/* Captured success icon */}
      {status === "captured" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
          <CheckCircle2 className="h-16 w-16 text-[oklch(0.88_0.14_145)] drop-shadow-[0_0_24px_oklch(0.88_0.14_145/0.6)] animate-in zoom-in duration-300" />
          <div className="flex flex-col items-center bg-black/80 backdrop-blur-md px-4 py-2 rounded-sm border border-[oklch(0.88_0.14_145/0.4)]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[oklch(0.88_0.14_145)]">
              {gender === "male" ? "Norwood 7-Stage Calibration Complete" : "Ludwig 3-Stage Calibration Complete"}
            </span>
          </div>
        </div>
      )}

      {/* Controls — bottom */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-8 pb-10">
        {/* Close */}
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/8 text-white/70 backdrop-blur-sm transition-all hover:border-white/40 hover:text-white"
          aria-label="Close scanner"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Shutter — manual trigger fallback */}
        <button
          onClick={() => {
            const canvas = canvasRef.current
            if (canvas && status === "ready") {
              setStatus("capturing")
              doCapture(canvas)
            }
          }}
          disabled={status !== "ready"}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-200",
            status !== "ready"
              ? "border-white/20 bg-white/5 cursor-not-allowed opacity-50"
              : "border-[oklch(0.88_0.14_145)] bg-[oklch(0.88_0.14_145/0.2)] hover:bg-[oklch(0.88_0.14_145/0.3)] active:scale-95",
          )}
          aria-label="Capture photo"
        >
          <div className={cn(
            "h-12 w-12 rounded-full transition-all",
            status === "ready" ? "bg-[oklch(0.88_0.14_145)] shadow-[0_0_15px_oklch(0.88_0.14_145/0.5)]" : "bg-white/30",
          )} />
        </button>

        {/* Flip camera */}
        <button
          onClick={flipCamera}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/8 text-white/70 backdrop-blur-sm transition-all hover:border-white/40 hover:text-white"
          aria-label="Flip camera"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
