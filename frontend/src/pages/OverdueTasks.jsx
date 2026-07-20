import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react'
import { checkOverdue } from '../api'
import { useTheme } from '../ThemeContext'

function getErrorMessage(err) {
  if (!err.response) return "Cannot reach backend. Check the FastAPI server is running on port 8080."
  if (err.response?.status >= 500) return "Backend error. Check that the FastAPI server is running."
  return err.response?.data?.detail || "Request failed."
}

export default function OverdueTasks() {
  const { theme: S } = useTheme()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const SEVERITY = {
    critical: { color: S.red,   bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)' },
    high:     { color: S.amber, bg: 'rgba(245,166,35,0.1)',  border: 'rgba(245,166,35,0.4)' },
    medium:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.4)' },
    low:      { color: S.muted, bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.4)' },
  }

  const load = async () => {
    setLoading(true); setError(null)
    try { const { data } = await checkOverdue(); setResult(data) }
    catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: COMPLIANCE</p>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: S.text }}>Overdue Tasks</h1>
          <p style={{ margin: 0, fontSize: 13, color: S.muted }}>Live view of all outstanding maintenance and inspections</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: S.surface, color: S.text, border: `1px solid ${S.border}`, borderRadius: 2, fontSize: 10, fontFamily: S.mono, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
          <RefreshCw size={12} style={{ color: S.cyan, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          SYNC
        </button>
      </div>
      <div style={{ height: 1, background: S.border, marginBottom: 24 }} />

      {error && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 2, marginBottom: 16 }}>
          <AlertCircle size={14} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: S.amber, animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>FETCHING COMPLIANCE RECORDS…</p>
        </div>
      )}

      {result && !loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 16px', background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: S.mono, color: S.amber }}>{result.overdue_count}</span>
              <span style={{ fontSize: 10, fontFamily: S.mono, color: S.amber, letterSpacing: '0.05em' }}>ITEMS</span>
            </div>
            <span style={{ fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.05em' }}>AS OF: {result.as_of}</span>
          </div>

          {result.items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', textAlign: 'center' }}>
              <CheckCircle size={36} style={{ color: S.green, marginBottom: 12 }} />
              <p style={{ margin: '0 0 4px', fontSize: 13, color: S.text }}>All equipment is currently compliant</p>
              <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>0 OUTSTANDING TASKS</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: S.border, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1fr', padding: '10px 16px', background: S.surface }}>
                <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>TASK ID / SEVERITY</p>
                <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>DETAILS</p>
                <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em', textAlign: 'right' }}>OVERDUE</p>
              </div>
              {/* Rows */}
              {result.items.map((item, i) => {
                const sev = SEVERITY[item.severity?.toLowerCase()] || SEVERITY.low
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1fr', gap: 16, padding: '16px', background: S.bg, borderTop: `1px solid ${S.border}` }}>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontFamily: S.mono, color: S.cyan }}>{item.task_id}</p>
                      <span style={{ display: 'inline-block', padding: '2px 6px', background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 2, fontSize: 9, fontFamily: S.mono, color: sev.color, letterSpacing: '0.05em' }}>
                        {item.severity?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: S.text }}>{item.title}</p>
                      <p style={{ margin: 0, fontSize: 11, fontFamily: S.mono, color: S.muted }}>{item.asset_name} · {item.facility}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, fontFamily: S.mono, color: S.red }}>{item.days_overdue}d</p>
                      <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted }}>DUE: {item.due_date}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
