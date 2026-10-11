"use client"

import { motion, useScroll, useSpring, type Variants } from "framer-motion"
import { useRef, type MouseEvent, type ReactNode } from "react"

/* Shared easing: fast start, long soft landing (easeOutQuint-ish). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE_OUT } },
}

export const stagger = (staggerChildren = 0.12, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
})

/* Masked line reveal: the child slides up from behind an overflow mask. */
export const lineUp: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 1, ease: EASE_OUT } },
}

/* Fade/blur-up a block once it enters the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

/* Word-by-word masked reveal. Words are separated by real spaces so the
   element's text content (and accessible name) stays identical to `text`. */
export function RevealWords({
  text,
  className,
  delay = 0,
  step = 0.07,
  lastWordClassName,
}: {
  text: string
  className?: string
  delay?: number
  step?: number
  /** Extra classes for the final word (e.g. a serif-italic accent). */
  lastWordClassName?: string
}) {
  const words = text.split(" ")
  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger(step, delay)}
    >
      {words.map((word, i) => (
        <span key={i}>
          <span className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em] pr-[0.1em] -mr-[0.1em]">
            <motion.span
              className={`inline-block will-change-transform ${i === words.length - 1 ? lastWordClassName ?? "" : ""}`}
              variants={lineUp}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </motion.span>
  )
}

/* Card with a soft radial highlight that follows the pointer. */
export function SpotlightCard({
  children,
  className,
  glow = "rgba(255,255,255,0.10)",
}: {
  children: ReactNode
  className?: string
  glow?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--sx", `${e.clientX - r.left}px`)
    el.style.setProperty("--sy", `${e.clientY - r.top}px`)
  }
  return (
    <div ref={ref} onMouseMove={onMove} className={`group/spot relative ${className ?? ""}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover/spot:opacity-100 transition-opacity duration-500 z-0"
        style={{ background: `radial-gradient(420px circle at var(--sx, 50%) var(--sy, 50%), ${glow}, transparent 60%)` }}
      />
      {children}
    </div>
  )
}

/* Thin spring-smoothed reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed top-0 inset-x-0 h-[2px] z-[60] origin-left bg-gradient-to-r from-[var(--landing-accent-deep)] to-[var(--landing-accent)]"
    />
  )
}
