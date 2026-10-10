"use client"

import { createContext, useContext, useEffect, useState } from "react"

// Suppress the React 19 false-positive warning about "Encountered a script tag" in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const origError = console.error
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return
    }
    origError.apply(console, args)
  }
}

type Theme = "dark" | "light"

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  // Initialise from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("densify-theme") as Theme | null
    if (stored === "light" || stored === "dark") {
      setTheme(stored)
      applyTheme(stored)
    } else {
      // Default to dark
      applyTheme("dark")
    }
    setMounted(true)
  }, [])

  function applyTheme(t: Theme) {
    const root = document.documentElement
    if (t === "light") {
      root.classList.add("light")
      root.classList.remove("dark")
    } else {
      root.classList.remove("light")
      root.classList.add("dark-mode") // marker only — :root handles dark styles by default
      root.classList.remove("dark-mode")
    }
  }

  function toggle() {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
    localStorage.setItem("densify-theme", next)
  }

  // Suppress hydration mismatch warning since we intentionally change theme after mount
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme, toggle }}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
