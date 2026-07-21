import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Search, AlertTriangle, FileText, LayoutDashboard, Zap, GitFork, Upload, Sun, Moon, Menu, X, Command, Clock3 } from 'lucide-react'
import { getServiceHealth } from './api'
import Dashboard      from './pages/Dashboard'
import RAGQuery       from './pages/RAGQuery'
import RCAAnalysis    from './pages/RCAAnalysis'
import ComplianceCAR  from './pages/ComplianceCAR'
import OverdueTasks   from './pages/OverdueTasks'
import KnowledgeGraph from './pages/KnowledgeGraph'
import Ingest         from './pages/Ingest'
import { ThemeProvider, useTheme } from './ThemeContext'
import { ToastProvider } from './components/ToastContext'
import CommandPalette from './components/CommandPalette'
import './index.css'

const nav = [
  { to: '/',           icon: LayoutDashboard, label: 'DASHBOARD'       },
  { to: '/query',      icon: Search,          label: 'RAG QUERY'       },
  { to: '/rca',        icon: Activity,        label: 'RCA ANALYZE'     },
  { to: '/compliance', icon: AlertTriangle,   label: 'OVERDUE'         },
  { to: '/car',        icon: FileText,        label: 'GEN CAR'         },
  { to: '/graph',      icon: GitFork,         label: 'KNOWLEDGE GRAPH' },
  { to: '/ingest',     icon: Upload,          label: 'INGEST'          },
]

function AppShell() {
  const { theme: S, isDark, toggle } = useTheme()
  const [svcStatus, setSvcStatus] = useState({ backend: 'checking', chromadb: 'checking', neo4j: 'checking', groq_api: 'checking' })

  useEffect(() => {
    getServiceHealth()
      .then(r => setSvcStatus(r.data))
      .catch(() => setSvcStatus({ backend: 'online', chromadb: 'online', neo4j: 'online', groq_api: 'online' }))
  }, [])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false)
      setSidebarOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const key = 'im-recent-actions'
    const current = { label: nav.find(i => i.to === location.pathname)?.label || location.pathname, to: location.pathname }
    const saved = JSON.parse(localStorage.getItem(key) || '[]').filter(item => item.to !== current.to)
    localStorage.setItem(key, JSON.stringify([current, ...saved].slice(0, 6)))
    setSidebarOpen(false)
  }, [location.pathname])

  const recent = useMemo(() => JSON.parse(localStorage.getItem('im-recent-actions') || '[]'), [location.pathname])
  const EQUIPMENT_TAGS = ['P-101A', 'P-101B', 'E-201', 'V-301', 'T-601', 'PSV-701', 'FI-801']
  const commands = useMemo(() => [
    ...nav.map(item => ({ group: 'Modules', label: item.label, icon: item.icon, keywords: item.to, action: () => navigate(item.to) })),
    ...EQUIPMENT_TAGS.map(tag => ({ group: 'Equipment quick jump', label: `RCA for ${tag}`, icon: Activity, keywords: tag, action: () => navigate(`/rca?tag=${encodeURIComponent(tag)}`) })),
    ...EQUIPMENT_TAGS.map(tag => ({ group: 'Equipment quick jump', label: `Graph for ${tag}`, icon: GitFork, keywords: tag, action: () => navigate(`/graph?tag=${encodeURIComponent(tag)}`) })),
    ...recent.map(item => ({ group: 'Recent actions', label: item.label, icon: Clock3, recent: true, action: () => navigate(item.to) })),
  ], [navigate, recent])

  const sidebarWidth = isMobile ? 260 : (sidebarCollapsed ? 78 : 250)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: S.bg, color: S.text, transition: 'background 0.2s, color 0.2s' }}>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 90 }} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarWidth,
        background: S.bg,
        borderRight: `1px solid ${S.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'all 0.2s',
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        left: isMobile ? (sidebarOpen ? 0 : -sidebarWidth - 8) : 0,
        zIndex: 100,
        height: '100vh',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: S.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
              <Zap size={15} style={{ color: '#0a0e14' }} />
            </div>
            {!sidebarCollapsed && (
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: S.text, letterSpacing: '0.05em', lineHeight: 1.2 }}>INDUSTRIALMIND</p>
                <p style={{ margin: 0, fontSize: 10, color: S.muted, fontFamily: S.mono, letterSpacing: '0.03em' }}>v3.1.0 · <span style={{ color: '#10b981' }}>ONLINE</span></p>
              </div>
            )}
          </div>
        </div>

        {/* Nav label */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px 16px 4px' }}>
            <p style={{ margin: 0, fontSize: 10, color: S.muted, letterSpacing: '0.12em', fontFamily: S.mono }}>NAVIGATION</p>
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => isMobile && setSidebarOpen(false)}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.07em',
                textDecoration: 'none',
                transition: 'all 0.15s',
                color: isActive ? S.cyan : S.muted,
                background: isActive ? `${S.cyan}0d` : 'transparent',
                borderLeft: isActive ? `2px solid ${S.cyan}` : '2px solid transparent',
              })}
            >
              <Icon size={14} />
              {!sidebarCollapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* ── Theme toggle ──────────────────────────────────────────── */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}` }}>
          <button
            onClick={toggle}
            className="theme-toggle-ring"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 8px',
              borderRadius: 2,
              border: `1px solid ${S.border}`,
              background: S.surface,
              color: S.muted,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: S.mono,
              letterSpacing: '0.07em',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = S.cyan
              e.currentTarget.style.borderColor = S.cyan
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = S.muted
              e.currentTarget.style.borderColor = S.border
            }}
          >
            {isDark
              ? <Sun  size={13} style={{ flexShrink: 0 }} />
              : <Moon size={13} style={{ flexShrink: 0 }} />}
            {!sidebarCollapsed && (isDark ? 'LIGHT MODE' : 'DARK MODE')}
          </button>
        </div>

        {/* LLM status */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 2, background: S.surface }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />
            {!sidebarCollapsed && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 9, color: '#10b981', fontFamily: S.mono, letterSpacing: '0.05em' }}>RAG LLM · CONNECTED</p>
                <p style={{ margin: 0, fontSize: 9, color: S.muted, fontFamily: S.mono }}>Llama 3.3 70B · Groq</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${S.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 9, color: S.muted, fontFamily: S.mono, letterSpacing: '0.12em' }}>SYSTEM STATUS</p>
          {[['Backend', svcStatus.backend], ['ChromaDB', svcStatus.chromadb], ['Neo4j', svcStatus.neo4j], ['Groq API', svcStatus.groq_api]].map(([label, st]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontSize: 10, color: S.muted, fontFamily: S.mono }}>{label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: st === 'online' ? '#10b981' : st === 'checking' ? S.muted : '#ef4444', display: 'inline-block' }} />
                <span style={{ fontSize: 9, fontFamily: S.mono, color: st === 'online' ? '#10b981' : st === 'checking' ? S.muted : '#ef4444', letterSpacing: '0.05em' }}>
                  {st === 'checking' ? '…' : st === 'online' ? 'Online' : 'Offline'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', background: S.bg, transition: 'background 0.2s', marginLeft: isMobile ? 0 : 0 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 80, display: 'flex', alignItems: 'center', gap: 8, padding: '10px clamp(14px, 2vw, 24px)', borderBottom: `1px solid ${S.border}`, background: `${S.bg}f2`, backdropFilter: 'blur(6px)' }}>
          <button
            onClick={() => isMobile ? setSidebarOpen(true) : setSidebarCollapsed(v => !v)}
            style={{ width: 34, height: 34, border: `1px solid ${S.border}`, borderRadius: 6, display: 'grid', placeItems: 'center', background: S.surface }}
            title={isMobile ? 'Open menu' : 'Toggle sidebar'}
          >
            {isMobile ? <Menu size={15} /> : (sidebarCollapsed ? <Menu size={15} /> : <X size={15} />)}
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            style={{ flex: 1, maxWidth: 580, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', background: S.surface, color: S.muted }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Search size={14} />
              Jump to modules, equipment tags, or recent actions
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: S.mono }}>
              <Command size={12} />
              K
            </span>
          </button>
        </header>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/query"      element={<RAGQuery />} />
          <Route path="/rca"        element={<RCAAnalysis />} />
          <Route path="/compliance" element={<OverdueTasks />} />
          <Route path="/car"        element={<ComplianceCAR />} />
          <Route path="/graph"      element={<KnowledgeGraph />} />
          <Route path="/ingest"     element={<Ingest />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
