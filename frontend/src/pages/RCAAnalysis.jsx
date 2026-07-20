import { useState } from 'react'
import { Activity, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { analyzeRCA } from '../api'
import { useTheme } from '../ThemeContext'

function getErrorMessage(err, tag) {
  if (!err.response) return "Cannot reach backend. Check the FastAPI server is running on port 8080."
  if (err.response?.status === 404) return `Equipment tag '${tag}' not found in the knowledge graph. Try one of the tags below.`
  if (err.response?.status >= 500) return "Backend error. Check that the FastAPI server is running."
  return err.response?.data?.detail || "Request failed."
}

const SUGGESTIONS = ['P-101A', 'P-101B', 'E-201', 'V-301', 'T-601']

export default function RCAAnalysis() {
  const { theme: S } = useTheme()
  const [tag, setTag] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const RISK = {
    HIGH:   { color: S.red,   bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   Icon: TrendingUp   },
    MEDIUM: { color: S.amber, bg: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.3)',  Icon: Minus        },
    LOW:    { color: S.green, bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)',  Icon: TrendingDown },
  }

  const run = async (equipTag) => {
    const t = equipTag || tag
    if (!t.trim()) return
    setLoading(true); setError(null); setResult(null)
    try { const { data } = await analyzeRCA(t.trim()); setResult(data) }
    catch (err) { setError(getErrorMessage(err, t.trim())) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      <p style={{ margin: '0 0 6px', fontSize: 10, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: RCA-ANALYSIS</p>
      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: S.text }}>RCA Analysis</h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: S.muted }}>AI-generated root cause analysis from Neo4j graph data</p>
      <div style={{ height: 1, background: S.border, marginBottom: 24 }} />

      {/* Input */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 2, padding: 20, marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>EQUIPMENT SELECTOR</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={tag} onChange={e => { setTag(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Enter equipment tag, e.g. P-101A"
            style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2, padding: '9px 12px', fontSize: 13, color: S.text, fontFamily: S.mono, outline: 'none', letterSpacing: '0.05em', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = S.cyan}
            onBlur={e => e.target.style.borderColor = S.border}
          />
          <button onClick={() => run()} disabled={loading || !tag.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: loading || !tag.trim() ? S.border : S.cyan, color: loading || !tag.trim() ? S.muted : '#0a0e14', border: 'none', borderRadius: 2, fontSize: 11, fontWeight: 600, fontFamily: S.mono, letterSpacing: '0.08em', cursor: loading || !tag.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={13} />}
            {loading ? 'ANALYZING…' : 'RUN ANALYSIS'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setTag(s); run(s) }} disabled={loading}
              style={{ fontFamily: S.mono, fontSize: 10, padding: '3px 8px', border: `1px solid ${S.border}`, borderRadius: 2, background: 'transparent', color: S.muted, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em', opacity: loading ? 0.4 : 1, transition: 'all 0.1s' }}
              onMouseEnter={e => !loading && (e.target.style.borderColor = S.cyan, e.target.style.color = S.cyan)}
              onMouseLeave={e => (e.target.style.borderColor = S.border, e.target.style.color = S.muted)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 2, marginBottom: 16 }}>
          <AlertCircle size={14} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', textAlign: 'center' }}>
          <Activity size={36} style={{ color: S.border, marginBottom: 12 }} />
          <p style={{ margin: '0 0 4px', fontSize: 13, color: S.muted }}>Select an equipment tag to view its RCA</p>
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, opacity: 0.5 }}>AWAITING SELECTION</p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: '#a78bfa', animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>QUERYING GRAPH · GENERATING NARRATIVE…</p>
        </div>
      )}

      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: S.border, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: S.border }}>
            {/* Risk score */}
            <div style={{ background: S.surface, padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>RISK SCORE</p>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 600, fontFamily: S.mono, color: S.text, lineHeight: 1 }}>{result.risk_score}</p>
              <p style={{ margin: '4px 0 0', fontSize: 10, fontFamily: S.mono, color: S.muted }}>/ 100</p>
            </div>
            {/* Risk level */}
            {(() => {
              const cfg = RISK[result.risk_level] || RISK.MEDIUM
              return (
                <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>RISK LEVEL</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <cfg.Icon size={18} style={{ color: cfg.color }} />
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: S.mono, color: cfg.color }}>{result.risk_level}</p>
                  </div>
                </div>
              )
            })()}
            {/* Events */}
            <div style={{ background: S.surface, padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>RECORDED EVENTS</p>
              <p style={{ margin: 0, fontSize: 11, fontFamily: S.mono, color: S.muted }}>FAILURES</p>
              <p style={{ margin: '2px 0 6px', fontSize: 22, fontWeight: 600, fontFamily: S.mono, color: S.red }}>{result.failure_count}</p>
              <p style={{ margin: 0, fontSize: 11, fontFamily: S.mono, color: S.muted }}>INCIDENTS</p>
              <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 600, fontFamily: S.mono, color: S.amber }}>{result.incident_count}</p>
            </div>
          </div>
          {/* Narrative */}
          <div style={{ background: S.surface, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>RCA NARRATIVE</p>
              <span style={{ fontFamily: S.mono, fontSize: 9, color: S.cyan, letterSpacing: '0.05em' }}>{result.equipment_tag}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: S.text, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{result.narrative}</p>
          </div>
        </div>
      )}
    </div>
  )
}
