"use client"

import { getPublicApiUrl } from "@/lib/api-url"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import { DensifyLogomark } from "@/components/densify-logomark"
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
  Quote
} from "lucide-react"

/* ─── Animated counter hook ─── */
function useCounter(end: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      setValue(Math.floor(progress * end))
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

  // -- HERO SCROLL ANIMATIONS --
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })

  const heroTextOpacity = useTransform(heroProgress, [0, 0.3], [1, 0])
  const heroTextY = useTransform(heroProgress, [0, 0.3], [0, -100])
  
  const phoneScale = useTransform(heroProgress, [0, 0.6], [0.8, 1.1])
  const phoneY = useTransform(heroProgress, [0, 1], [0, -60])

  // -- STATS OBSERVER --
  const statsRef = useRef<HTMLDivElement>(null)
  const statsInView = useInView(statsRef, { once: true, margin: "-100px" })
  const statUsers = useCounter(12400, 2200, statsInView)
  const statScans = useCounter(847000, 2400, statsInView)
  const statClinicians = useCounter(320, 1800, statsInView)

  // -- TERMINAL EFFECT --
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInView = useInView(terminalRef, { once: true, margin: "-150px" })
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
    <div className="relative min-h-screen bg-white text-zinc-900 overflow-x-hidden selection:bg-[var(--color-clinical-cyan)] selection:text-zinc-950 font-sans">
      {/* ────────────────────── NAVBAR ────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          navBlurred
            ? "bg-white/80 backdrop-blur-xl border-b border-zinc-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 lg:px-8 h-20">
          <Link href="/landing" className="flex items-center group">
            {/* Using the light-theme logo explicitly since the landing page is light mode */}
            <img 
              src="/densify-logo-light.svg" 
              alt="Densify" 
              height={60} 
              style={{ height: 60, width: "auto", display: "block" }} 
              className="group-hover:scale-105 transition-transform" 
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors rounded-full hover:bg-zinc-100"
            >
              Log In
            </Link>
            <Link
              href="/sign-up"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 rounded-full hover:bg-zinc-800 transition-all hover:shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98]"
            >
              Sign Up
            </Link>
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-zinc-900 hover:bg-zinc-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-zinc-100 px-6 pb-6 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
          </div>
        )}
      </nav>

      {/* ────────────────────── MINIMALIST SPLIT HERO ────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen bg-white flex items-center pt-12 pb-20 lg:pt-0 lg:pb-0 overflow-hidden">
        {/* Subtle Background Texture */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,rgba(0,0,0,0.02)_0%,transparent_50%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.02)_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--color-clinical-blue) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="mx-auto max-w-7xl px-6 lg:px-8 w-full z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center min-h-[calc(100vh-4rem)]">
            
            {/* Left: Branding & Copy */}
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start pt-10 lg:pt-0 mt-20 lg:mt-0"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-50 border border-zinc-200 mb-8">
                <div className="w-2 h-2 rounded-full bg-[var(--color-clinical-blue)] animate-pulse" />
                <span className="text-[11px] font-bold text-zinc-600 tracking-[0.2em] uppercase">Now in Open Beta</span>
              </div>

              <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter text-zinc-900 leading-[0.95]">
                Clinical Precision.
                <br />
                <span className="text-zinc-300">Radical Clarity.</span>
              </h1>

              <p className="mt-8 text-xl text-zinc-500 max-w-md font-serif italic">
                Replace subjective guesswork with AI-powered biometric tracking. The ultimate vault for your hair progression.
              </p>

              <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto group">
                  <Link
                    href="/sign-up"
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold text-white bg-zinc-950 rounded-full hover:bg-[var(--color-clinical-blue)] transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_30px_-8px_var(--color-clinical-blue)]"
                  >
                    Start Your Journey
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>
                <Link
                  href="/sign-in"
                  className="w-full sm:w-auto flex items-center justify-center px-8 py-4 text-base font-bold text-zinc-600 bg-zinc-50 rounded-full hover:bg-zinc-100 transition-all duration-300"
                >
                  Log In
                </Link>
              </div>
            </motion.div>

            {/* Right: Floating Phone Mockup */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="relative flex justify-center lg:justify-end items-center h-full z-20"
            >
              {/* Parallax Wrapper */}
              <motion.div style={{ y: phoneY }}>
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
                    <span className="text-[10px] font-bold bg-[var(--color-clinical-blue)] text-white px-2 py-1 rounded-full uppercase tracking-wider">+12%</span>
                  </div>
                  
                  <div className="relative w-full aspect-square rounded-2xl bg-zinc-100 overflow-hidden mb-6 border border-zinc-200 shadow-inner">
                    <img src="/hero-model.png" alt="Scan" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <div className="w-full">
                        <div className="flex justify-between text-white text-xs mb-1">
                          <span>Baseline</span>
                          <span>Current</span>
                        </div>
                        <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
                          <div className="w-[68%] h-full bg-[var(--color-clinical-cyan)]"></div>
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
                      <span className="text-[9px] font-medium text-[var(--color-clinical-cyan)] bg-[var(--color-clinical-cyan)]/10 px-2 py-0.5 rounded-full">2 Tasks</span>
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
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-clinical-blue)]"></div>
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
        </div>
      </section>

      {/* ────────────────────── STATS STRIP ────────────────────── */}
      <section ref={statsRef} className="py-20 bg-white relative z-30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-zinc-100">
            <div className="pt-6 md:pt-0">
              <div className="font-serif text-6xl md:text-7xl font-medium tracking-tight text-zinc-900 mb-2">
                {statUsers.toLocaleString()}+
              </div>
              <div className="text-sm font-bold text-zinc-400 tracking-[0.2em] uppercase">Active Vaults</div>
            </div>
            <div className="pt-6 md:pt-0">
              <div className="font-serif text-6xl md:text-7xl font-medium tracking-tight text-zinc-900 mb-2">
                {statScans.toLocaleString()}+
              </div>
              <div className="text-sm font-bold text-zinc-400 tracking-[0.2em] uppercase">Scans Analyzed</div>
            </div>
            <div className="pt-6 md:pt-0">
              <div className="font-serif text-6xl md:text-7xl font-medium tracking-tight text-zinc-900 mb-2">
                {statClinicians.toLocaleString()}+
              </div>
              <div className="text-sm font-bold text-[var(--color-clinical-blue)] tracking-[0.2em] uppercase">Partner Clinicians</div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────── ENGINE ROOM (BEDROCK) ────────────────────── */}
      <section className="py-32 bg-zinc-950 text-white relative overflow-hidden">
        {/* Cinematic glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--color-clinical-blue)] opacity-[0.07] blur-[150px] pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
                <Brain className="w-3.5 h-3.5 text-[var(--color-clinical-cyan)]" />
                <span className="text-[11px] font-bold text-[var(--color-clinical-cyan)] tracking-[0.2em] uppercase">The Bedrock Engine</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter leading-[1.1] mb-6">
                Meet our two specialists<br/>
                <span className="text-zinc-600">that will help you through your journey.</span>
              </h2>

              <p className="text-xl text-zinc-400 font-serif italic mb-24">
                Powered by Amazon Bedrock (Claude 4.5 Sonnet + Nova Lite).
              </p>

              <div className="grid sm:grid-cols-2 gap-x-5 gap-y-16 mt-20">
                {/* Persona 1: Dr. Claude */}
                <div className="relative group">
                  {/* Background & Orb (overflow hidden) */}
                  <div className="absolute inset-0 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden group-hover:bg-white/[0.06] transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--color-clinical-blue)] opacity-20 blur-3xl rounded-full group-hover:opacity-40 transition-opacity" />
                  </div>
                  
                  {/* Content (overflow visible for mascot) */}
                  <div className="relative px-6 pb-6 pt-16 flex flex-col items-center text-center">
                    {/* Underlay to block the card border from bleeding through the mix-blend-screen */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-16 bg-[radial-gradient(ellipse_at_center,black_40%,transparent_70%)] z-10 pointer-events-none" />
                    
                    {/* Floating 3D Mascot */}
                    <img 
                      src="/claude_boy_doctor.png" 
                      alt="Dr. Claude" 
                      style={{ WebkitMaskImage: "radial-gradient(circle at center, black 45%, transparent 75%)", maskImage: "radial-gradient(circle at center, black 45%, transparent 75%)" }}
                      className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 object-contain mix-blend-screen pointer-events-none drop-shadow-[0_0_15px_rgba(56,189,248,0.3)] z-20" 
                    />

                    <h3 className="text-xl font-bold text-white mb-1 tracking-tight relative z-30">Dr. Claude</h3>
                    <div className="text-[9px] font-bold tracking-[0.2em] text-[var(--color-clinical-blue)] uppercase mb-4 relative z-30">The Clinical Pathologist</div>
                    
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                      "I am here for you to help you analyze your unstructured medical reports to extract DHT, ferritin, and 40+ complex biomarkers with deep reasoning."
                    </p>

                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-[var(--color-clinical-blue)]/20 border border-[var(--color-clinical-blue)]/30 text-[var(--color-clinical-blue)] text-[9px] font-bold uppercase tracking-widest">Pathology</span>
                      <span className="px-2.5 py-1 rounded-full bg-[var(--color-clinical-blue)]/20 border border-[var(--color-clinical-blue)]/30 text-[var(--color-clinical-blue)] text-[9px] font-bold uppercase tracking-widest">Lab Data</span>
                    </div>
                  </div>
                </div>

                {/* Persona 2: Dr. Nova */}
                <div className="relative group">
                  {/* Background & Orb (overflow hidden) */}
                  <div className="absolute inset-0 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden group-hover:bg-white/[0.06] transition-colors">
                    <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[var(--color-clinical-cyan)] opacity-20 blur-3xl rounded-full group-hover:opacity-40 transition-opacity" />
                  </div>
                  
                  {/* Content (overflow visible for mascot) */}
                  <div className="relative px-6 pb-6 pt-16 flex flex-col items-center text-center">
                    {/* Underlay to block the card border from bleeding through the mix-blend-screen */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-16 bg-[radial-gradient(ellipse_at_center,black_40%,transparent_70%)] z-10 pointer-events-none" />
                    
                    {/* Floating 3D Mascot */}
                    <img 
                      src="/nova_girl_doctor.png" 
                      alt="Dr. Nova" 
                      style={{ WebkitMaskImage: "radial-gradient(circle at center, black 45%, transparent 75%)", maskImage: "radial-gradient(circle at center, black 45%, transparent 75%)" }}
                      className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 object-contain mix-blend-screen pointer-events-none drop-shadow-[0_0_15px_rgba(34,211,238,0.3)] z-20" 
                    />

                    <h3 className="text-xl font-bold text-white mb-1 tracking-tight relative z-30">Dr. Nova</h3>
                    <div className="text-[9px] font-bold tracking-[0.2em] text-[var(--color-clinical-cyan)] uppercase mb-4 relative z-30">The Chief Trichologist</div>
                    
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                      "I am here for you to help you visually scan your scalp photos in milliseconds to quantify individual follicular units with robotic accuracy."
                    </p>

                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-[var(--color-clinical-cyan)]/20 border border-[var(--color-clinical-cyan)]/30 text-[var(--color-clinical-cyan)] text-[9px] font-bold uppercase tracking-widest">Computer Vision</span>
                      <span className="px-2.5 py-1 rounded-full bg-[var(--color-clinical-cyan)]/20 border border-[var(--color-clinical-cyan)]/30 text-[var(--color-clinical-cyan)] text-[9px] font-bold uppercase tracking-widest">Speed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Lockup */}
              <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl w-fit">
                <Lock className="w-4 h-4 text-zinc-500" />
                <span className="text-xs text-zinc-400 font-medium">Secured by end-to-end encrypted medical vault</span>
              </div>
            </motion.div>

            {/* Terminal Window */}
            <motion.div 
              ref={terminalRef}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="rounded-xl bg-[#0a0a0a] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                </div>
                <div className="mx-auto text-[10px] font-mono text-zinc-500">densify-core-engine</div>
              </div>
              <div className="p-6 font-mono text-sm leading-relaxed text-[var(--color-clinical-cyan)] h-[250px]">
                {typedText}
                <motion.span 
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="inline-block w-2 h-4 bg-[var(--color-clinical-cyan)] ml-1 align-middle"
                />
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ────────────────────── WALL OF PROOF (MASONRY TESTIMONIALS) ────────────────────── */}
      <section className="py-32 bg-[#fafafa] relative overflow-hidden">
        {/* Brick wall pattern overlay */}
        <div 
          className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='42' height='44' viewBox='0 0 42 44' xmlns='http://www.w3.org/2000/svg'%3E%3Cg id='Page-1' fill='none' fill-rule='evenodd'%3E%3Cg id='brick-wall' fill='%23000000' fill-opacity='1'%3E%3Cpath d='M0 0h42v44H0V0zm1 1h40v20H1V1zM0 23h20v20H0V23zm22 0h20v20H22V23z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
        />
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-zinc-900 mb-6">
              The Wall of Proof.
            </h2>
            <p className="text-xl text-zinc-500 font-serif italic">
              Don&apos;t just take our word for it.
            </p>
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
            {[
              {
                name: "James R.",
                role: "Densify Pro · 8 mo",
                quote: "I finally have hard data to show my dermatologist. The density tracking is incredible — my clinician spotted a 12% improvement I would have completely missed.",
                avatar: "/avatar-1.png",
                size: "large"
              },
              {
                name: "Dr. Priya Mehta",
                role: "Board-Certified Trichologist",
                quote: "Densify has fundamentally changed how I monitor patient progress. The AI reports save me 30 minutes per consultation.",
                avatar: "/avatar-2.png",
                size: "medium"
              },
              {
                name: "Marcus T.",
                role: "Densify User · 14 mo",
                quote: "Stopped guessing, started measuring. Seeing the Week 1 vs Week 52 side-by-side gave me total confidence.",
                avatar: "/avatar-3.png",
                size: "medium"
              },
              {
                name: "Alex W.",
                role: "Densify Pro · 3 mo",
                quote: "The red/green quality lock for the camera means I never take a blurry progress pic again. Absolute game changer.",
                avatar: "/avatar-1.png", // reusing for demo
                size: "small"
              },
              {
                name: "Dr. S. K.",
                role: "Dermatologist",
                quote: "The ability for patients to securely forward their Bedrock-analyzed reports directly to my inbox is the bridge telehealth has been missing.",
                avatar: "/avatar-2.png", // reusing
                size: "large"
              }
            ].map((t, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`break-inside-avoid bg-white rounded-3xl p-8 border border-zinc-200/60 shadow-sm hover:shadow-xl hover:border-[var(--color-clinical-blue)]/30 transition-all duration-300 ${t.size === 'large' ? 'bg-zinc-900 text-white border-zinc-800' : ''}`}
              >
                <Quote className={`w-8 h-8 mb-6 ${t.size === 'large' ? 'text-zinc-700' : 'text-zinc-200'}`} />
                <p className={`font-serif text-xl leading-relaxed mb-8 ${t.size === 'large' ? 'text-zinc-200' : 'text-zinc-700'}`}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover grayscale" />
                  <div>
                    <div className={`font-bold ${t.size === 'large' ? 'text-white' : 'text-zinc-900'}`}>{t.name}</div>
                    <div className={`text-xs ${t.size === 'large' ? 'text-zinc-400' : 'text-zinc-500'}`}>{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── FINAL CTA ────────────────────── */}
      <section className="py-32 bg-[var(--color-clinical-blue)] text-white text-center">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2 className="text-5xl sm:text-7xl font-bold tracking-tighter mb-8 text-white">
            Ready for clarity?
          </h2>
          <p className="text-2xl font-serif italic text-white/80 mb-12">
            Join thousands tracking with clinical precision.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-3 px-10 py-5 text-lg font-bold text-[var(--color-clinical-blue)] bg-white rounded-full hover:scale-105 transition-transform duration-300 shadow-2xl"
          >
            Create Your Free Vault
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ────────────────────── FOOTER ────────────────────── */}
      <footer className="py-12 bg-zinc-950 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <DensifyLogomark height={24} className="invert brightness-0 opacity-50 hover:opacity-100 transition-opacity" />
          <div className="flex gap-8 text-sm text-zinc-500">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
