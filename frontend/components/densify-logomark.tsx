"use client"

import { useTheme } from "@/components/theme-provider"

interface DensifyLogomarkProps {
  className?: string
  /**
   * "navbar" — uses the trimmed 400×80 dark/light logo (switches with theme).
   * "login"  — uses the trimmed 600×160 login logo (always dark/white mark).
   * Defaults to "navbar".
   */
  variant?: "navbar" | "login"
  /** Rendered height in px. Width scales automatically. */
  height?: number
}

export function DensifyLogomark({
  className = "",
  variant = "navbar",
  height,
}: DensifyLogomarkProps) {
  const { theme } = useTheme()

  let src: string
  let nativeHeight: number

  if (variant === "login") {
    src = "/densify-logo-login.svg"
    nativeHeight = 160
  } else {
    src = theme === "dark" ? "/densify-logo-dark.svg" : "/densify-logo-light.svg"
    nativeHeight = 80
  }

  const displayHeight = height ?? nativeHeight

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Densify"
      height={displayHeight}
      style={{ height: displayHeight, width: "auto", display: "block" }}
      className={className}
    />
  )
}
