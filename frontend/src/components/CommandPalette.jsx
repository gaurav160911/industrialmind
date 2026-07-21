import { useEffect, useMemo, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { useTheme } from '../ThemeContext'

export default function CommandPalette({ open, onClose, commands = [] }) {
  const { theme: S } = useTheme()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c =>
      [c.label, c.group, c.keywords].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive(i => Math.min(filtered.length - 1, i + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive(i => Math.max(0, i - 1))
      }
      if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault()
        filtered[active].action?.()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, filtered, onClose, open])

  if (!open) return null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.65)', zIndex: 110, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 92vw)', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${S.border}` }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search modules, equipment tags, and recent actions…"
            style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 15, padding: '10px 12px', color: S.text }}
          />
        </div>
        <div style={{ maxHeight: 420, overflow: 'auto', padding: 8 }}>
          {filtered.length === 0 && (
            <p style={{ margin: 0, padding: 14, fontSize: 13, color: S.muted }}>No matching commands.</p>
          )}
          {filtered.map((c, i) => (
            <button
              key={`${c.group}-${c.label}-${i}`}
              onClick={() => { c.action?.(); onClose() }}
              style={{ width: '100%', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: i === active ? `${S.cyan}1f` : 'transparent', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <c.icon size={14} style={{ color: i === active ? S.cyan : S.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, color: S.text }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>{c.group}</p>
              </div>
              {c.recent && <Clock3 size={12} style={{ color: S.muted }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
