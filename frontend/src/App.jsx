import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Activity, Search, AlertTriangle, FileText, LayoutDashboard, Zap, GitFork, Upload, Sun, Moon } from 'lucide-react'
import Dashboard      from './pages/Dashboard'
import RAGQuery       from './pages/RAGQuery'
import RCAAnalysis    from './pages/RCAAnalysis'
import ComplianceCAR  from './pages/ComplianceCAR'
import OverdueTasks   from './pages/OverdueTasks'
import KnowledgeGraph from './pages/KnowledgeGraph'
import Ingest         from './pages/Ingest'
import { ThemeProvider, useTheme } from './ThemeContext'
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: S.bg, color: S.text, transition: 'background 0.2s, color 0.2s' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{ width: 220, background: S.bg, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'background 0.2s, border-color 0.2s' }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: S.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
              <Zap size={15} style={{ color: '#0a0e14' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: S.text, letterSpacing: '0.05em', lineHeight: 1.2 }}>INDUSTRIALMIND</p>
              <p style={{ margin: 0, fontSize: 10, color: S.muted, fontFamily: S.mono, letterSpacing: '0.03em' }}>v0.1.0 · ONLINE</p>
            </div>
          </div>
        </div>

        {/* Nav label */}
        <div style={{ padding: '12px 16px 4px' }}>
          <p style={{ margin: 0, fontSize: 9, color: S.muted, letterSpacing: '0.12em', fontFamily: S.mono }}>NAVIGATION</p>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 2,
                fontSize: 11,
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
              {label}
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
            {isDark ? 'LIGHT MODE' : 'DARK MODE'}
          </button>
        </div>

        {/* Status footer */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: `1px solid ${S.border}`, borderRadius: 2, background: S.surface }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 9, color: '#10b981', fontFamily: S.mono, letterSpacing: '0.05em' }}>GROQ LLM · CONNECTED</p>
              <p style={{ margin: 0, fontSize: 9, color: S.muted, fontFamily: S.mono }}>llama-3.3-70b-versatile</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', background: S.bg, transition: 'background 0.2s' }}>
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
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ThemeProvider>
  )
}
