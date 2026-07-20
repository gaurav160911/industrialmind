import { useState } from 'react'
import { FileText, Loader2, AlertCircle, Download, FilePlus } from 'lucide-react'
import { generateCAR } from '../api'
import { useTheme } from '../ThemeContext'

function getErrorMessage(err, tag) {
  if (!err.response) return "Cannot reach backend. Check the FastAPI server is running on port 8080."
  const status = err.response?.status
  const detail = err.response?.data?.detail || ''
  if (status === 404 && detail.toLowerCase().includes('no overdue')) return `No overdue compliance tasks found for '${tag}'. This equipment may be fully compliant.`
  if (status === 404) return `Equipment tag '${tag}' not found in the knowledge graph. Try one of the tags below.`
  if (status >= 500) return "Backend error. Check that the FastAPI server is running."
  return detail || "Request failed."
}

const OVERDUE_TAGS = ['E-201', 'V-301', 'T-601', 'PSV-701', 'FI-801']

export default function ComplianceCAR() {
  const { theme: S } = useTheme()
  const [tag, setTag] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async (equipTag) => {
    const t = equipTag || tag
    if (!t.trim()) return
    setLoading(true); setError(null); setResult(null)
    try { const { data } = await generateCAR(t.trim()); setResult(data) }
    catch (err) { setError(getErrorMessage(err, t.trim())) }
    finally { setLoading(false) }
  }

  const downloadCAR = () => {
    if (!result) return
    const blob = new Blob([result.car_document], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `CAR-${result.equipment_tag}-${new Date().toISOString().slice(0, 10)}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      <p style={{ margin: '0 0 6px', fontSize: 10, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: COMPLIANCE-CAR</p>
      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: S.text }}>Generate CAR</h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: S.muted }}>Formal Corrective Action Report — only available for equipment with overdue tasks</p>
      <div style={{ height: 1, background: S.border, marginBottom: 24 }} />

      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 2, padding: 20, marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>EQUIPMENT SELECTOR</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={tag} onChange={e => { setTag(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Enter equipment tag, e.g. E-201"
            style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2, padding: '9px 12px', fontSize: 13, color: S.text, fontFamily: S.mono, outline: 'none', letterSpacing: '0.05em', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = S.green}
            onBlur={e => e.target.style.borderColor = S.border}
          />
          <button onClick={() => run()} disabled={loading || !tag.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: loading || !tag.trim() ? S.border : S.green, color: loading || !tag.trim() ? S.muted : '#0a0e14', border: 'none', borderRadius: 2, fontSize: 11, fontWeight: 600, fontFamily: S.mono, letterSpacing: '0.08em', cursor: loading || !tag.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FilePlus size={13} />}
            {loading ? 'GENERATING…' : 'GENERATE CAR'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OVERDUE_TAGS.map(s => (
            <button key={s} onClick={() => { setTag(s); run(s) }} disabled={loading}
              style={{ fontFamily: S.mono, fontSize: 10, padding: '3px 8px', border: `1px solid ${S.border}`, borderRadius: 2, background: 'transparent', color: S.muted, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em', opacity: loading ? 0.4 : 1, transition: 'all 0.1s' }}
              onMouseEnter={e => !loading && (e.target.style.borderColor = S.green, e.target.style.color = S.green)}
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
          <FileText size={36} style={{ color: S.border, marginBottom: 12 }} />
          <p style={{ margin: '0 0 4px', fontSize: 13, color: S.muted }}>Select equipment to generate a Corrective Action Report</p>
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, opacity: 0.5 }}>AWAITING SELECTION</p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: S.green, animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>GENERATING REPORT TEXT…</p>
        </div>
      )}

      {result && !loading && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 2, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>REPORT PREVIEW</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: S.mono, color: S.green }}>{result.equipment_tag}</p>
            </div>
            <button onClick={downloadCAR}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: S.bg, color: S.text, border: `1px solid ${S.border}`, borderRadius: 2, fontSize: 10, fontFamily: S.mono, cursor: 'pointer', letterSpacing: '0.05em' }}>
              <Download size={12} style={{ color: S.green }} />
              DOWNLOAD .TXT
            </button>
          </div>
          <div style={{ height: 1, background: S.border, marginBottom: 16 }} />
          <pre style={{ margin: 0, padding: 16, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2, fontSize: 12, fontFamily: S.mono, color: S.text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {result.car_document}
          </pre>
        </div>
      )}
    </div>
  )
}
