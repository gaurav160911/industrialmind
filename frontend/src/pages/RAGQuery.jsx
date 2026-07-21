import { useState } from 'react'
import {
  Send, Loader2, AlertCircle, MessageSquare,
  FileText, ChevronDown, ChevronUp, Eye,
  Lightbulb, CheckCircle2, AlertTriangle, Clock,
  Wrench, Shield, TrendingUp, Settings2,
} from 'lucide-react'
import { queryRAGStructured } from '../api'
import { useTheme } from '../ThemeContext'

// ── helpers ──────────────────────────────────────────────────────────────

function getErrorMessage(err) {
  if (!err.response) return 'Cannot reach backend. Check the FastAPI server is running on port 8080.'
  if (err.response?.status === 404) return err.response?.data?.detail || 'No relevant documents found. Ingest documents first.'
  if (err.response?.status >= 500) return err.response?.data?.detail || 'Backend error. Check deployment environment variables and dependent services.'
  return err.response?.data?.detail || 'Request failed.'
}

const BADGE_COLORS = {
  'NEAR MISS':   { bg: '#ef44441a', border: '#ef4444', text: '#fca5a5' },
  'INCIDENT':    { bg: '#ef44441a', border: '#ef4444', text: '#fca5a5' },
  'MAINTENANCE': { bg: '#f5a6231a', border: '#f5a623', text: '#fcd34d' },
  'DEFERRED':    { bg: '#a78bfa1a', border: '#a78bfa', text: '#c4b5fd' },
  'INSPECTION':  { bg: '#22d3ee1a', border: '#22d3ee', text: '#67e8f9' },
}

const STATUS_META = {
  'Normal':          { color: '#10b981', icon: '✓', label: 'Normal'          },
  'Needs Attention': { color: '#f5a623', icon: '!', label: 'Needs Attention' },
  'Critical':        { color: '#ef4444', icon: '✕', label: 'Critical'        },
}

const RISK_META = {
  LOW:      { color: '#10b981' },
  MEDIUM:   { color: '#f5a623' },
  HIGH:     { color: '#ef4444' },
  CRITICAL: { color: '#dc2626' },
}

// ── sub-components ───────────────────────────────────────────────────────

function StatusCard({ S, label, value, sub, color, icon: Icon }) {
  return (
    <div style={{
      flex: 1,
      background: S.surface,
      border: `1px solid ${S.border}`,
      borderRadius: 4,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: S.muted, letterSpacing: '0.05em' }}>{label}</span>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: S.muted }}>{sub}</p>}
    </div>
  )
}

function Badge({ type }) {
  const c = BADGE_COLORS[type] || BADGE_COLORS['INSPECTION']
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
      padding: '2px 7px', borderRadius: 2,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: "'IBM Plex Mono', monospace",
      whiteSpace: 'nowrap',
    }}>{type}</span>
  )
}

function SeverityDot({ severity }) {
  const col = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f5a623' : '#10b981'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block' }} />
      <span style={{ color: col }}>{severity}</span>
    </span>
  )
}

function TimelineSection({ S, timeline }) {
  const [showAll, setShowAll]     = useState(false)
  const [sortOrder, setSortOrder] = useState('newest')

  const sorted = [...timeline].sort((a, b) => {
    if (sortOrder === 'newest') return 0   // already newest-first from LLM
    return 1
  })
  const visible = showAll ? sorted : sorted.slice(0, 4)

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} style={{ color: S.cyan }} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: S.text }}>MAINTENANCE TIMELINE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: S.muted }}>Sort by:</span>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            style={{
              background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2,
              padding: '3px 8px', fontSize: 10, color: S.text,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <option value="newest">Date (Newest First)</option>
            <option value="oldest">Date (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((entry, i) => (
          <div
            key={entry.id + i}
            style={{
              display: 'flex', alignItems: 'stretch', gap: 0,
              borderBottom: i < visible.length - 1 ? `1px solid ${S.border}` : 'none',
            }}
          >
            {/* Date column */}
            <div style={{
              width: 90, flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '16px 12px', borderRight: `1px solid ${S.border}`,
              gap: 2,
            }}>
              {entry.date === '— Pending' || entry.date?.includes('Pending') ? (
                <>
                  <span style={{ fontSize: 18, color: S.muted }}>—</span>
                  <span style={{ fontSize: 9, color: S.muted, fontFamily: "'IBM Plex Mono', monospace" }}>Pending</span>
                </>
              ) : (() => {
                const parts = entry.date?.split(' ') || []
                return (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, color: S.text }}>{parts.slice(0, 2).join(' ')}</span>
                    <span style={{ fontSize: 10, color: S.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{parts[2] || ''}</span>
                  </>
                )
              })()}
            </div>

            {/* Timeline dot */}
            <div style={{ width: 1, background: S.border, position: 'relative', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10, height: 10, borderRadius: '50%',
                background: BADGE_COLORS[entry.type]?.border || S.cyan,
                border: `2px solid ${S.surface}`,
                zIndex: 1,
              }} />
            </div>

            {/* Main content */}
            <div style={{ flex: 1, padding: '14px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Badge type={entry.type} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: S.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {entry.id}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>{entry.description}</p>
              </div>
              {/* Meta */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160, alignItems: 'flex-end' }}>
                <span style={{ fontSize: 10, color: S.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={10} />
                  {entry.source}
                </span>
                {entry.severity && (
                  <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={10} style={{ color: S.muted }} />
                    Severity: <SeverityDot severity={entry.severity} />
                  </span>
                )}
                {entry.status && !entry.severity && (
                  <span style={{
                    fontSize: 10,
                    color: entry.status === 'Completed' ? '#10b981' : entry.status === 'Deferred' ? '#a78bfa' : S.muted,
                  }}>
                    Status: {entry.status}
                  </span>
                )}
                {entry.status && entry.severity && (
                  <span style={{
                    fontSize: 10,
                    color: entry.status === 'Completed' ? '#10b981' : entry.status === 'Deferred' ? '#a78bfa' : S.muted,
                  }}>
                    Status: {entry.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show more/less */}
      {timeline.length > 4 && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            width: '100%', padding: '10px', background: 'transparent',
            border: 'none', borderTop: `1px solid ${S.border}`,
            color: S.cyan, cursor: 'pointer', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em',
          }}
        >
          {showAll
            ? <><ChevronUp size={13} /> Show Less</>
            : <><ChevronDown size={13} /> Show {timeline.length - 4} More</>}
        </button>
      )}
    </div>
  )
}

function SourcesEvidence({ S, sources }) {
  const [expanded, setExpanded] = useState(null)

  // Group by source filename
  const grouped = sources.reduce((acc, s) => {
    const key = s.source || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const fileColors = {
    'incident_reports': '#ef4444',
    'shift_handover':   '#f5a623',
    'maintenance_logs': '#22d3ee',
    'rca_report':       '#a78bfa',
  }

  const getColor = (name) => {
    const lower = name.toLowerCase()
    for (const [key, color] of Object.entries(fileColors)) {
      if (lower.includes(key)) return color
    }
    return S.cyan
  }

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <FileText size={14} style={{ color: S.cyan }} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: S.text }}>SOURCES & EVIDENCE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {Object.entries(grouped).map(([filename, chunks]) => {
          const color = getColor(filename)
          const isOpen = expanded === filename
          return (
            <div key={filename} style={{ border: `1px solid ${S.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', background: S.bg }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <FileText size={14} style={{ color, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: S.text, wordBreak: 'break-word', lineHeight: 1.3 }}>{filename}</span>
                </div>
                <p style={{ margin: 0, fontSize: 10, color: S.muted }}>{chunks.length} relevant chunk{chunks.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => setExpanded(isOpen ? null : filename)}
                style={{
                  width: '100%', padding: '7px', background: 'transparent',
                  border: 'none', borderTop: `1px solid ${S.border}`,
                  color: S.cyan, cursor: 'pointer', fontSize: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                <Eye size={10} />
                {isOpen ? 'HIDE CHUNKS' : 'VIEW CHUNKS'}
              </button>
              {isOpen && (
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${S.border}`, background: S.surface }}>
                  {chunks.map((c, i) => (
                    <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < chunks.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 9, color: S.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
                        CHUNK #{c.chunk_index} · d={c.distance?.toFixed(3)}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: S.muted, lineHeight: 1.4 }}>
                        {c.content ? c.content.slice(0, 180) + (c.content.length > 180 ? '…' : '') : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        style={{
          marginTop: 14, width: '100%', padding: '9px',
          background: 'transparent', border: `1px solid ${S.border}`,
          borderRadius: 2, color: S.text, cursor: 'pointer',
          fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
        onClick={() => setExpanded(expanded ? null : Object.keys(grouped)[0])}
      >
        VIEW ALL SOURCES ↗
      </button>
    </div>
  )
}

// ── Main page component ──────────────────────────────────────────────────

export default function RAGQuery() {
  const { theme: S } = useTheme()
  const [question, setQuestion] = useState('')
  const [topK, setTopK]         = useState(5)
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [respTime, setRespTime] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true); setError(null); setResult(null); setRespTime(null)
    const t0 = Date.now()
    try {
      const { data } = await queryRAGStructured(question, topK)
      setResult(data)
      setRespTime(data.response_time_ms ?? (Date.now() - t0))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const overallMeta  = STATUS_META[result?.overall_status] || STATUS_META['Normal']
  const riskMeta     = RISK_META[result?.risk_level]        || RISK_META['LOW']

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>

      {/* Page header */}
      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: S.text }}>RAG Query</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: S.muted }}>Natural-language search over ingested industrial documents</p>

      {/* Query Input */}
      <form
        onSubmit={handleSubmit}
        style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: 20, marginBottom: 16 }}
      >
        <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>QUERY INPUT</p>
        <textarea
          id="rag-query-input"
          value={question}
          onChange={e => { setQuestion(e.target.value); setError(null) }}
          rows={3}
          placeholder="e.g. What is the maintenance history of P-101A and what patterns do you see?"
          style={{
            width: '100%', background: S.bg, border: `1px solid ${S.border}`,
            borderRadius: 2, padding: '10px 12px', fontSize: 13, color: S.text,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            boxSizing: 'border-box', transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = S.cyan}
          onBlur={e => e.target.style.borderColor = S.border}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Model badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, background: `${S.cyan}22`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings2 size={9} style={{ color: S.cyan }} />
              </div>
              <span style={{ fontSize: 10, color: S.muted, fontFamily: S.mono }}>Model: Llama 3.3 70B</span>
            </div>
            {/* Top-K */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, background: `${S.cyan}22`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={9} style={{ color: S.cyan }} />
              </div>
              <span style={{ fontSize: 10, color: S.muted, fontFamily: S.mono }}>Top-K:</span>
              <select
                id="rag-topk-select"
                value={topK}
                onChange={e => setTopK(Number(e.target.value))}
                style={{
                  background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2,
                  padding: '3px 8px', fontSize: 10, color: S.text, fontFamily: S.mono, outline: 'none',
                }}
              >
                {[3, 5, 8, 10].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <button
            id="rag-submit-btn"
            type="submit"
            disabled={loading || !question.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px',
              background: loading || !question.trim() ? S.border : S.cyan,
              color: loading || !question.trim() ? S.muted : '#0a0e14',
              border: 'none', borderRadius: 2,
              fontSize: 11, fontWeight: 700, fontFamily: S.mono, letterSpacing: '0.1em',
              cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {loading
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={13} />}
            {loading ? 'PROCESSING…' : 'SUBMIT QUERY'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', gap: 10, padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 4, marginBottom: 16,
        }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
          <MessageSquare size={36} style={{ color: S.border, marginBottom: 12 }} />
          <p style={{ margin: '0 0 4px', fontSize: 13, color: S.muted }}>Ask a question to see results here</p>
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, opacity: 0.5 }}>AWAITING INPUT</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: S.cyan, animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>QUERYING VECTOR STORE…</p>
        </div>
      )}

      {/* ── Structured result ──────────────────────────────────────────── */}
      {result && result.structured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status cards row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatusCard
              S={S}
              label="Overall Status"
              value={result.overall_status}
              sub={result.overall_status === 'Needs Attention' ? 'Requires monitoring & action' : undefined}
              color={overallMeta.color}
              icon={AlertTriangle}
            />
            <StatusCard
              S={S}
              label="Risk Level"
              value={result.risk_level}
              sub="High probability of recurrence"
              color={riskMeta.color}
              icon={Shield}
            />
            <StatusCard
              S={S}
              label="Total Incidents"
              value={result.total_incidents}
              sub="Near Miss incidents"
              color="#f5a623"
              icon={AlertCircle}
            />
            <StatusCard
              S={S}
              label="Total Work Orders"
              value={result.total_work_orders}
              sub="Maintenance activities"
              color={S.cyan}
              icon={Wrench}
            />
          </div>

          {/* Executive Summary */}
          <div style={{
            background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4,
            padding: '18px 20px',
            display: 'flex', gap: 20, alignItems: 'flex-start',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FileText size={14} style={{ color: S.cyan }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: S.text }}>EXECUTIVE SUMMARY</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: S.muted, lineHeight: 1.7 }}>
                {result.executive_summary}
              </p>
            </div>
            {result.equipment_tag && (
              <div style={{
                flexShrink: 0, width: 100, height: 80,
                background: `${S.cyan}0d`, border: `1px solid ${S.cyan}33`,
                borderRadius: 4, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {/* Industrial pump SVG */}
                <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                  <rect x="2" y="14" width="22" height="14" rx="2" fill={S.cyan} opacity="0.7" />
                  <circle cx="34" cy="21" r="13" stroke={S.cyan} strokeWidth="2" fill="none" opacity="0.6" />
                  <circle cx="34" cy="21" r="6" fill={S.cyan} opacity="0.4" />
                  <rect x="24" y="19" width="10" height="4" fill={S.cyan} opacity="0.7" />
                  <rect x="8" y="8" width="8" height="8" rx="1" fill="#f5a623" opacity="0.8" />
                  <rect x="4" y="28" width="18" height="3" rx="1" fill={S.cyan} opacity="0.5" />
                </svg>
                <span style={{ fontSize: 10, fontWeight: 700, color: S.cyan, fontFamily: S.mono }}>{result.equipment_tag}</span>
              </div>
            )}
          </div>

          {/* Maintenance Timeline */}
          {result.timeline?.length > 0 && (
            <TimelineSection S={S} timeline={result.timeline} />
          )}

          {/* AI Recommendations + Key Insights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Recommendations */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FileText size={14} style={{ color: S.green }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: S.text }}>AI RECOMMENDATIONS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={14} style={{ color: S.green, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ margin: 0, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Insights */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Lightbulb size={14} style={{ color: '#f5a623' }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: S.text }}>KEY INSIGHTS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.key_insights.map((ins, i) => {
                  const icons = [AlertCircle, AlertTriangle, Clock, TrendingUp, Shield]
                  const colors = ['#ef4444', '#f5a623', '#f5a623', S.muted, '#a78bfa']
                  const Icon = icons[i % icons.length]
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Icon size={13} style={{ color: colors[i % colors.length], flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 12, color: S.muted, lineHeight: 1.5 }}>{ins}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sources & Evidence */}
          {result.sources?.length > 0 && (
            <SourcesEvidence S={S} sources={result.sources} />
          )}

          {/* Footer meta */}
          <p style={{ margin: 0, fontSize: 10, color: S.muted, textAlign: 'center', fontFamily: S.mono, opacity: 0.6 }}>
            ⓘ Responses are generated by AI and may contain inaccuracies. Please verify critical information.
            {respTime && ` · Response time: ${(respTime / 1000).toFixed(2)}s`}
          </p>
        </div>
      )}

      {/* ── Fallback: plain text result (when structured=false or LLM fallback) ── */}
      {result && !result.structured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: S.border, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ background: S.surface, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>LLM RESPONSE</p>
              <span style={{ fontFamily: S.mono, fontSize: 9, color: S.cyan, letterSpacing: '0.05em' }}>{result.model}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: S.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result.answer}</p>
          </div>
          <div style={{ background: S.surface, padding: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>SOURCE CITATIONS ({result.sources?.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.sources?.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2 }}>
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.cyan, width: 18, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 12, color: S.text, flex: 1 }}>{s.source}</span>
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.muted }}>CHUNK #{s.chunk_index}</span>
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.muted }}>d={s.distance?.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
