import { useNavigate } from 'react-router-dom'
import { Activity, FileText, AlertTriangle, ArrowRight, Search, GitFork, Upload } from 'lucide-react'
import { useTheme } from '../ThemeContext'

export default function Dashboard() {
  const { theme: S } = useTheme()
  const navigate = useNavigate()

  const cards = [
    { icon: Search,        label: 'RAG QUERY',      href: '/query',      accent: S.cyan,    desc: 'Natural-language Q&A over ingested documents with source citations.' },
    { icon: Activity,      label: 'RCA ANALYZE',    href: '/rca',        accent: '#a78bfa', desc: 'AI root cause analysis with risk scoring for any equipment tag.' },
    { icon: AlertTriangle, label: 'OVERDUE TASKS',  href: '/compliance', accent: S.amber,   desc: 'Live view of all compliance tasks past their due date.' },
    { icon: FileText,      label: 'GEN CAR',        href: '/car',        accent: S.green,   desc: 'Generate formal Corrective Action Reports for non-compliant equipment.' },
    { icon: GitFork,       label: 'KNOWLEDGE GRAPH',href: '/graph',      accent: '#e879f9', desc: 'Interactive D3 force graph of equipment relationships and failures.' },
    { icon: Upload,        label: 'INGEST',          href: '/ingest',     accent: '#38bdf8', desc: 'Upload and embed industrial documents into the ChromaDB vector store.' },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>

      {/* Eyebrow */}
      <p style={{ margin: '0 0 8px', fontSize: 10, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: OVERVIEW</p>

      {/* Title */}
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, color: S.text, letterSpacing: '0.02em' }}>System Dashboard</h1>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: S.muted }}>RAG-powered industrial operations knowledge system</p>

      <div style={{ height: 1, background: S.border, marginBottom: 28 }} />

      {/* Module cards */}
      <p style={{ margin: '0 0 12px', fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>AVAILABLE MODULES</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: S.border, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 28 }}>
        {cards.map(({ icon: Icon, label, href, accent, desc }) => (
          <button
            key={href}
            onClick={() => navigate(href)}
            style={{ background: S.surface, border: 'none', cursor: 'pointer', padding: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = S.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.background = S.surface}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={14} style={{ color: accent }} />
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: S.mono, color: accent, letterSpacing: '0.1em' }}>{label}</span>
              </div>
              <ArrowRight size={13} style={{ color: S.border }} />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>{desc}</p>
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: S.border, marginBottom: 20 }} />

      {/* Stack */}
      <p style={{ margin: '0 0 10px', fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>TECHNOLOGY STACK</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['FastAPI', 'Neo4j', 'ChromaDB', 'LLaMA-3.3-70B', 'Groq', 'LangChain', 'React', 'D3.js'].map(t => (
          <span key={t} style={{ fontFamily: S.mono, fontSize: 10, padding: '3px 8px', border: `1px solid ${S.border}`, borderRadius: 2, color: S.muted, letterSpacing: '0.05em' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}
