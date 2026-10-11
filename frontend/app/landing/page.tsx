"use client"

import { getPublicApiUrl } from "@/lib/api-url"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useScroll,
  useTransform,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  animate,
} from "framer-motion"
import { DensifyLogomark } from "@/components/densify-logomark"
import { siteAsset } from "@/lib/site-assets"
import { HairRegrowthCanvas } from "@/components/hair-regrowth-canvas"
import { EASE_OUT, Reveal, RevealWords, ScrollProgress, SpotlightCard, fadeUp, lineUp, stagger } from "@/components/landing-motion"
import {
  Camera,
  Shield,
  Brain,
  ArrowRight,
  Star,
  Zap,
  Lock,
  ChevronRight,
  MessageSquare,
  ShoppingBag,
  BarChart3,
  FileText,
  Microscope,
  Scan,
  CheckCircle2,
  Eye,
  TrendingUp,
  Activity,
  LayoutDashboard,
  FlaskConical,
  Stethoscope,
  FolderOpen,
  Bot,
  Menu,
  X,
  Quote,
  Mail
} from "lucide-react"

// Unsplash photo 1506794778202 (free licence), 1600×2400, served from Object Storage.
const HERO_IMAGE = siteAsset("hero/hero-man.jpg")
// Same photo and framing with a bald scalp, plus a per-pixel growth map of the head
// region. Together they drive the WebGL regrowth in <HairRegrowthCanvas>.
const HERO_IMAGE_BALD = siteAsset("hero/hero-man-bald.jpg")
const HERO_GROWTH_MAP = siteAsset("hero/hero-growmap.png")

type Testimonial = {
  name: string
  initials: string
  role: string
  quote: string
  avatar: string
  clinician: boolean
  tag: string
  stat?: { value: string; label: string }
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "James R.",
    initials: "JR",
    role: "Densify Pro · 8 mo",
    quote: "I finally have hard data to show my dermatologist. The density tracking is incredible — my clinician spotted a 12% improvement I would have completely missed.",
    avatar: siteAsset("avatars/avatar-1.png"),
    clinician: false,
    tag: "Patient · 8 mo",
  },
  {
    name: "Dr. Priya Mehta",
    initials: "PM",
    role: "Board-Certified Trichologist",
    quote: "Densify has fundamentally changed how I monitor patient progress. The AI reports save me 30 minutes per consultation.",
    avatar: siteAsset("avatars/avatar-2.png"),
    clinician: true,
    tag: "Clinician",
    stat: { value: "30 min", label: "Saved per consultation" },
  },
  {
    name: "Marcus T.",
    initials: "MT",
    role: "Densify User · 14 mo",
    quote: "Stopped guessing, started measuring. Seeing the Week 1 vs Week 52 side-by-side gave me total confidence.",
    avatar: siteAsset("avatars/avatar-3.png"),
    clinician: false,
    tag: "Patient · 14 mo",
  },
  {
    name: "Alex W.",
    initials: "AW",
    role: "Densify Pro · 3 mo",
    quote: "The red/green quality lock for the camera means I never take a blurry progress pic again. Absolute game changer.",
    avatar: siteAsset("avatars/avatar-1.png"),
    clinician: false,
    tag: "Patient · 3 mo",
  },
  {
    name: "Dr. S. K.",
    initials: "SK",
    role: "Dermatologist",
    quote: "The ability for patients to securely forward their Bedrock-analyzed reports directly to my inbox is the bridge telehealth has been missing.",
    avatar: siteAsset("avatars/avatar-2.png"),
    clinician: true,
    tag: "Telehealth",
  },
]

// Paraphrased highlights for the decorative ribbon (kept distinct from the full quotes).
const PULL_QUOTES = [
  "Hard data for my dermatologist",
  "Thirty minutes saved per consult",
  "Never a blurry progress photo again",
  "Total confidence, week over week",
  "Reports straight to my clinician",
]

const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string; badge?: string }[] }[] = [
  {
    heading: "Platform",
    links: [
      { label: "Overview", href: "/sign-up" },
      { label: "Clinical", href: "/sign-up" },
      { label: "Doctors", href: "/sign-up" },
      { label: "Vault", href: "/sign-up" },
      { label: "AI Agent", href: "/sign-up", badge: "Beta" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "How it works", href: "#product" },
      { label: "Bedrock Engine", href: "#engine" },
      { label: "Testimonials", href: "#proof" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Create account", href: "/sign-up" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Reset password", href: "/forgot-password" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
]

const MARQUEE_ITEMS = [
  "Follicular density mapping",
  "Miniaturization analysis",
  "40+ biomarkers extracted",
  "Encrypted medical vault",
  "Clinician report sharing",
  "Camera quality lock",
  "AI trichology insights",
]

/* ─── Animated counter hook (easeOutExpo, lands exactly on `end`) ─── */
function useCounter(end: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(Math.floor(eased * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [end, duration, start])
  return value
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const apiUrl = getPublicApiUrl();
    fetch(`${apiUrl.replace(/\/+$/, "")}/health`).catch(() => {});
  }, [])

  const navBlurred = scrollY > 40
  // Before the nav frosts, it sits over the dark hero panel.
  const navOnDark = !navBlurred && !mobileMenuOpen
  const reduceMotion = useReducedMotion()
  // Scroll-linked transforms aren't covered by MotionConfig's reducedMotion, so
  // collapse their ranges to a no-op when the user asks for less motion.
  const r = <T,>(range: T[]) => (reduceMotion ? range.map(() => range[range.length - 1]) : range)

  // -- HERO SCROLL ANIMATIONS --
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })

  const heroTextOpacity = useTransform(heroProgress, [0, 0.45], r([1, 0]))
  const heroTextY = useTransform(heroProgress, [0, 0.45], r([0, -80]))
  const heroTextBlur = useTransform(heroProgress, [0, 0.45], r([0, 6]))
  const heroTextFilter = useMotionTemplate`blur(${heroTextBlur}px)`

  // -- HAIR REGROWTH: per-pixel bald → stubble → short → full, rendered in WebGL.
  // "static" (plain photo) when WebGL2 is unavailable, loading stalls, or motion is reduced.
  const [regrowMode, setRegrowMode] = useState<"loading" | "webgl" | "static">("loading")
  const growth = useMotionValue(0)
  useEffect(() => {
    if (reduceMotion) setRegrowMode("static")
  }, [reduceMotion])
  useEffect(() => {
    const id = setTimeout(() => setRegrowMode((m) => (m === "loading" ? "static" : m)), 6000)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => {
    if (regrowMode !== "webgl") return
    const controls = animate(growth, 1, { delay: 0.8, duration: 11, ease: [0.25, 0.1, 0.35, 1] })
    return () => controls.stop()
  }, [regrowMode, growth])
  const regrowWeek = useTransform(growth, (v) => `Week ${Math.max(1, Math.round(v * 52))}`)
  const regrowDensity = useTransform(growth, (v) => (88 + v * 71).toFixed(1))
  const regrowBar = useTransform(growth, (v) => `${Math.round(v * 100)}%`)

  const heroImageY = useTransform(heroProgress, [0, 1], r([0, 140]))
  const heroImageScale = useTransform(heroProgress, [0, 1], r([1, 1.08]))

  // -- PRODUCT (phone) SECTION: phone drifts and straightens through the viewport --
  const productRef = useRef<HTMLElement>(null)
  const { scrollYProgress: productProgress } = useScroll({
    target: productRef,
    offset: ["start end", "end start"],
  })
  const phoneY = useTransform(productProgress, [0, 1], r([90, -90]))
  const phoneRotate = useTransform(productProgress, [0, 0.5, 1], r([6, 0, -3]))
  const phoneScale = useTransform(productProgress, [0, 0.5, 1], r([0.9, 1, 0.96]))
  const orbY1 = useTransform(productProgress, [0, 1], r([-120, 160]))
  const orbY2 = useTransform(productProgress, [0, 1], r([120, -120]))

  // -- ENGINE ROOM: dark panel expands from an inset card to full bleed --
  const engineRef = useRef<HTMLElement>(null)
  const { scrollYProgress: engineEnter } = useScroll({
    target: engineRef,
    offset: ["start end", "start 0.15"],
  })
  const engineInset = useTransform(engineEnter, [0, 1], r([5, 0]))
  const engineRadius = useTransform(engineEnter, [0, 1], r([48, 0]))
  const engineClip = useMotionTemplate`inset(0% ${engineInset}% round ${engineRadius}px)`
  const { scrollYProgress: engineThrough } = useScroll({
    target: engineRef,
    offset: ["start end", "end start"],
  })
  const glowScale = useTransform(engineThrough, [0, 0.5, 1], r([0.6, 1.15, 0.8]))
  const glowY = useTransform(engineThrough, [0, 1], r([-120, 120]))

  // -- FINAL CTA: content scales in as the section rises --
  const ctaRef = useRef<HTMLElement>(null)
  const { scrollYProgress: ctaProgress } = useScroll({
    target: ctaRef,
    offset: ["start end", "center center"],
  })
  const ctaScale = useTransform(ctaProgress, [0, 1], r([0.9, 1]))
  const ctaGlowX = useTransform(ctaProgress, [0, 1], r(["-30%", "10%"]))

  // -- STATS OBSERVER --
  const statsRef = useRef<HTMLDivElement>(null)
  const statsInView = useInView(statsRef, { once: true, margin: "-100px" })
  const statUsers = useCounter(48, 1600, statsInView)
  const statScans = useCounter(1260, 1800, statsInView)
  const statClinicians = useCounter(6, 1200, statsInView)

  // -- TERMINAL EFFECT --
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInView = useInView(terminalRef, { once: true, margin: "-150px" })
  const { scrollYProgress: terminalProgress } = useScroll({
    target: terminalRef,
    offset: ["start end", "center center"],
  })
  const terminalRotateX = useTransform(terminalProgress, [0, 1], r([28, 0]))
  const terminalScale = useTransform(terminalProgress, [0, 1], r([0.88, 1]))
  const terminalOpacity = useTransform(terminalProgress, [0, 0.4], r([0, 1]))
  const [typedText, setTypedText] = useState("")
  const fullTerminalText = `> Analyzing follicular array...\n> Vertex density: 159.4 hairs/cm²\n> Temporal density: 187.2 hairs/cm²\n> Miniaturization ratio: 0.18\n> Confidence score: 0.97\n> Process complete. Data appended to vault.`
  
  useEffect(() => {
    if (!terminalInView) return
    let i = 0
    const interval = setInterval(() => {
      setTypedText(fullTerminalText.substring(0, i))
      i++
      if (i > fullTerminalText.length) clearInterval(interval)
    }, 20)
    return () => clearInterval(interval)
  }, [terminalInView, fullTerminalText])


  return (
    <MotionConfig reducedMotion="user">
    <div className="relative min-h-screen bg-[var(--landing-cream)] text-zinc-900 overflow-x-hidden selection:bg-[var(--landing-accent)] selection:text-zinc-950 font-sans">
      <ScrollProgress />

      {/* ────────────────────── NAVBAR ────────────────────── */}
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT }}
        className={`fixed top-0 inset-x-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ${
          navBlurred
            ? "bg-white/80 backdrop-blur-xl border-b border-zinc-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 lg:px-8 h-20">
          <Link href="/landing" className="flex items-center group">
            {/* White ink while the nav floats over the dark hero, black once it frosts */}
            <DensifyLogomark
              tone={navOnDark ? "white" : "black"}
              height={52}
              className="group-hover:scale-105 transition-transform duration-500"
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/sign-in"
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-full ${
                navOnDark ? "text-white/80 hover:text-white hover:bg-white/10" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              Log In
            </Link>
            <Link
              href="/sign-up"
              className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all active:scale-[0.98] ${
                navOnDark
                  ? "text-zinc-950 bg-white hover:bg-zinc-100 hover:shadow-lg hover:shadow-white/20"
                  : "text-white bg-zinc-900 hover:bg-zinc-800 hover:shadow-lg hover:shadow-zinc-900/20"
              }`}
            >
              Sign Up
            </Link>
          </div>

          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${navOnDark ? "text-white hover:bg-white/10" : "text-zinc-900 hover:bg-zinc-100"}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-t border-zinc-100 px-6 pb-6 pt-3"
          >
            <div className="flex flex-col gap-2">
              <Link
                href="/sign-in"
                className="px-4 py-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-3 text-sm font-semibold text-white bg-zinc-900 rounded-xl text-center hover:bg-zinc-800 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </motion.nav>

      {/* ────────────────────── EDITORIAL HERO ────────────────────── */}
      <section ref={heroRef} className="relative bg-[var(--landing-cream)] p-2 sm:p-3">
        <div className="relative h-[100svh] min-h-[700px] max-h-[1040px] rounded-[24px] sm:rounded-[32px] overflow-hidden bg-[#050505] isolate">
          {/* Portrait — centred, sized to the panel height. Its near-black backdrop
              matches the panel, so masked side edges read as one full-bleed image. */}
          <motion.div
            style={{ y: heroImageY, scale: heroImageScale }}
            className="absolute inset-0 -z-10 flex justify-center"
          >
            <motion.div
              initial={{ scale: 1.12, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 2.2, ease: EASE_OUT }}
              className="relative h-[125%] lg:h-[135%] aspect-[2/3] shrink-0"
              style={{
                WebkitMaskImage: "linear-gradient(to right, transparent, black 22%, black 78%, transparent)",
                maskImage: "linear-gradient(to right, transparent, black 22%, black 78%, transparent)",
              }}
            >
              <img
                src={HERO_IMAGE}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  regrowMode === "static" ? "opacity-100" : "opacity-0"
                }`}
              />
              {regrowMode !== "static" && (
                <HairRegrowthCanvas
                  hairSrc={HERO_IMAGE}
                  baldSrc={HERO_IMAGE_BALD}
                  mapSrc={HERO_GROWTH_MAP}
                  progress={growth}
                  onReady={(ok) => setRegrowMode((m) => (m === "loading" ? (ok ? "webgl" : "static") : m))}
                  className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
                    regrowMode === "webgl" ? "opacity-100" : "opacity-0"
                  }`}
                />
              )}
            </motion.div>
          </motion.div>

          {/* Warm grade: amber back-light around the hair + low-angle bounce, then vignettes */}
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <motion.div
              animate={{ opacity: [0.55, 0.75, 0.55], scale: [1, 1.05, 1] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-1/2 top-[-12%] -translate-x-1/2 w-[900px] h-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(251,146,60,0.55),rgba(180,83,9,0.18)_55%,transparent)] mix-blend-screen blur-2xl"
            />
            <div className="absolute -left-40 bottom-[-20%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(194,65,12,0.35),transparent)] blur-3xl" />
            <div className="absolute -right-40 top-[20%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(120,53,15,0.35),transparent)] blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            {/* Film grain */}
            <div
              className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />
          </div>

          {/* Regrowth readout, synced to the hair animation */}
          {regrowMode === "webgl" && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8, ease: EASE_OUT }}
              style={{ opacity: heroTextOpacity }}
              className="absolute right-4 sm:right-8 lg:right-[max(2rem,calc((100%-80rem)/2+2rem))] top-24 sm:top-28 z-10 w-[190px] rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl p-4"
            >
              <div className="flex items-center justify-between text-[9px] font-bold tracking-[0.2em] uppercase">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                  Regrowth
                </span>
                <motion.span className="text-white/60">{regrowWeek}</motion.span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <motion.span className="font-serif text-3xl text-white tabular-nums">{regrowDensity}</motion.span>
                <span className="text-[10px] text-white/50">hairs/cm²</span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div style={{ width: regrowBar }} className="h-full rounded-full bg-gradient-to-r from-[var(--landing-accent-deep)] to-amber-300" />
              </div>
            </motion.div>
          )}

          {/* Content */}
          <motion.div
            style={{ opacity: heroTextOpacity, y: heroTextY, filter: heroTextFilter }}
            className="relative h-full mx-auto max-w-7xl px-6 lg:px-8 flex flex-col justify-end pb-6 sm:pb-8"
          >
            <motion.div
              initial="hidden"
              animate="show"
              variants={stagger(0.14, 0.4)}
              className="flex flex-col-reverse lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-12"
            >
              {/* Glass card */}
              <motion.div
                variants={fadeUp}
                className="w-full lg:w-[360px] shrink-0 rounded-[28px] border border-white/15 bg-white/[0.07] backdrop-blur-xl p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_30px_60px_-30px_rgba(0,0,0,0.6)]"
              >
                <div className="flex items-center justify-between">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={siteAsset("brand/mark-white.png")} alt="" width={36} height={36} className="w-9 h-9 opacity-90" />
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-60" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-amber-300" />
                  </span>
                  <span className="text-[10px] font-bold text-white/80 tracking-[0.2em] uppercase">Now in Open Beta</span>
                </div>
                </div>

                <h2 className="mt-10 text-xl sm:text-2xl font-medium tracking-tight text-white leading-snug">
                  Clinical Precision.
                  <br />
                  <span className="text-white/55">Radical Clarity.</span>
                </h2>

                <div className="mt-4 pl-4 border-l border-white/20">
                  <p className="text-sm text-white/65 leading-relaxed">
                    Replace subjective guesswork with AI-powered biometric tracking. The ultimate vault for your hair progression.
                  </p>
                </div>

                <div className="mt-8 flex items-center gap-2 group">
                  <Link
                    href="/sign-up"
                    aria-label="Get started"
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-zinc-950 hover:scale-105 transition-transform"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/sign-up"
                    className="h-11 px-6 inline-flex items-center rounded-full border border-white/30 text-[11px] font-bold tracking-[0.18em] uppercase text-white hover:bg-white hover:text-zinc-950 transition-colors duration-300"
                  >
                    Start Your Journey
                  </Link>
                </div>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={stagger(0.14)}
                className="text-[3.4rem] sm:text-7xl lg:text-[4.75rem] xl:text-[6.25rem] font-medium tracking-[-0.045em] text-white leading-[0.95] lg:text-right"
              >
                <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                  <motion.span variants={lineUp} className="block">Your fears</motion.span>
                </span>{" "}
                <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                  <motion.span variants={lineUp} className="block">
                    are now <span className="font-serif italic font-normal tracking-tight text-amber-100/90">ours.</span>
                  </motion.span>
                </span>
              </motion.h1>
            </motion.div>

            {/* Bottom rail */}
            <motion.a
              href="#product"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("product")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="group mt-8 flex items-center justify-between border-b border-white/25 pb-4 text-white/85 hover:text-white transition-colors"
            >
              <span className="text-base sm:text-lg font-medium tracking-tight">See how Densify tracks your regrowth</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* ────────────────────── STATS STRIP ────────────────────── */}
      <section ref={statsRef} className="pt-20 pb-24 bg-[var(--landing-cream)] relative z-30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger(0.15)}
            className="grid md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-zinc-900/10"
          >
            <motion.div variants={fadeUp} className="pt-6 md:pt-0">
              <div className="font-serif text-6xl md:text-7xl font-medium tracking-tight text-zinc-900 mb-2">
                {statUsers.toLocaleString()}+
              </div>
              <div className="text-sm font-bold text-zinc-400 tracking-[0.2em] uppercase">Active Vaults</div>
            </motion.div>
            <motion.div variants={fadeUp} className="pt-6 md:pt-0">
              <div className="font-serif text-6xl md:text-7xl font-medium tracking-tight text-zinc-900 mb-2">
                {statScans.toLocaleString()}+
              </div>
              <div className="text-sm font-bold text-zinc-400 tracking-[0.2em] uppercase">Scans Analyzed</div>
            </motion.div>
            <motion.div variants={fadeUp} className="pt-6 md:pt-0">
              <div className="font-serif text-6xl md:text-7xl font-medium tracking-tight text-zinc-900 mb-2">
                {statClinicians.toLocaleString()}+
              </div>
              <div className="text-sm font-bold text-[var(--landing-accent-deep)] tracking-[0.2em] uppercase">Partner Clinicians</div>
            </motion.div>
          </motion.div>
        </div>

        {/* Capability marquee */}
        <Reveal className="mt-20">
          <div
            className="landing-marquee-wrap relative overflow-hidden py-5 border-y border-zinc-900/10"
            style={{
              WebkitMaskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
              maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <div className="landing-marquee flex w-max">
              {[0, 1].map((copy) => (
                <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
                  {MARQUEE_ITEMS.map((item) => (
                    <span key={item} className="flex items-center gap-10 pr-10 text-sm font-semibold tracking-[0.15em] uppercase text-zinc-400 whitespace-nowrap">
                      {item}
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ────────────────────── PRODUCT (PHONE MOCKUP) ────────────────────── */}
      <section id="product" ref={productRef} className="relative py-28 lg:py-36 bg-[var(--landing-cream)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            style={{ y: orbY1 }}
            className="absolute top-0 right-[5%] w-[560px] h-[560px] rounded-full bg-[var(--landing-accent)] opacity-[0.10] blur-[120px]"
          />
          <motion.div
            style={{ y: orbY2 }}
            className="absolute bottom-0 right-[25%] w-[420px] h-[420px] rounded-full bg-[var(--landing-accent-deep)] opacity-[0.08] blur-[120px]"
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 grid lg:grid-cols-2 gap-20 lg:gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger(0.12)}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-zinc-900/10 mb-8">
              <Scan className="w-3.5 h-3.5 text-[var(--landing-accent-deep)]" />
              <span className="text-[11px] font-bold text-zinc-600 tracking-[0.2em] uppercase">The App</span>
            </motion.div>

            <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-bold tracking-tighter leading-[1.02] text-zinc-900">
              Your entire protocol.
              <br />
              <span className="font-serif italic font-normal tracking-tight text-zinc-400">In your pocket.</span>
            </motion.h2>

            <motion.p variants={fadeUp} className="mt-6 text-lg text-zinc-500 max-w-md leading-relaxed">
              Standardised scalp captures, density trends and your daily regimen — measured, logged and ready to share with your clinician.
            </motion.p>

            <motion.ul variants={stagger(0.1)} className="mt-12 flex flex-col">
              {[
                { icon: Camera, title: "Guided capture", desc: "Lighting and focus checks lock in comparable photos, every time." },
                { icon: TrendingUp, title: "Measured progression", desc: "Density and miniaturization tracked against your baseline." },
                { icon: CheckCircle2, title: "Protocol adherence", desc: "Daily treatments logged, so results map to what you actually did." },
              ].map(({ icon: Icon, title, desc }) => (
                <motion.li key={title} variants={fadeUp} className="group flex gap-5 py-5 border-t border-zinc-100 last:border-b">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-white border border-zinc-900/10 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-950 group-hover:text-white group-hover:border-zinc-950 transition-colors duration-300">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900">{title}</div>
                    <div className="mt-1 text-sm text-zinc-500 leading-relaxed">{desc}</div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Phone */}
          <motion.div
            initial={{ opacity: 0, y: 80, rotateX: 18 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.4, ease: EASE_OUT }}
            style={{ transformPerspective: 1400 }}
            className="relative flex justify-center lg:justify-end items-center"
          >
            {/* Soft pedestal shadow */}
            <div className="absolute bottom-[-30px] left-1/2 lg:left-auto lg:right-[30px] -translate-x-1/2 lg:translate-x-0 w-[280px] h-10 rounded-[100%] bg-zinc-900/20 blur-2xl" />
            <motion.div style={{ y: phoneY, rotate: phoneRotate, scale: phoneScale }}>
                {/* Infinite Float & Hover Wrapper */}
                <motion.div 
                  animate={{ y: [0, -12, 0] }}
                  transition={{ 
                    y: { repeat: Infinity, duration: 5, ease: "easeInOut" },
                    rotate: { duration: 0.5, ease: "backOut" }
                  }}
                  whileHover={{ scale: 1.03, rotate: [0, -3, 0] }}
                  className="relative w-[340px] h-[720px] bg-zinc-950 rounded-[50px] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.05)] border-[8px] border-zinc-200 flex flex-col overflow-hidden z-20 ring-1 ring-inset ring-black/10"
                >
                {/* Glass Glare Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10 pointer-events-none z-50 mix-blend-screen" />
                
                {/* Dynamic Island Mock */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[100px] h-[30px] bg-black rounded-full z-50 shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1)]"></div>
                
                {/* Screen Content */}
                <div className="flex-1 bg-white relative w-full pt-14 pb-8 px-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-zinc-900">Progression</span>
                    <span className="text-[10px] font-bold bg-[var(--landing-accent-deep)] text-white px-2 py-1 rounded-full uppercase tracking-wider">+12%</span>
                  </div>
                  
                  <div className="relative w-full aspect-square rounded-2xl bg-zinc-100 overflow-hidden mb-6 border border-zinc-200 shadow-inner">
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-200/80">
                      <img
                        src={siteAsset("brand/logo-black.png")}
                        alt="Densifi"
                        className="w-[62%] h-auto object-contain opacity-90"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                      <div className="w-full">
                        <div className="flex justify-between text-white text-xs mb-1">
                          <span>Baseline</span>
                          <span>Current</span>
                        </div>
                        <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
                          <div className="w-[68%] h-full bg-[var(--landing-accent)]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Density</div>
                      <div className="font-serif text-3xl font-medium text-zinc-900">159</div>
                      <div className="text-[10px] text-zinc-400">hairs/cm²</div>
                    </div>
                    <div className="bg-zinc-950 text-white p-4 rounded-2xl">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Goal</div>
                      <div className="font-serif text-3xl font-medium">170</div>
                      <div className="text-[10px] text-zinc-500">hairs/cm²</div>
                    </div>
                  </div>

                  {/* Active Protocol List to fill the screen */}
                  <div className="mt-6 flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider">Active Protocol</span>
                      <span className="text-[9px] font-medium text-[var(--landing-accent)] bg-[var(--landing-accent)]/10 px-2 py-0.5 rounded-full">2 Tasks</span>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 overflow-hidden shrink-0 relative">
                          <img src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100&q=80" alt="Minoxidil" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-zinc-900">Minoxidil 5%</div>
                          <div className="text-[10px] text-zinc-500">1 mL · Twice daily</div>
                        </div>
                        <div className="w-6 h-6 rounded-full border border-zinc-200 bg-white flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-accent-deep)]"></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm opacity-60">
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 overflow-hidden shrink-0 relative">
                          <img src="https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=100&q=80" alt="Biotin" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-zinc-900 line-through">Biotin Complex</div>
                          <div className="text-[10px] text-zinc-500">2 capsules</div>
                        </div>
                        <div className="w-6 h-6 rounded-full border-none bg-zinc-200 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real App Mobile Navigation Bar */}
                  <nav className="absolute bottom-0 inset-x-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-xl rounded-b-[42px] overflow-hidden pb-1">
                    <div className="grid grid-cols-5">
                      <div className="flex flex-col items-center gap-1 py-3 text-[9px] font-semibold tracking-widest uppercase text-zinc-900">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="leading-none">Overview</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-3 text-[9px] font-semibold tracking-widest uppercase text-zinc-400">
                        <FlaskConical className="h-4 w-4" />
                        <span className="leading-none">Clinical</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-3 text-[9px] font-semibold tracking-widest uppercase text-zinc-400">
                        <Stethoscope className="h-4 w-4" />
                        <span className="leading-none">Doctors</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-3 text-[9px] font-semibold tracking-widest uppercase text-zinc-400">
                        <FolderOpen className="h-4 w-4" />
                        <span className="leading-none">Vault</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-3 text-[9px] font-semibold tracking-widest uppercase text-zinc-400">
                        <Bot className="h-4 w-4" />
                        <span className="leading-none">AI</span>
                      </div>
                    </div>
                  </nav>
                </div>
                </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* ────────────────────── ENGINE ROOM (BEDROCK) ────────────────────── */}
      <motion.section
        id="engine"
        ref={engineRef}
        style={{ clipPath: engineClip }}
        className="py-32 bg-[var(--landing-ink)] text-white relative overflow-hidden"
      >
        {/* Cinematic glow — breathes and drifts with scroll */}
        <motion.div
          style={{ scale: glowScale, y: glowY, x: "-50%" }}
          className="absolute top-1/4 left-1/2 w-[800px] h-[800px] rounded-full bg-[var(--landing-accent-deep)] opacity-[0.09] blur-[150px] pointer-events-none"
        />

        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger(0.12)}
            >
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
                <Brain className="w-3.5 h-3.5 text-[var(--landing-accent)]" />
                <span className="text-[11px] font-bold text-[var(--landing-accent)] tracking-[0.2em] uppercase">The Bedrock Engine</span>
              </motion.div>

              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold tracking-tighter leading-[1.1] mb-6">
                Meet our two specialists<br/>
                <span className="text-zinc-600">that will help you through your journey.</span>
              </motion.h2>

              <motion.p variants={fadeUp} className="text-xl text-zinc-400 font-serif italic mb-24">
                Powered by Amazon Bedrock (Claude 4.5 Sonnet + Nova Lite).
              </motion.p>

              <motion.div variants={stagger(0.18)} className="grid sm:grid-cols-2 gap-x-5 gap-y-16 mt-20">
                {/* Persona 1: Dr. Claude */}
                <motion.div variants={fadeUp} whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className="relative group">
                  {/* Background & Orb (overflow hidden) */}
                  <div className="absolute inset-0 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden group-hover:bg-white/[0.06] transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--landing-accent-deep)] opacity-20 blur-3xl rounded-full group-hover:opacity-40 transition-opacity" />
                  </div>
                  
                  {/* Content (overflow visible for mascot) */}
                  <div className="relative px-6 pb-6 pt-16 flex flex-col items-center text-center">
                    {/* Floating 3D Mascot */}
                    <img
                      src={siteAsset("mascots/dr-claude.png")}
                      alt="Dr. Claude"
                      className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full object-contain bg-black border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.55)] pointer-events-none z-20"
                    />

                    <h3 className="text-xl font-bold text-white mb-1 tracking-tight relative z-30">Dr. Claude</h3>
                    <div className="text-[9px] font-bold tracking-[0.2em] text-[var(--landing-accent-deep)] uppercase mb-4 relative z-30">The Clinical Pathologist</div>
                    
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                      "I am here for you to help you analyze your unstructured medical reports to extract DHT, ferritin, and 40+ complex biomarkers with deep reasoning."
                    </p>

                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-[var(--landing-accent-deep)]/20 border border-[var(--landing-accent-deep)]/30 text-[var(--landing-accent-deep)] text-[9px] font-bold uppercase tracking-widest">Pathology</span>
                      <span className="px-2.5 py-1 rounded-full bg-[var(--landing-accent-deep)]/20 border border-[var(--landing-accent-deep)]/30 text-[var(--landing-accent-deep)] text-[9px] font-bold uppercase tracking-widest">Lab Data</span>
                    </div>
                  </div>
                </motion.div>

                {/* Persona 2: Dr. Nova */}
                <motion.div variants={fadeUp} whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className="relative group">
                  {/* Background & Orb (overflow hidden) */}
                  <div className="absolute inset-0 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden group-hover:bg-white/[0.06] transition-colors">
                    <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[var(--landing-accent)] opacity-20 blur-3xl rounded-full group-hover:opacity-40 transition-opacity" />
                  </div>
                  
                  {/* Content (overflow visible for mascot) */}
                  <div className="relative px-6 pb-6 pt-16 flex flex-col items-center text-center">
                    {/* Floating 3D Mascot */}
                    <img
                      src={siteAsset("mascots/dr-nova.png")}
                      alt="Dr. Nova"
                      className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full object-contain bg-black border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.55)] pointer-events-none z-20"
                    />

                    <h3 className="text-xl font-bold text-white mb-1 tracking-tight relative z-30">Dr. Nova</h3>
                    <div className="text-[9px] font-bold tracking-[0.2em] text-[var(--landing-accent)] uppercase mb-4 relative z-30">The Chief Trichologist</div>
                    
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                      "I am here for you to help you visually scan your scalp photos in milliseconds to quantify individual follicular units with robotic accuracy."
                    </p>

                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-[var(--landing-accent)]/20 border border-[var(--landing-accent)]/30 text-[var(--landing-accent)] text-[9px] font-bold uppercase tracking-widest">Computer Vision</span>
                      <span className="px-2.5 py-1 rounded-full bg-[var(--landing-accent)]/20 border border-[var(--landing-accent)]/30 text-[var(--landing-accent)] text-[9px] font-bold uppercase tracking-widest">Speed</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Security Lockup */}
              <motion.div variants={fadeUp} className="mt-8 flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl w-fit">
                <Lock className="w-4 h-4 text-zinc-500" />
                <span className="text-xs text-zinc-400 font-medium">Secured by end-to-end encrypted medical vault</span>
              </motion.div>
            </motion.div>

            {/* Terminal Window — tilts up into place as it scrolls in */}
            <div ref={terminalRef} style={{ perspective: 1200 }}>
            <motion.div
              style={{ rotateX: terminalRotateX, scale: terminalScale, opacity: terminalOpacity, transformOrigin: "50% 100%" }}
              className="relative rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_60px_-10px_rgba(232,162,92,0.15)] overflow-hidden"
            >
              {/* Scan line */}
              <div aria-hidden className="landing-scan absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-accent)] to-transparent opacity-0 pointer-events-none z-10" />
              <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                </div>
                <div className="mx-auto text-[10px] font-mono text-zinc-500">densify-core-engine</div>
              </div>
              <div className="p-6 font-mono text-sm leading-relaxed text-[var(--landing-accent)] h-[250px] whitespace-pre-line">
                {typedText}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="inline-block w-2 h-4 bg-[var(--landing-accent)] ml-1 align-middle"
                />
              </div>
            </motion.div>
            </div>

          </div>
        </div>
      </motion.section>

      {/* ────────────────────── WALL OF PROOF ────────────────────── */}
      <section id="proof" className="relative py-28 lg:py-36 bg-[var(--landing-cream)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-900/10 to-transparent" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-[var(--landing-accent)] opacity-[0.10] blur-[140px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-16">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-zinc-900/10 mb-8">
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--landing-accent-deep)]" />
                  <span className="text-[11px] font-bold text-zinc-600 tracking-[0.2em] uppercase">Testimonials</span>
                </div>
              </Reveal>
              <h2 className="text-5xl md:text-7xl font-medium tracking-[-0.04em] text-zinc-900 leading-[0.95]">
                <RevealWords
                  text="The Wall of Proof."
                  lastWordClassName="font-serif italic font-normal tracking-tight text-[var(--landing-accent-deep)]"
                />
              </h2>
              <Reveal delay={0.3}>
                <p className="mt-5 text-xl text-zinc-500 font-serif italic">
                  Don&apos;t just take our word for it.
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.2}>
              <div className="flex items-center gap-5 rounded-2xl bg-white/70 border border-zinc-900/10 backdrop-blur px-5 py-4">
                <div className="flex -space-x-2">
                  {TESTIMONIALS.map((t) => (
                    <span
                      key={t.name}
                      className="w-10 h-10 rounded-full ring-2 ring-white bg-gradient-to-br from-zinc-800 to-zinc-950 text-white text-[10px] font-bold flex items-center justify-center"
                    >
                      {t.initials}
                    </span>
                  ))}
                </div>
                <div className="h-9 w-px bg-zinc-900/10" />
                <div>
                  <div className="flex gap-0.5 text-[var(--landing-accent-deep)]">
                    {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" />)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Patients &amp; clinicians, in their words</div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Bento */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => {
              const variant = i === 0 ? "featured" : i === 4 ? "accent" : "plain"
              const dark = variant !== "plain"
              return (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 48, scale: 0.97, filter: "blur(6px)" }}
                  whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.9, delay: (i % 3) * 0.12, ease: EASE_OUT }}
                  className={`break-inside-avoid ${variant === "featured" ? "md:col-span-2" : ""}`}
                >
                  <SpotlightCard
                    glow={dark ? "rgba(232,162,92,0.16)" : "rgba(232,162,92,0.12)"}
                    className={`h-full rounded-[28px] border overflow-hidden transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 ${
                      variant === "featured"
                        ? "bg-[var(--landing-ink)] border-white/10 text-white shadow-[0_30px_60px_-30px_rgba(12,10,9,0.6)]"
                        : variant === "accent"
                          ? "bg-gradient-to-br from-[#3a2214] via-[#24150d] to-[var(--landing-ink)] border-white/10 text-white shadow-[0_30px_60px_-30px_rgba(58,34,20,0.6)]"
                          : "bg-white border-zinc-900/[0.08] hover:shadow-[0_30px_60px_-30px_rgba(12,10,9,0.25)]"
                    }`}
                  >
                    {dark && (
                      <div className="pointer-events-none absolute -top-28 -right-20 w-72 h-72 rounded-full bg-[var(--landing-accent)] opacity-20 blur-[90px]" />
                    )}

                    <figure className={`relative z-10 h-full grid ${variant === "featured" ? "md:grid-cols-[1.25fr_1fr]" : ""}`}>
                      <div className="flex flex-col p-8 sm:p-9">
                        {/* Top row: stars + tag */}
                        <div className="flex items-center justify-between gap-3">
                          <motion.div
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true }}
                            variants={stagger(0.06, 0.4)}
                            className={`flex gap-0.5 ${dark ? "text-[var(--landing-accent)]" : "text-[var(--landing-accent-deep)]"}`}
                          >
                            {Array.from({ length: 5 }).map((_, s) => (
                              <motion.span
                                key={s}
                                variants={{ hidden: { opacity: 0, scale: 0.4 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 18 } } }}
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                              </motion.span>
                            ))}
                          </motion.div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase ${
                              dark ? "bg-white/10 text-white/70" : "bg-zinc-900/[0.05] text-zinc-500"
                            }`}
                          >
                            {t.tag}
                          </span>
                        </div>

                        {/* Quote */}
                        <blockquote className="relative mt-8 flex-1">
                          <span
                            aria-hidden
                            className={`absolute -top-6 -left-1 font-serif text-7xl leading-none select-none ${
                              dark ? "text-[var(--landing-accent)]/30" : "text-[var(--landing-accent-deep)]/20"
                            }`}
                          >
                            &ldquo;
                          </span>
                          <p
                            className={`relative font-serif leading-relaxed ${
                              variant === "featured" ? "text-2xl sm:text-[1.7rem] text-zinc-100" : dark ? "text-lg text-zinc-100" : "text-lg text-zinc-700"
                            }`}
                          >
                            {t.quote}
                          </p>
                        </blockquote>

                        {t.stat && (
                          <div className="mt-8 flex items-end justify-between gap-4 rounded-2xl bg-[var(--landing-cream)] border border-zinc-900/[0.06] px-5 py-4">
                            <div>
                              <div className="font-serif text-4xl text-zinc-900">{t.stat.value}</div>
                              <div className="mt-1 text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">{t.stat.label}</div>
                            </div>
                            <div className="flex items-end gap-1 h-10" aria-hidden>
                              {[40, 55, 48, 70, 85, 100].map((h, k) => (
                                <motion.span
                                  key={k}
                                  initial={{ scaleY: 0 }}
                                  whileInView={{ scaleY: 1 }}
                                  viewport={{ once: true }}
                                  transition={{ delay: 0.5 + k * 0.08, duration: 0.6, ease: EASE_OUT }}
                                  className="w-1.5 rounded-full bg-[var(--landing-accent-deep)] origin-bottom"
                                  style={{ height: `${h}%`, opacity: 0.35 + k * 0.13 }}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Author */}
                        <figcaption className={`mt-10 pt-6 flex items-center gap-4 border-t ${dark ? "border-white/10" : "border-zinc-900/[0.07]"}`}>
                          <span className={`relative shrink-0 p-[2px] rounded-full bg-gradient-to-br ${dark ? "from-[var(--landing-accent)] to-white/10" : "from-[var(--landing-accent-deep)] to-zinc-200"}`}>
                            <span
                              className={`relative w-11 h-11 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold ${
                                dark ? "bg-[var(--landing-ink)] text-white" : "bg-white text-zinc-800"
                              }`}
                            >
                              {t.initials}
                              <span aria-hidden className="absolute inset-0 bg-cover bg-center grayscale" style={{ backgroundImage: `url(${t.avatar})` }} />
                            </span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={`font-semibold ${dark ? "text-white" : "text-zinc-900"}`}>{t.name}</div>
                            <div className={`text-xs ${dark ? "text-zinc-400" : "text-zinc-500"}`}>{t.role}</div>
                          </div>
                          {t.clinician && (
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase ${
                                dark ? "bg-[var(--landing-accent)]/15 text-[var(--landing-accent)]" : "bg-[var(--landing-accent-deep)]/10 text-[var(--landing-accent-deep)]"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </figcaption>
                      </div>

                      {/* Featured: the result behind the quote */}
                      {variant === "featured" && (
                        <div className="relative m-3 md:ml-0 rounded-[22px] border border-white/10 bg-white/[0.04] p-6 flex flex-col">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400">Vertex density</span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--landing-accent)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)] animate-pulse" />
                              Tracked
                            </span>
                          </div>
                          <div className="mt-3 flex items-baseline gap-2">
                            <span className="font-serif text-5xl text-white">159</span>
                            <span className="text-xs text-zinc-500">hairs/cm²</span>
                          </div>

                          <svg viewBox="0 0 400 170" className="mt-4 w-full flex-1 min-h-[140px] overflow-visible" aria-hidden>
                            <defs>
                              <linearGradient id="proofArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(232,162,92)" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="rgb(232,162,92)" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {[40, 80, 120].map((y) => (
                              <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="white" strokeOpacity="0.06" strokeDasharray="3 5" />
                            ))}
                            <motion.path
                              d="M0 112 C 30 114, 50 130, 82 128 S 130 106, 170 92 S 260 68, 300 58 S 368 42, 400 36 L 400 170 L 0 170 Z"
                              fill="url(#proofArea)"
                              initial={{ opacity: 0 }}
                              whileInView={{ opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ delay: 1.2, duration: 1 }}
                            />
                            <motion.path
                              d="M0 112 C 30 114, 50 130, 82 128 S 130 106, 170 92 S 260 68, 300 58 S 368 42, 400 36"
                              fill="none"
                              stroke="rgb(232,162,92)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              initial={{ pathLength: 0 }}
                              whileInView={{ pathLength: 1 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.4, duration: 1.8, ease: EASE_OUT }}
                            />
                            {/* Shedding-phase marker */}
                            <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.4 }}>
                              <line x1="82" x2="82" y1="128" y2="150" stroke="white" strokeOpacity="0.25" />
                              <text x="82" y="164" textAnchor="middle" fill="white" fillOpacity="0.45" fontSize="10" fontFamily="var(--font-geist-mono)">shed phase</text>
                            </motion.g>
                            <motion.g initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 2, type: "spring" }} style={{ originX: "400px", originY: "36px" }}>
                              <circle cx="400" cy="36" r="10" fill="rgb(232,162,92)" fillOpacity="0.2" />
                              <circle cx="400" cy="36" r="4.5" fill="rgb(232,162,92)" />
                            </motion.g>
                          </svg>

                          <div className="mt-3 flex justify-between font-mono text-[10px] text-zinc-500">
                            <span>Week 1</span>
                            <span>Month 8</span>
                          </div>
                          <div className="mt-5 grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-white/10">
                            <div className="bg-[var(--landing-ink)] px-4 py-3">
                              <div className="font-serif text-2xl text-white">12%</div>
                              <div className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-500">Density gain</div>
                            </div>
                            <div className="bg-[var(--landing-ink)] px-4 py-3">
                              <div className="font-serif text-2xl text-white">0.18</div>
                              <div className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-500">Miniaturization</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </figure>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Pull-quote ribbon */}
        <div
          className="landing-marquee-wrap relative mt-20 overflow-hidden"
          style={{
            WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          }}
        >
          <div className="landing-marquee flex w-max" style={{ animationDuration: "55s" }}>
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden className="flex shrink-0 items-center">
                {PULL_QUOTES.map((q) => (
                  <span key={q} className="flex items-center gap-10 pr-10 font-serif italic text-3xl md:text-4xl text-zinc-900/25 whitespace-nowrap">
                    {q}
                    <span className="not-italic text-xl text-[var(--landing-accent-deep)]/60">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ────────────────────── FINAL CTA ────────────────────── */}
      <section ref={ctaRef} className="relative bg-[var(--landing-cream)] px-2 sm:px-3 pb-2 sm:pb-3">
        <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] bg-[var(--landing-ink)] text-white text-center py-28 lg:py-36">
          {/* Moving amber light + fine rings */}
          <motion.div
            aria-hidden
            style={{ x: ctaGlowX }}
            className="absolute -top-1/2 left-0 w-[80%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(232,162,92,0.28)_0%,transparent_55%)] pointer-events-none"
          />
          <div aria-hidden className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {[360, 560, 760, 960].map((d, k) => (
              <motion.span
                key={d}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * k, duration: 1.4, ease: EASE_OUT }}
                className="absolute rounded-full border border-white/[0.06]"
                style={{ width: d, height: d }}
              />
            ))}
          </div>

          <motion.div style={{ scale: ctaScale }} className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 mb-10">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)] animate-pulse" />
                <span className="text-[11px] font-bold text-white/70 tracking-[0.2em] uppercase">Free during open beta</span>
              </div>
            </Reveal>
            <h2 className="text-5xl sm:text-7xl lg:text-8xl font-medium tracking-[-0.045em] leading-[0.95] mb-8 text-white">
              <RevealWords
                text="Ready for clarity?"
                step={0.09}
                lastWordClassName="font-serif italic font-normal tracking-tight text-[var(--landing-accent)]"
              />
            </h2>
            <Reveal delay={0.25}>
              <p className="text-xl sm:text-2xl font-serif italic text-white/60 mb-12">
                Join thousands tracking with clinical precision.
              </p>
            </Reveal>
            <Reveal delay={0.4}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/sign-up"
                  className="group relative overflow-hidden inline-flex items-center gap-3 pl-8 pr-2 py-2 text-lg font-semibold text-zinc-950 bg-white rounded-full hover:scale-[1.03] active:scale-[0.98] transition-transform duration-300 shadow-[0_20px_60px_-15px_rgba(232,162,92,0.6)]"
                >
                  <span aria-hidden className="landing-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[var(--landing-accent)]/30 to-transparent pointer-events-none" />
                  Create Your Free Vault
                  <span className="flex items-center justify-center w-11 h-11 rounded-full bg-zinc-950 text-white group-hover:bg-[var(--landing-accent-deep)] transition-colors">
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </div>
            </Reveal>
          </motion.div>
        </div>
      </section>

      {/* ────────────────────── FOOTER ────────────────────── */}
      <footer className="relative bg-[var(--landing-cream)] text-zinc-600 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-20">
          <div className="grid lg:grid-cols-12 gap-14">
            {/* Brand + newsletter */}
            <Reveal className="lg:col-span-5">
              <DensifyLogomark tone="black" height={64} />
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-zinc-500">
                Clinical-grade hair restoration tracking. Measure density, decode your labs and share verified progress with the clinicians who treat you.
              </p>

              <form action="/sign-up" method="get" className="mt-8 max-w-sm">
                <label htmlFor="footer-email" className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-400">
                  Get early access
                </label>
                <div className="mt-3 flex items-center gap-2 rounded-full bg-white border border-zinc-900/10 p-1.5 pl-5 focus-within:border-[var(--landing-accent-deep)]/50 focus-within:shadow-[0_0_0_4px_rgba(232,162,92,0.15)] transition-[border-color,box-shadow]">
                  <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    id="footer-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@email.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-zinc-950 text-white text-sm font-semibold px-4 py-2 hover:bg-[var(--landing-accent-deep)] transition-colors"
                  >
                    Join
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  { icon: Lock, label: "End-to-end encrypted" },
                  { icon: Shield, label: "Private by default" },
                  { icon: Stethoscope, label: "Clinician-ready reports" },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-900/10 bg-white/60 text-xs text-zinc-600">
                    <Icon className="w-3.5 h-3.5 text-[var(--landing-accent-deep)]" />
                    {label}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* Link columns */}
            <Reveal delay={0.1} className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-10">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.heading}>
                  <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-400">{col.heading}</div>
                  <ul className="mt-5 flex flex-col gap-3">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <Link href={l.href} className="group relative inline-flex items-center gap-1 text-sm text-zinc-700 hover:text-zinc-950 transition-colors">
                          <span className="relative">
                            {l.label}
                            <span className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 bg-[var(--landing-accent-deep)] group-hover:scale-x-100 transition-transform duration-300" />
                          </span>
                          {l.badge && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[var(--landing-accent-deep)]/10 text-[var(--landing-accent-deep)] text-[9px] font-bold uppercase tracking-wider">
                              {l.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Reveal>
          </div>

          {/* Oversized wordmark — copper light follows the pointer */}
          <div
            aria-hidden
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
              e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
            }}
            className="group/word relative mt-20 select-none"
          >
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: EASE_OUT }}
              className="text-center font-semibold tracking-[-0.06em] leading-[0.8] pb-[0.12em] text-[24vw] lg:text-[19rem] text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  "radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), rgba(196,110,48,0.85), rgba(12,10,9,0.07) 70%)",
              }}
            >
              Densify
            </motion.div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-zinc-900/10 py-8 flex flex-col md:flex-row gap-6 md:items-center md:justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} Densify. All rights reserved.</span>
              <span className="hidden sm:inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Open beta
              </span>
            </div>
            <span className="max-w-md md:text-center">
              Densify supports, but does not replace, professional medical advice, diagnosis or treatment.
            </span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })}
              className="group self-start md:self-auto inline-flex items-center gap-2 rounded-full border border-zinc-900/10 bg-white/60 px-4 py-2 text-zinc-700 hover:bg-zinc-950 hover:text-white hover:border-zinc-950 transition-colors"
            >
              Back to top
              <ArrowRight className="w-3.5 h-3.5 -rotate-90 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  )
}
