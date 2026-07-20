import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ── Palette definitions ────────────────────────────────────────────────────
export const DARK = {
  bg:      '#0a0e14',
  surface: '#11151d',
  surfaceHover: '#161b25',
  border:  '#1f2530',
  text:    '#e4e7ec',
  muted:   '#6b7280',
  cyan:    '#22d3ee',
  amber:   '#f5a623',
  red:     '#ef4444',
  green:   '#10b981',
  mono:    "'IBM Plex Mono', monospace",
}

export const LIGHT = {
  bg:      '#f0f4f8',
  surface: '#ffffff',
  surfaceHover: '#f7f9fc',
  border:  '#d1d9e6',
  text:    '#1a202c',
  muted:   '#64748b',
  cyan:    '#0891b2',
  amber:   '#d97706',
  red:     '#dc2626',
  green:   '#059669',
  mono:    "'IBM Plex Mono', monospace",
}

// ── CSS custom-property sync ───────────────────────────────────────────────
function applyTheme(palette) {
  const root = document.documentElement
  root.setAttribute('data-theme', palette === LIGHT ? 'light' : 'dark')
  root.style.setProperty('--bg',      palette.bg)
  root.style.setProperty('--surface', palette.surface)
  root.style.setProperty('--border',  palette.border)
  root.style.setProperty('--text',    palette.text)
  root.style.setProperty('--muted',   palette.muted)
  root.style.setProperty('--cyan',    palette.cyan)
}

// ── Context ────────────────────────────────────────────────────────────────
const ThemeCtx = createContext({ theme: DARK, isDark: true, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('im-theme')
    return saved ? saved === 'dark' : true
  })

  const palette = isDark ? DARK : LIGHT

  useEffect(() => {
    applyTheme(palette)
    localStorage.setItem('im-theme', isDark ? 'dark' : 'light')
    // also update body background so full-page matches
    document.body.style.background = palette.bg
    document.body.style.color      = palette.text
  }, [isDark, palette])

  const toggle = useCallback(() => setIsDark(d => !d), [])

  return (
    <ThemeCtx.Provider value={{ theme: palette, isDark, toggle }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeCtx)
}
