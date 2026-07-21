import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { useTheme } from '../ThemeContext'

const ToastCtx = createContext({ showToast: () => {} })

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: '#10b981',
  error: '#ef4444',
  info: '#22d3ee',
}

export function ToastProvider({ children }) {
  const { theme: S } = useTheme()
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, message }])
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 120, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
        {toasts.map(toast => {
          const Icon = ICONS[toast.type] || Info
          const color = COLORS[toast.type] || COLORS.info
          return (
            <div key={toast.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', background: S.surface, border: `1px solid ${color}66`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
              <Icon size={15} style={{ color, flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: S.text }}>{toast.message}</p>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
