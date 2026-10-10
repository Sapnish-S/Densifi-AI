"use client"

import { getPublicApiUrl } from "@/lib/api-url"
import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { ImagePlus, Send, Loader2, AlertCircle, Crown, ScanLine, ChevronRight, Lock, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getAgentMessages, getDailyCount, sendAgentMessage, saveAnalysisResult } from "@/app/actions/agent"
import { uploadProgressPhoto } from "@/app/actions/photos"
import { analyzeVaultImage, getVaultMonths, type AnalysisResult, type VaultMonth, type VaultPhoto } from "@/app/actions/telemetry"
import { getS3Url } from "@/lib/s3"
import { StagingCard } from "@/components/staging-card"
import { classifyStage, type GenderPreference } from "@/lib/staging"

function AiStarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 20l5-13 5 13" />
      <path d="M7 15h6" />
      <path d="M18 11v9" />
      <path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  photoId?: string | null
  createdAt: string
}

function ComparisonSlider({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const clampedMove = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setPosition(pct)
  }, [])

  const onMouseDown = () => { dragging.current = true }
  const onMouseMove = (e: React.MouseEvent) => { if (dragging.current) clampedMove(e.clientX) }
  const onMouseUp = () => { dragging.current = false }
  const onTouchMove = (e: React.TouchEvent) => clampedMove(e.touches[0].clientX)

  return (
    <div ref={containerRef} className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-sm border border-border/40 cursor-col-resize"
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onTouchMove={onTouchMove}>
      <div className="absolute inset-0">
        <Image src={after} alt="Current progress" fill sizes="600px" className="object-cover" />
        <div className="absolute bottom-2 right-2 rounded-sm bg-background/80 border border-border/40 px-2 py-1 text-[9px] font-semibold tracking-widest uppercase text-foreground/70 backdrop-blur-sm">Current Progress</div>
      </div>
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <div className="absolute inset-0" style={{ width: `${100 / (position / 100)}%` }}>
          <Image src={before} alt="Baseline" fill sizes="600px" className="object-cover" />
        </div>
        <div className="absolute bottom-2 left-2 rounded-sm bg-background/80 border border-border/40 px-2 py-1 text-[9px] font-semibold tracking-widest uppercase text-foreground/70 backdrop-blur-sm">Baseline</div>
      </div>
      <div className="absolute inset-y-0 z-10 flex items-center justify-center" style={{ left: `${position}%`, transform: "translateX(-50%)" }}>
        <div className="h-full w-px bg-foreground/50" />
        <div className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-foreground/30 bg-background/90 shadow-lg backdrop-blur-sm">
          <div className="flex gap-0.5"><div className="h-3 w-px bg-foreground/60" /><div className="h-3 w-px bg-foreground/60" /></div>
        </div>
      </div>
    </div>
  )
}

export function AgentView({ 
  user, 
  tier, 
  gender = "male",
  onGenderChange,
  onUpgrade,
  onForwardReport
}: { 
  user: { id: string; name: string; email: string }; 
  tier: "free" | "premium"; 
  gender?: GenderPreference;
  onGenderChange?: (gender: GenderPreference) => void;
  onUpgrade: () => void;
  onForwardReport?: (report: AnalysisResult) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [dailyCount, setDailyCount] = useState(0)
  const [input, setInput] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [vaults, setVaults] = useState<VaultMonth[]>([])
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dailyLimit = tier === "free" ? 1 : Infinity
  const limitReached = tier === "free" && dailyCount >= dailyLimit

  useEffect(() => {
    async function load() {
      try {
        const [msgs, count, v] = await Promise.all([getAgentMessages(), getDailyCount(), getVaultMonths()])
        setMessages(msgs)
        setDailyCount(count)
        // Sort vaults newest first
        setVaults([...v].sort((a, b) => b.id.localeCompare(a.id)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      setPhotoPreview(url)
      setPhotoDataUrl(url)
    }
    reader.readAsDataURL(file)
  }

  // 1. Find the absolutely most recent photo across ALL views
  const allPhotos = vaults.flatMap((v) => v.photos)
  allPhotos.sort((a, b) => new Date(a.taken_at || 0).getTime() - new Date(b.taken_at || 0).getTime())
  
  const currentPhoto = allPhotos.length > 0 ? allPhotos[allPhotos.length - 1] : null
  
  // 2. Find the baseline (oldest) photo that matches the exact same view (e.g. Crown) as the latest photo
  const baselinePhoto = currentPhoto 
    ? allPhotos.find(p => p.label === currentPhoto.label) 
    : null

  async function handleAnalyze() {
    setAnalysisError(null)
    setAnalyzing(true)
    try {
      if (!baselinePhoto || !currentPhoto) {
        throw new Error("You need at least two photos of the same view to perform a comparison analysis.")
      }
      if (baselinePhoto.id === currentPhoto.id) {
        throw new Error(`We found your latest ${currentPhoto.label} photo, but you need at least two ${currentPhoto.label} photos to compare progress.`)
      }
      if (!baselinePhoto.s3_key || !currentPhoto.s3_key) {
        throw new Error("Both Baseline and Latest photos must be uploaded to S3 to be analysed.")
      }

      const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const rawApiUrl = getPublicApiUrl();
      const apiUrl = rawApiUrl.replace(/\/+$/, "")
      const res = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          baseline_s3_key: baselinePhoto.s3_key,
          current_s3_key: currentPhoto.s3_key
        })
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "no body")
        console.error(`[analyze] API returned ${res.status}:`, text)
        throw new Error(`Analysis service returned ${res.status}`)
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error_message || "Analysis failed.")
      }
      setAnalysisResult(data as AnalysisResult)
      await saveAnalysisResult(currentPhoto.id, data)
      setShowReportModal(true)
    } catch (err: any) {
      setAnalysisError(err.message || "An unexpected error occurred.")
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSend() {
    if (!input.trim() && !photoDataUrl) return
    if (limitReached) return
    setSending(true)
    setError(null)
    try {
      let photoId: string | undefined
      if (photoDataUrl) {
        photoId = await uploadProgressPhoto(photoDataUrl, "crown")
      }
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input || "Please analyze my progress photo.", photoId: photoId ?? null, createdAt: new Date().toISOString() }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setPhotoPreview(null)
      setPhotoDataUrl(null)
      const reply = await sendAgentMessage(userMsg.content, photoId)
      const botMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: reply, createdAt: new Date().toISOString() }
      setMessages((prev) => [...prev, botMsg])
      if (tier === "free") setDailyCount((c) => c + 1)
    } catch (err: any) {
      const msg = err.message || "Something went wrong"
      if (msg === "DAILY_LIMIT_REACHED") {
        setError("You have used your free daily question. Upgrade to Pro for unlimited access.")
        setDailyCount(dailyLimit)
      } else setError(msg)
    } finally {
      setSending(false)
    }
  }

  // With presigned GET enabled, data_url already carries a signed URL.
  const usePublicUrl = process.env.NEXT_PUBLIC_VAULT_PRESIGNED_GET !== "true"
  const baselineSrc = baselinePhoto?.s3_key && usePublicUrl ? getS3Url(baselinePhoto.s3_key) : baselinePhoto?.data_url || "/placeholder.svg"
  const currentSrc = currentPhoto?.s3_key && usePublicUrl ? getS3Url(currentPhoto.s3_key) : currentPhoto?.data_url || "/placeholder.svg"

  return (
    <div className="space-y-5 max-w-3xl">
      {!analysisResult && (
        <div data-tutorial-id="tutorial-agent-module" className="glass rounded-sm overflow-hidden">
          <div className="border-b border-border/40 px-5 py-4">
            <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-1">AI Analysis Module</p>
            <h2 className="text-base font-semibold tracking-tight">Hair Analysis Agent</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">AI-powered visual comparison via Amazon Bedrock (Claude 4.5 Sonnet + Nova Lite).</p>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Compare your <span className="text-foreground font-medium">Baseline</span> and <span className="text-foreground font-medium">Latest</span> captures side-by-side with an AI clinical breakdown of density and miniaturization changes.
              </p>
              {analysisError && <p className="text-xs text-destructive mt-2">{analysisError}</p>}
            </div>
            <Button className="shrink-0 gap-2 h-9 px-5 text-[11px] font-semibold tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all duration-200"
              onClick={handleAnalyze} disabled={analyzing || loading || vaults.length === 0}>
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
              {analyzing ? "Analyzing…" : "Analyze Latest Progress"}
            </Button>
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="space-y-4">
          <div className="glass rounded-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
              <div>
                <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-0.5">Visual Comparison</p>
                <p className="text-xs font-semibold">Baseline vs. Current Progress ({currentPhoto?.label || 'Front'} View)</p>
              </div>
              <span className="text-[9px] tracking-widest uppercase text-muted-foreground/50">Drag to compare</span>
            </div>
            <div className="p-4"><ComparisonSlider before={baselineSrc} after={currentSrc} /></div>
          </div>

          <div className="glass rounded-sm overflow-hidden">
            <div className="border-b border-border/40 px-5 py-3.5 flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm border border-border/40 bg-card/60">
                <AiStarIcon className="h-3.5 w-3.5 text-foreground/50" />
              </div>
              <div><p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">AI Clinical Summary</p></div>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{analysisResult.clinical_summary}</p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-sm border border-border/30 bg-card/50 p-3.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Density Estimate</p>
                  <p className="font-mono text-2xl font-semibold text-foreground">{analysisResult.density_percentage}%</p>
                </div>
                <div className="rounded-sm border border-border/30 bg-card/50 p-3.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Miniaturization</p>
                  <p className="font-mono text-2xl font-semibold text-chart-4">{Math.round(analysisResult.miniaturization_index * 100)}%</p>
                </div>
              </div>

              {analysisResult.model_chain.length > 0 && (
                <div className="mt-4 border-t border-border/30 pt-4">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Inference Chain</p>
                  <div className="flex gap-2 text-[10px] font-mono text-muted-foreground">
                    {analysisResult.model_chain.join(" → ")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clinical Staging Assessment (Norwood for Men / Ludwig for Women) */}
          <StagingCard
            densityPercentage={analysisResult.density_percentage}
            miniaturizationIndex={analysisResult.miniaturization_index}
            initialGender={gender}
            onGenderChange={onGenderChange}
          />

          <button onClick={() => setAnalysisResult(null)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground tracking-widest uppercase transition-colors">
            <ChevronRight className="h-3 w-3 rotate-180" /> Run new analysis
          </button>
        </div>
      )}

      {/* Chat Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Follow-Up Chat</p>
          {tier === "free" && (
            <span className={cn("text-[9px] font-semibold tracking-[0.16em] uppercase border px-2 py-1 rounded-sm", limitReached ? "border-destructive/40 text-destructive/80 bg-destructive/8" : "border-border/60 text-muted-foreground bg-card")}>
              {dailyCount}/{dailyLimit} today
            </span>
          )}
        </div>
        <div className="glass rounded-sm overflow-hidden" style={{ minHeight: "220px" }}>
          <div className="max-h-72 overflow-y-auto p-4 space-y-4">
            {loading && <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" /></div>}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-border/40 bg-card/60"><AiStarIcon className="h-4 w-4 text-foreground/30" /></div>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">Ask follow-up questions about your results, diet, protocol adjustments, or anything else about your hair restoration journey.</p>
              </div>
            )}
            {messages.map((msg) => {
              let displayContent = msg.content
              try {
                if (msg.role === "assistant" && msg.content.trim().startsWith("{")) {
                  const parsed = JSON.parse(msg.content)
                  if (parsed.raw_vision_output) {
                    displayContent = parsed.raw_vision_output
                  } else if (parsed.clinical_summary) {
                    displayContent = parsed.clinical_summary
                  }
                }
              } catch (e) {}

              return (
                <div key={msg.id} className={cn("flex gap-3 max-w-[85%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto")}>
                  {msg.role === "assistant" && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border/40 bg-card/60 mt-0.5"><AiStarIcon className="h-3.5 w-3.5 text-foreground/50" /></div>}
                  <div className={cn("rounded-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap", msg.role === "user" ? "bg-foreground text-background shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "bg-secondary/40 border border-border/40 text-foreground")}>{displayContent}</div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        </div>
        {limitReached && tier === "free" && (
          <div className="flex items-start gap-3 rounded-sm border border-destructive/30 bg-destructive/8 p-3">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-wide text-destructive">Daily question limit reached</p>
              <p className="text-[10px] text-destructive/70 mt-0.5 leading-relaxed">Upgrade to Densify Pro for unlimited AI conversations, lab tracking, and full analytics.</p>
            </div>
            <Button size="sm" onClick={onUpgrade} className="shrink-0 h-7 text-[10px] tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90">Upgrade</Button>
          </div>
        )}
        {error && !limitReached && <p className="text-xs text-destructive tracking-wide">{error}</p>}
        {tier === "free" && !limitReached && (
          <div className="relative">
            <div className="pointer-events-none select-none blur-[2px] opacity-40" aria-hidden="true">
              <div className="flex gap-2"><div className="h-9 flex-1 rounded-sm border border-border/50 bg-card/60" /><div className="h-9 w-9 rounded-sm bg-foreground/10 border border-border/50" /></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="glass rounded-sm flex items-center gap-3 px-4 py-2.5 w-full">
                <Lock className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                <p className="text-[11px] text-muted-foreground flex-1 leading-relaxed"><span className="font-semibold text-foreground/70">Upgrade to Densify Pro</span> to chat with the Hair Agent, ask follow-up questions about diet, custom protocols, and receive direct expert guidance.</p>
                <Button size="sm" onClick={onUpgrade} className="shrink-0 h-7 gap-1.5 text-[10px] tracking-widest uppercase rounded-sm bg-foreground text-background hover:bg-foreground/90"><Crown className="h-3 w-3" />Pro</Button>
              </div>
            </div>
          </div>
        )}
        {tier === "premium" && (
          <>
            {photoPreview && (
              <div className="relative w-14 h-14 rounded-sm overflow-hidden border border-border/40">
                <img src={photoPreview} alt="Selected photo" className="w-full h-full object-cover" />
                <button onClick={() => { setPhotoPreview(null); setPhotoDataUrl(null) }} className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-sm bg-background/90 text-foreground text-[10px] hover:bg-background border border-border/40">×</button>
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-border/50 rounded-sm hover:border-foreground/30 transition-all" onClick={() => fileRef.current?.click()} disabled={sending}><ImagePlus className="h-3.5 w-3.5" /></Button>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder="Ask about your progress, diet, protocol…" disabled={sending} className="flex-1 h-9 rounded-sm border border-border/50 bg-card/60 px-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring backdrop-blur-sm" />
              <Button size="icon" className="h-9 w-9 shrink-0 rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-all" onClick={handleSend} disabled={sending || (!input.trim() && !photoDataUrl)}>{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}</Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="sm:max-w-md rounded-sm border-border/40 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary/30 bg-primary/10">
                <ScanLine className="h-4 w-4 text-primary" />
              </div>
              Analysis Complete
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Your AI progress report has been successfully generated.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-sm border border-border/30 bg-card/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Est. Density</p>
                <p className="font-mono text-lg font-semibold text-foreground">{analysisResult?.density_percentage}%</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Miniaturization</p>
                <p className="font-mono text-lg font-semibold text-chart-4">{Math.round((analysisResult?.miniaturization_index || 0) * 100)}%</p>
              </div>
              {analysisResult && (() => {
                const stage = classifyStage(analysisResult.density_percentage, analysisResult.miniaturization_index, gender)
                return (
                  <div className="border-t border-border/20 pt-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {gender === "male" ? "Norwood Scale" : "Ludwig Scale"}
                      </p>
                      <p className="text-xs font-semibold text-foreground">
                        {stage.stageLabel} · {stage.title}
                      </p>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-xs border border-foreground/20 bg-foreground/10 text-foreground font-semibold uppercase">
                      {stage.severity}
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>
          <DialogFooter className="sm:justify-between flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-sm border-border/40 hover:bg-foreground/5 text-xs tracking-wide uppercase"
              onClick={() => setShowReportModal(false)}
            >
              View Results Here
            </Button>
            <Button
              type="button"
              className="rounded-sm bg-foreground text-background hover:bg-foreground/90 text-xs tracking-wide uppercase gap-2"
              onClick={() => {
                setShowReportModal(false)
                if (analysisResult && onForwardReport) {
                  onForwardReport(analysisResult)
                }
              }}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              Forward to Clinician
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
