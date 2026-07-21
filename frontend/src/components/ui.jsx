import { useTheme } from '../ThemeContext'

export function PageWrap({ children, maxWidth = 980 }) {
  return <div style={{ padding: 'clamp(16px, 2.8vw, 32px)', maxWidth, margin: '0 auto' }}>{children}</div>
}

export function SectionLabel({ children, color }) {
  const { theme: S } = useTheme()
  return (
    <p style={{ margin: '0 0 10px', fontSize: 11, fontFamily: S.mono, color: color || S.muted, letterSpacing: '0.11em' }}>
      {children}
    </p>
  )
}

export function Panel({ children, style = {} }) {
  const { theme: S } = useTheme()
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: 18, ...style }}>{children}</div>
}
