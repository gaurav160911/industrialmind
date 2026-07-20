import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, X, CheckCircle, XCircle, Loader2, CloudUpload } from 'lucide-react'
import { useTheme } from '../ThemeContext'



const FACILITY = 'Bharat Petrochemicals Ltd'
const ACCEPT   = ['.pdf', '.csv', '.json', '.txt']

// ── Document-type auto-detection ─────────────────────────────────────────────
function detectDocType(filename) {
  const n = filename.toLowerCase()
  if (/oisd|regulation/.test(n))        return 'regulation'
  if (/sop|procedure/.test(n))          return 'SOP'
  if (/incident/.test(n))               return 'incident'
  if (/maintenance|work_order/.test(n)) return 'maintenance'
  return 'regulation'
}

// ── Format bytes ──────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

// ── Shared helpers ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => {
  const { theme: S } = useTheme()
  return (
    <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>
      {children}
    </p>
  )
}

const DocTypeBadge = ({ type }) => {
  const { theme: S } = useTheme()
  const color = { regulation: '#a78bfa', SOP: S.cyan, incident: '#fb923c', maintenance: '#34d399' }[type] || S.muted
  return (
    <span style={{
      fontFamily: S.mono, fontSize: 9, padding: '2px 6px',
      border: `1px solid ${color}30`, borderRadius: 2,
      color, background: `${color}10`, letterSpacing: '0.05em',
    }}>
      {type}
    </span>
  )
}

function StatusPill({ status }) {
  const { theme: S } = useTheme()
  if (!status) return null
  if (status.state === 'uploading') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: S.muted, fontFamily: S.mono }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
        UPLOADING…
      </span>
    )
  }
  if (status.state === 'ok') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#34d399', fontFamily: S.mono }}>
        <CheckCircle size={12} />
        ✓ {status.chunks} chunks ingested
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#f87171', fontFamily: S.mono }}>
      <XCircle size={12} />
      ✗ {status.error}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Ingest() {
  const { theme: S } = useTheme()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [queue,    setQueue]    = useState([])   // { id, file, docType, status }
  const [running,  setRunning]  = useState(false)

  // ── Drag / drop handlers ──────────────────────────────────────────────────
  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true)  }, [])
  const onDragLeave = useCallback(e => { e.preventDefault(); setDragging(false) }, [])

  const addFiles = useCallback(files => {
    const accepted = Array.from(files).filter(f =>
      ACCEPT.some(ext => f.name.toLowerCase().endsWith(ext))
    )
    setQueue(prev => [
      ...prev,
      ...accepted.map(f => ({
        id: `${f.name}-${f.lastModified}-${Math.random()}`,
        file: f,
        docType: detectDocType(f.name),
        status: null,
      })),
    ])
  }, [])

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onChange = useCallback(e => {
    addFiles(e.target.files)
    e.target.value = ''
  }, [addFiles])

  const removeFile    = useCallback(id => setQueue(prev => prev.filter(f => f.id !== id)), [])
  const changeDocType = useCallback((id, val) =>
    setQueue(prev => prev.map(f => f.id === id ? { ...f, docType: val } : f)), [])

  // ── Upload handler ────────────────────────────────────────────────────────
  const uploadAll = useCallback(async () => {
    const pending = queue.filter(f => f.status?.state !== 'ok')
    if (!pending.length) return
    setRunning(true)

    for (const item of pending) {
      setQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: { state: 'uploading' } } : f
      ))

      try {
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('document_type', item.docType)
        fd.append('facility', FACILITY)

        const apiBase = import.meta.env.VITE_API_URL || '/api'
        const res = await fetch(`${apiBase}/ingest/upload`, { method: 'POST', body: fd })

        if (!res.ok) {
          const txt = await res.text().catch(() => `HTTP ${res.status}`)
          throw new Error(txt || `HTTP ${res.status}`)
        }

        const data   = await res.json().catch(() => ({}))
        const chunks = data.chunks_ingested ?? data.chunks ?? data.count ?? '?'

        setQueue(prev => prev.map(f =>
          f.id === item.id ? { ...f, status: { state: 'ok', chunks } } : f
        ))
      } catch (err) {
        setQueue(prev => prev.map(f =>
          f.id === item.id ? { ...f, status: { state: 'error', error: err?.message || 'Upload failed' } } : f
        ))
      }
    }

    setRunning(false)
  }, [queue])

  const clearDone = useCallback(() => setQueue(prev => prev.filter(f => f.status?.state !== 'ok')), [])

  const pendingCount = queue.filter(f => !f.status || f.status.state === 'error').length
  const doneCount    = queue.filter(f => f.status?.state === 'ok').length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left panel ────────────────────────────────────────────────── */}
      <div style={{ width: 300, flexShrink: 0, background: S.surface, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: 20, borderBottom: `1px solid ${S.border}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>
            SYS: INGEST_PIPELINE
          </p>
          <h1 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: S.text }}>
            Document Ingest
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: S.muted, lineHeight: 1.6 }}>
            Upload documents to ingest into the vector knowledge base.
          </p>
        </div>

        <div style={{ padding: 20, borderBottom: `1px solid ${S.border}` }}>
          <SectionLabel>TARGET FACILITY</SectionLabel>
          <div style={{ padding: '8px 10px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2 }}>
            <p style={{ margin: 0, fontSize: 11, fontFamily: S.mono, color: S.cyan }}>{FACILITY}</p>
          </div>
        </div>

        <div style={{ padding: 20, borderBottom: `1px solid ${S.border}` }}>
          <SectionLabel>ACCEPTED FORMATS</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ACCEPT.map(ext => (
              <span key={ext} style={{
                fontFamily: S.mono, fontSize: 9, padding: '2px 6px',
                border: `1px solid ${S.border}`, borderRadius: 2, color: S.muted, letterSpacing: '0.05em',
              }}>
                {ext.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          <SectionLabel>DOC TYPE AUTO-DETECT</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { type: 'regulation',  hint: 'oisd / regulation' },
              { type: 'SOP',         hint: 'sop / procedure'   },
              { type: 'incident',    hint: 'incident'          },
              { type: 'maintenance', hint: 'maintenance / work_order' },
            ].map(({ type, hint }) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <DocTypeBadge type={type} />
                <span style={{ fontSize: 10, fontFamily: S.mono, color: S.muted }}>{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: S.bg }}>

        {/* Toolbar */}
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontFamily: S.mono, color: S.muted, flex: 1 }}>
            {queue.length === 0
              ? 'No files queued'
              : `${queue.length} file${queue.length !== 1 ? 's' : ''} · ${doneCount} done · ${pendingCount} pending`}
          </p>
          {doneCount > 0 && (
            <button
              onClick={clearDone}
              disabled={running}
              style={{
                fontFamily: S.mono, fontSize: 10, padding: '6px 12px',
                border: `1px solid ${S.border}`, borderRadius: 2,
                background: 'transparent', color: S.muted,
                cursor: running ? 'not-allowed' : 'pointer', letterSpacing: '0.05em',
              }}
              onMouseEnter={e => { if (!running) { e.target.style.borderColor = S.cyan; e.target.style.color = S.cyan } }}
              onMouseLeave={e => { e.target.style.borderColor = S.border; e.target.style.color = S.muted }}
            >
              CLEAR DONE
            </button>
          )}
          <button
            onClick={uploadAll}
            disabled={running || pendingCount === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: S.mono, fontSize: 10, padding: '7px 16px',
              border: 'none', borderRadius: 2, letterSpacing: '0.07em', fontWeight: 600,
              background: (running || pendingCount === 0) ? '#1f2530' : S.cyan,
              color: (running || pendingCount === 0) ? S.muted : '#0a0e14',
              cursor: (running || pendingCount === 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {running
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> UPLOADING</>
              : <><Upload size={12} /> INGEST ALL</>}
          </button>
        </div>

        {/* Scrollable area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? S.cyan : S.border}`,
              borderRadius: 4, padding: '44px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
              background: dragging ? 'rgba(34,211,238,0.03)' : 'transparent',
            }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.borderColor = '#374151' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.borderColor = S.border   }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT.join(',')}
              onChange={onChange}
              style={{ display: 'none' }}
            />
            <CloudUpload
              size={38}
              style={{ color: dragging ? S.cyan : S.border, transition: 'color 0.15s' }}
            />
            <p style={{ margin: 0, fontSize: 13, color: dragging ? S.cyan : S.muted, fontWeight: 500, transition: 'color 0.15s' }}>
              {dragging ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
            </p>
            <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: '#374151', letterSpacing: '0.05em' }}>
              PDF · CSV · JSON · TXT
            </p>
          </div>

          {/* File queue */}
          {queue.length > 0 && (
            <div>
              <SectionLabel>FILE QUEUE</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {queue.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', background: S.surface,
                      border: `1px solid ${
                        item.status?.state === 'ok'    ? 'rgba(52,211,153,0.25)' :
                        item.status?.state === 'error' ? 'rgba(248,113,113,0.25)' :
                        S.border
                      }`,
                      borderRadius: 2, transition: 'border-color 0.2s',
                    }}
                  >
                    <FileText size={14} style={{ color: S.muted, flexShrink: 0 }} />

                    {/* Name + size */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: '0 0 2px', fontSize: 12, color: S.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.file.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted }}>
                        {fmtSize(item.file.size)}
                      </p>
                    </div>

                    {/* Doc-type selector */}
                    <select
                      value={item.docType}
                      onChange={e => changeDocType(item.id, e.target.value)}
                      disabled={item.status?.state === 'uploading'}
                      style={{
                        fontFamily: S.mono, fontSize: 10, padding: '4px 8px',
                        background: S.bg, border: `1px solid ${S.border}`,
                        borderRadius: 2, color: S.text, cursor: 'pointer', outline: 'none',
                      }}
                    >
                      <option value="regulation">regulation</option>
                      <option value="SOP">SOP</option>
                      <option value="incident">incident</option>
                      <option value="maintenance">maintenance</option>
                    </select>

                    {/* Status */}
                    <div style={{ minWidth: 170, display: 'flex', justifyContent: 'flex-end' }}>
                      <StatusPill status={item.status} />
                    </div>

                    {/* Remove */}
                    {item.status?.state !== 'uploading' && (
                      <button
                        onClick={() => removeFile(item.id)}
                        style={{
                          background: 'none', border: 'none', padding: 4,
                          cursor: 'pointer', color: S.muted, display: 'flex',
                          alignItems: 'center', flexShrink: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = S.muted}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {queue.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 16,
            }}>
              <Upload size={26} style={{ color: S.border }} />
              <p style={{ margin: 0, fontSize: 11, color: '#374151', fontFamily: S.mono, letterSpacing: '0.1em' }}>
                AWAITING FILES
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
