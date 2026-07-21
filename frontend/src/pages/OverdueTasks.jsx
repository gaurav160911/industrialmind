import { useState, useEffect, useMemo } from 'react'
import { Loader2, AlertCircle, RefreshCw, CheckCircle, ArrowUpDown, Filter } from 'lucide-react'
import { checkOverdue } from '../api'
import { useTheme } from '../ThemeContext'
import { useToast } from '../components/ToastContext'
import { PageWrap, Panel, SectionLabel } from '../components/ui'

function getErrorMessage(err) {
  if (!err.response) return 'Cannot reach backend. Check the FastAPI server is running on port 8080.'
  if (err.response?.status >= 500) return 'Backend error. Check that the FastAPI server is running.'
  return err.response?.data?.detail || 'Request failed.'
}

export default function OverdueTasks() {
  const { theme: S } = useTheme()
  const { showToast } = useToast()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('days_desc')

  const SEVERITY = {
    critical: { color: S.red, bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)' },
    high: { color: S.amber, bg: 'rgba(245,166,35,0.1)', border: 'rgba(245,166,35,0.4)' },
    medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.4)' },
    low: { color: S.muted, bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.4)' },
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await checkOverdue()
      setResult(data)
      showToast('Compliance list synced.', 'success')
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const facilities = useMemo(() => {
    const values = [...new Set((result?.items || []).map(item => item.facility).filter(Boolean))]
    return ['all', ...values]
  }, [result])

  const filteredItems = useMemo(() => {
    const items = [...(result?.items || [])]
      .filter(item => severityFilter === 'all' ? true : item.severity?.toLowerCase() === severityFilter)
      .filter(item => facilityFilter === 'all' ? true : item.facility === facilityFilter)

    items.sort((a, b) => {
      if (sortBy === 'days_desc') return (b.days_overdue || 0) - (a.days_overdue || 0)
      if (sortBy === 'days_asc') return (a.days_overdue || 0) - (b.days_overdue || 0)
      if (sortBy === 'severity') return (a.severity || '').localeCompare(b.severity || '')
      return (a.title || '').localeCompare(b.title || '')
    })
    return items
  }, [facilityFilter, result, severityFilter, sortBy])

  return (
    <PageWrap maxWidth={1060}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: COMPLIANCE</p>
          <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(23px, 3vw, 28px)', fontWeight: 620, color: S.text }}>Overdue Tasks</h1>
          <p style={{ margin: 0, fontSize: 15, color: S.muted }}>Live view of all outstanding maintenance and inspections</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', background: S.surface, color: S.text, border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 11, fontFamily: S.mono, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
          <RefreshCw size={12} style={{ color: S.cyan, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          SYNC
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 16 }}>
          <AlertCircle size={14} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: S.amber, animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 12, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>FETCHING COMPLIANCE RECORDS…</p>
        </div>
      )}

      {result && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <Panel style={{ padding: 14, borderColor: 'rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.08)' }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontFamily: S.mono, color: S.amber }}>OVERDUE COUNT</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: S.amber, fontFamily: S.mono }}>{result.overdue_count}</p>
            </Panel>
            <Panel style={{ padding: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontFamily: S.mono, color: S.muted }}>AS OF</p>
              <p style={{ margin: 0, fontSize: 14, color: S.text, fontFamily: S.mono }}>{result.as_of}</p>
            </Panel>
          </div>

          <Panel style={{ marginBottom: 14, padding: 14 }}>
            <SectionLabel><Filter size={12} style={{ display: 'inline', marginRight: 6 }} />FILTERS & SORT</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 11, fontFamily: S.mono, color: S.muted }}>Severity</span>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.text }}>
                  {['all', 'critical', 'high', 'medium', 'low'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 11, fontFamily: S.mono, color: S.muted }}>Facility</span>
                <select value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.text }}>
                  {facilities.map(v => <option key={v} value={v}>{v === 'all' ? 'ALL FACILITIES' : v}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 11, fontFamily: S.mono, color: S.muted }}><ArrowUpDown size={12} style={{ display: 'inline', marginRight: 5 }} />Sort by</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.text }}>
                  <option value='days_desc'>Most overdue first</option>
                  <option value='days_asc'>Least overdue first</option>
                  <option value='severity'>Severity</option>
                  <option value='title'>Title</option>
                </select>
              </label>
            </div>
          </Panel>

          {filteredItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', textAlign: 'center' }}>
              <CheckCircle size={36} style={{ color: S.green, marginBottom: 12 }} />
              <p style={{ margin: '0 0 4px', fontSize: 15, color: S.text }}>No tasks match your current filters</p>
              <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>0 FILTERED RESULTS</p>
            </div>
          ) : (
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ maxHeight: '62vh', overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2.7fr 1fr', padding: '11px 16px', background: S.surface, position: 'sticky', top: 0, zIndex: 5, borderBottom: `1px solid ${S.border}` }}>
                  <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>TASK / SEVERITY</p>
                  <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>DETAILS</p>
                  <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em', textAlign: 'right' }}>OVERDUE</p>
                </div>
                {filteredItems.map((item, i) => {
                  const sev = SEVERITY[item.severity?.toLowerCase()] || SEVERITY.low
                  return (
                    <div key={`${item.task_id}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 2.7fr 1fr', gap: 16, padding: '15px 16px', background: i % 2 ? S.bg : `${S.surface}70`, borderTop: `1px solid ${S.border}` }}>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontFamily: S.mono, color: S.cyan }}>{item.task_id}</p>
                        <span style={{ display: 'inline-block', padding: '3px 7px', background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 999, fontSize: 10, fontFamily: S.mono, color: sev.color, letterSpacing: '0.05em' }}>
                          {item.severity?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 520, color: S.text }}>{item.title}</p>
                        <p style={{ margin: 0, fontSize: 12, color: S.muted }}>{item.asset_name} · {item.facility}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, fontFamily: S.mono, color: S.red }}>{item.days_overdue}d</p>
                        <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted }}>DUE: {item.due_date}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </PageWrap>
  )
}
