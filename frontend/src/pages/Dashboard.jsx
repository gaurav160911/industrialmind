import { useNavigate } from 'react-router-dom'
import { Activity, FileText, AlertTriangle, ArrowRight, Search, GitFork, Upload, ShieldAlert, Siren, Factory } from 'lucide-react'
import { useTheme } from '../ThemeContext'
import { PageWrap, Panel, SectionLabel } from '../components/ui'

export default function Dashboard() {
  const { theme: S } = useTheme()
  const navigate = useNavigate()

  const cards = [
    { icon: Search,        label: 'RAG QUERY',       href: '/query',      accent: S.cyan,    desc: 'Natural-language Q&A over ingested documents with source citations.' },
    { icon: Activity,      label: 'RCA ANALYZE',     href: '/rca',        accent: '#a78bfa', desc: 'AI root cause analysis with risk scoring for any equipment tag.' },
    { icon: AlertTriangle, label: 'OVERDUE TASKS',   href: '/compliance', accent: S.amber,   desc: 'Live view of all compliance tasks past their due date.' },
    { icon: FileText,      label: 'GEN CAR',         href: '/car',        accent: S.green,   desc: 'Generate formal Corrective Action Reports for non-compliant equipment.' },
    { icon: GitFork,       label: 'KNOWLEDGE GRAPH', href: '/graph',      accent: '#e879f9', desc: 'Interactive D3 force graph of equipment relationships and failures.' },
    { icon: Upload,        label: 'INGEST',          href: '/ingest',     accent: '#38bdf8', desc: 'Upload and embed industrial documents into the ChromaDB vector store.' },
  ]

  const criticalNow = [
    { icon: ShieldAlert, label: 'Overdue compliance tasks', value: '12', trend: '+2 today', tone: S.amber },
    { icon: Siren, label: 'High risk assets', value: '4', trend: 'P-101A elevated', tone: '#f87171' },
    { icon: Factory, label: 'Recent incidents', value: '1', trend: 'Last 24h', tone: S.cyan },
  ]

  return (
    <PageWrap>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: OVERVIEW</p>
      <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(24px, 3vw, 30px)', fontWeight: 620, color: S.text }}>System Dashboard</h1>
      <p style={{ margin: '0 0 24px', fontSize: 15, color: S.muted }}>RAG-powered industrial operations knowledge system</p>

      <SectionLabel color={S.text}>CRITICAL NOW</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        {criticalNow.map(({ icon: Icon, label, value, trend, tone }) => (
          <Panel key={label} style={{ borderColor: `${tone}66`, background: `${tone}10`, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: S.muted }}>{label}</span>
              <Icon size={15} style={{ color: tone }} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 30, lineHeight: 1, fontWeight: 700, color: tone, fontFamily: S.mono }}>{value}</p>
            <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>{trend}</p>
          </Panel>
        ))}
      </div>

      <SectionLabel>AVAILABLE MODULES</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(({ icon: Icon, label, href, accent, desc }) => (
          <button
            key={href}
            onClick={() => navigate(href)}
            style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, cursor: 'pointer', padding: 18, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s, transform 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={16} style={{ color: accent }} />
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: S.mono, color: accent, letterSpacing: '0.1em' }}>{label}</span>
              </div>
              <ArrowRight size={13} style={{ color: S.border }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: S.text, lineHeight: 1.55 }}>{desc}</p>
          </button>
        ))}
      </div>

      <SectionLabel>TECHNOLOGY STACK</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['FastAPI', 'Neo4j', 'ChromaDB', 'LLaMA-3.3-70B', 'Groq', 'LangChain', 'React', 'D3.js'].map(t => (
          <span key={t} style={{ fontFamily: S.mono, fontSize: 11, padding: '4px 10px', border: `1px solid ${S.border}`, borderRadius: 999, color: S.muted, letterSpacing: '0.05em' }}>{t}</span>
        ))}
      </div>
    </PageWrap>
  )
}
