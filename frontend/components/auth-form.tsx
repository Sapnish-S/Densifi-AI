"use client"

import { getPublicApiUrl } from "@/lib/api-url"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Stethoscope, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { DensifyLogomark } from "@/components/densify-logomark"

// ── Follicular Data Regeneration Animation ────────────────────────────────────

const NODE_COUNT = 28
const EDGE_COUNT = 34

interface AnimNode {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
  speed: number
}

interface AnimEdge {
  a: number
  b: number
  progress: number
  dir: 1 | -1
  speed: number
}

function useFollicularAnimation(w: number, h: number) {
  const nodesRef = useRef<AnimNode[]>([])
  const edgesRef  = useRef<AnimEdge[]>([])
  const frameRef  = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!w || !h) return
    // Seed nodes
    nodesRef.current = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 1.5 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.008 + Math.random() * 0.012,
    }))
    // Seed edges — random pairs
    edgesRef.current = Array.from({ length: EDGE_COUNT }, () => ({
      a: Math.floor(Math.random() * NODE_COUNT),
      b: Math.floor(Math.random() * NODE_COUNT),
      progress: Math.random(),
      dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
      speed: 0.0015 + Math.random() * 0.003,
    }))
  }, [w, h])

  function tick(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const nodes = nodesRef.current
    const edges = edgesRef.current
    const t = performance.now() / 1000

    // Move nodes
    for (const n of nodes) {
      n.x += n.vx
      n.y += n.vy
      if (n.x < 0 || n.x > W) n.vx *= -1
      if (n.y < 0 || n.y > H) n.vy *= -1
    }

    // Draw edges (data lines)
    for (const e of edges) {
      e.progress = (e.progress + e.speed * e.dir + 1) % 1
      const na = nodes[e.a]
      const nb = nodes[e.b]
      if (!na || !nb) continue
      const dx = nb.x - na.x
      const dy = nb.y - na.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > W * 0.65) continue // skip very long edges

      const alpha = 0.06 + 0.10 * Math.abs(Math.sin(t * 0.4 + e.a))

      // Base line — very faint
      ctx.beginPath()
      ctx.moveTo(na.x, na.y)
      ctx.lineTo(nb.x, nb.y)
      ctx.strokeStyle = `oklch(0.88 0 0 / ${alpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Travelling data packet — bright dot moving along the line
      const px = na.x + dx * e.progress
      const py = na.y + dy * e.progress
      const packetAlpha = 0.55 + 0.45 * Math.sin(t * 1.2 + e.b)
      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `oklch(0.96 0 0 / ${packetAlpha})`
      ctx.fill()
    }

    // Draw nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * n.speed * 60 + n.phase))
      const glow = 0.15 + 0.25 * pulse

      // Outer glow ring
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5)
      grad.addColorStop(0, `oklch(0.96 0 0 / ${glow})`)
      grad.addColorStop(1, `oklch(0.96 0 0 / 0)`)
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Core dot
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2)
      ctx.fillStyle = `oklch(0.96 0 0 / ${0.55 + 0.45 * pulse})`
      ctx.fill()
    }

    // Scanline overlay — moving horizontal rule
    const scanY = ((t * 28) % (H + 40)) - 20
    const scanGrad = ctx.createLinearGradient(0, scanY - 14, 0, scanY + 14)
    scanGrad.addColorStop(0,   "oklch(0.96 0 0 / 0)")
    scanGrad.addColorStop(0.5, "oklch(0.96 0 0 / 0.035)")
    scanGrad.addColorStop(1,   "oklch(0.96 0 0 / 0)")
    ctx.fillStyle = scanGrad
    ctx.fillRect(0, scanY - 14, W, 28)

    frameRef.current = requestAnimationFrame(() => tick(canvas))
  }

  function start(canvas: HTMLCanvasElement) {
    canvasRef.current = canvas
    frameRef.current = requestAnimationFrame(() => tick(canvas))
  }

  function stop() {
    cancelAnimationFrame(frameRef.current)
  }

  return { start, stop }
}

// ── Mobile Animation Background ───────────────────────────────────────────────
// Same canvas animation as FollicularPanel but rendered as an absolute
// full-screen layer behind the form on small screens.
function MobileAnimBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const anim = useFollicularAnimation(size.w, size.h)

  useEffect(() => {
    function onResize() {
      setSize({ w: window.innerWidth, h: window.innerHeight })
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w || !size.h) return
    canvas.width  = size.w
    canvas.height = size.h
    anim.start(canvas)
    return () => anim.stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  return (
    <>
      <div className="absolute inset-0 bg-[oklch(0.04_0.003_260)]" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Faint geometric grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.88 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.88 0 0) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </>
  )
}

// ── Follicular Data Panel (desktop left column) ───────────────────────────────
function FollicularPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const anim = useFollicularAnimation(size.w, size.h)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w || !size.h) return
    canvas.width  = size.w
    canvas.height = size.h
    anim.start(canvas)
    return () => anim.stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[oklch(0.04_0.003_260)]"
    >
      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette edges */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,oklch(0.04_0.003_260)_100%)]" />

      {/* Geometric grid overlay — ultra-faint */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.88 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.88 0 0) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Content lockup */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-10 text-center">
        {/* Brand lockup */}
        <div className="flex items-center">
          <DensifyLogomark variant="login" />
        </div>

        {/* Divider */}
        <div className="h-px w-16 bg-white/20" />

        {/* Descriptor */}
        <div className="space-y-1">
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/40">
            Follicular Data Regeneration
          </p>
          <p className="max-w-[260px] text-[11px] leading-relaxed text-white/30">
            Clinical-grade AI analysis of hair restoration outcomes. Precision metrics, secured.
          </p>
        </div>

        {/* Corner decorations */}
        <div className="absolute -left-6 -top-6 h-12 w-12 border-l border-t border-white/10" />
        <div className="absolute -right-6 -bottom-6 h-12 w-12 border-r border-b border-white/10" />
      </div>
    </div>
  )
}

// ── Auth Form ─────────────────────────────────────────────────────────────────

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole]         = useState<"patient" | "doctor">("patient")
  const [specialty, setSpecialty] = useState("Trichology & Hair Restoration Specialist")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const getApiUrl = () => {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const url = getPublicApiUrl();
    return url.replace(/\/+$/, "");
  }

  useEffect(() => {
    // Wake up Render backend in background when auth form mounts
    fetch(`${getApiUrl()}/health`).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === "sign-up") {
        const res = await authClient.signUp.email({ email, password, name })
        if (res.error) throw new Error(res.error.message ?? "Sign-up failed")

        if (role === "doctor") {
          // Doctor sign-up: register role, auto-verify, sign in directly
          await fetch("/api/auth/register-role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              role: "doctor",
              specialty: specialty,
              licenseNumber: licenseNumber || "MED-TRICH-9841",
            })
          }).catch((e) => {
            console.error("Failed to register role", e);
          });

          const signInRes = await authClient.signIn.email({ email, password });
          if (!signInRes.error) {
            router.push("/doctor");
            router.refresh();
            return;
          }

          router.push("/doctor");
          router.refresh();
          return;
        } else {
          // Patient sign-up: trigger OTP verification email and redirect to /verify
          const apiUrl = getApiUrl();
          fetch(`${apiUrl}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          }).catch((e) => {
            console.error("Failed to trigger verification email", e);
          });
          router.push("/verify?email=" + encodeURIComponent(email))
          return;
        }
      } else {
        const apiUrl = getApiUrl();
        
        // Pre-check the credentials against our FastAPI gate
        const preCheckRes = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        if (preCheckRes.status === 403) {
          const data = await preCheckRes.json();
          if (data.requires_verification) {
            // Unverified user. Resend OTP and go to verify page (non-blocking)
            fetch(`${apiUrl}/api/auth/resend-otp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email })
            }).catch((e) => {
              console.error("Failed to trigger verification email", e);
            });
            router.push("/verify?email=" + encodeURIComponent(data.email));
            return;
          }
        } else if (!preCheckRes.ok) {
          throw new Error("Invalid credentials");
        }

        // Pre-check passed (verified user). Proceed with Better Auth to create the session!
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message ?? "Sign-in failed");

        // Determine destination dashboard based on user role
        try {
          const roleRes = await fetch(`/api/auth/get-user-role?email=${encodeURIComponent(email)}`);
          const roleData = await roleRes.json();
          if (roleData.role === "doctor") {
            router.push("/doctor");
          } else {
            router.push("/");
          }
        } catch {
          router.push("/");
        }
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(12px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-[oklch(0.06_0.004_260)] flex"
    >

      {/* ── LEFT: Follicular Data Animation (desktop only) ──────────────── */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%]">
        <FollicularPanel />
      </div>

      {/* ── RIGHT: Form ─────────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 md:w-1/2 lg:w-[45%] md:border-l md:border-white/[0.07]">

        {/* Mobile: full-screen canvas animation behind the form */}
        <div className="pointer-events-none absolute inset-0 md:hidden overflow-hidden">
          <MobileAnimBackground />
          {/* Vignette so form card remains readable */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.06_0.004_260/0.55)_0%,oklch(0.06_0.004_260/0.85)_100%)]" />
        </div>

        <div className="relative w-full max-w-[380px]">

          {/* Mobile brand lockup — shown only on small screens */}
          <div className="flex justify-center mb-10 md:hidden">
            <DensifyLogomark variant="login" />
          </div>

          {/* Headings */}
          <div className="mb-8">
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/30 mb-2">
              {mode === "sign-in" ? "Secure access" : "New account"}
            </p>
            <h1 className="text-[22px] font-semibold tracking-tight text-white leading-tight">
              {mode === "sign-in" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-[12px] text-white/40 leading-relaxed">
              {mode === "sign-in"
                ? "Sign in to continue tracking your progress."
                : "Start tracking your hair restoration journey."}
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-[4px] border border-white/[0.09] bg-[oklch(0.08_0.004_260/0.95)] backdrop-blur-xl p-7 shadow-[0_24px_64px_oklch(0_0_0/0.5)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "sign-up" && (
                <>
                  {/* Role Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/50">
                      Account Role
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("patient")}
                        className={cn(
                          "flex flex-col items-start p-2.5 rounded-[3px] border text-left transition-all",
                          role === "patient"
                            ? "border-white bg-white/10 text-white ring-1 ring-white/20"
                            : "border-white/[0.12] bg-[oklch(0.06_0.003_260)] text-white/50 hover:border-white/30 hover:text-white"
                        )}
                      >
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-white" /> Patient
                        </span>
                        <span className="text-[10px] text-white/40 mt-0.5 leading-tight">Personal tracking & vault</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("doctor")}
                        className={cn(
                          "flex flex-col items-start p-2.5 rounded-[3px] border text-left transition-all",
                          role === "doctor"
                            ? "border-violet-400 bg-violet-500/15 text-white ring-1 ring-violet-400/40"
                            : "border-white/[0.12] bg-[oklch(0.06_0.003_260)] text-white/50 hover:border-white/30 hover:text-white"
                        )}
                      >
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-violet-300">
                          <Stethoscope className="h-3.5 w-3.5 text-violet-400" /> Doctor
                        </span>
                        <span className="text-[10px] text-white/40 mt-0.5 leading-tight">Clinical caseload portal</span>
                      </button>
                    </div>
                  </div>

                  {/* Doctor Details (if doctor selected) */}
                  {role === "doctor" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2.5 p-3 rounded-[3px] border border-violet-500/20 bg-violet-500/5 text-xs"
                    >
                      <div className="space-y-1">
                        <Label htmlFor="specialty" className="text-[10px] font-medium tracking-[0.08em] uppercase text-violet-300">
                          Specialty
                        </Label>
                        <select
                          id="specialty"
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          className="w-full h-8 rounded-[3px] border border-white/[0.15] bg-[oklch(0.06_0.003_260)] text-white text-xs px-2 focus:ring-1 focus:ring-violet-400 outline-none"
                        >
                          <option value="Trichology & Hair Restoration Specialist">Trichology & Hair Restoration Specialist</option>
                          <option value="Dermatologist & Scalp Specialist">Dermatologist & Scalp Specialist</option>
                          <option value="Hair Transplant Surgeon">Hair Transplant Surgeon</option>
                          <option value="Clinical Trichologist">Clinical Trichologist</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="license" className="text-[10px] font-medium tracking-[0.08em] uppercase text-violet-300">
                          Medical License / NPI #
                        </Label>
                        <Input
                          id="license"
                          placeholder="e.g. MED-TRICH-9841"
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          className="h-8 rounded-[3px] border-white/[0.12] bg-[oklch(0.06_0.003_260)] text-white text-xs placeholder:text-white/20"
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/50">
                      Full name
                    </Label>
                    <Input
                      id="name"
                      placeholder={role === "doctor" ? "Dr. Alex Vance" : "Marcus Reed"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      className="h-10 rounded-[3px] border-white/[0.12] bg-[oklch(0.06_0.003_260)] text-white placeholder:text-white/20 focus-visible:ring-white/20 focus-visible:border-white/30 transition-colors"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/50">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 rounded-[3px] border-white/[0.12] bg-[oklch(0.06_0.003_260)] text-white placeholder:text-white/20 focus-visible:ring-white/20 focus-visible:border-white/30 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/50">
                    Password
                  </Label>
                  {mode === "sign-in" && (
                    <a href="/forgot-password" className="text-[10px] text-white/40 hover:text-white transition-colors">
                      Forgot password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    className="h-10 rounded-[3px] border-white/[0.12] bg-[oklch(0.06_0.003_260)] text-white placeholder:text-white/20 focus-visible:ring-white/20 focus-visible:border-white/30 pr-10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-[11px] text-red-400/90 rounded-[3px] border border-red-500/20 bg-red-500/10 px-3 py-2 leading-relaxed">
                  {error}
                </p>
              )}

              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-[3px] bg-white text-[oklch(0.06_0.004_260)] font-semibold tracking-[0.08em] text-[12px] uppercase hover:bg-white/90 transition-all duration-200 shadow-[0_0_24px_oklch(1_0_0/0.08)]"
                >
                  {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {mode === "sign-in" ? "Sign in" : "Create account"}
                </Button>

                {mode === "sign-in" && (
                  <Button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="w-full h-10 rounded-[3px] border border-white/[0.12] bg-transparent text-white/70 font-semibold tracking-[0.08em] text-[12px] uppercase hover:bg-white/5 hover:text-white transition-all duration-200"
                  >
                    Reset Password
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Switch link */}
          <p className="mt-5 text-center text-[11px] text-white/30">
            {mode === "sign-in" ? (
              <>
                {"Don't have an account? "}
                <a href="/sign-up" className="text-white/60 hover:text-white transition-colors font-medium">
                  Sign up
                </a>
              </>
            ) : (
              <>
                {"Already have an account? "}
                <a href="/sign-in" className="text-white/60 hover:text-white transition-colors font-medium">
                  Sign in
                </a>
              </>
            )}
          </p>

          {/* Bottom rule */}
          <div className="mt-10 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="font-mono text-[8px] tracking-[0.25em] uppercase text-white/20">
              Secured
            </span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
