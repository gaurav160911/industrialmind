import { useEffect, useMemo, useState } from 'react'
import { Send, Loader2, AlertCircle, MessageSquare, Clipboard, Share2, History, FileSearch } from 'lucide-react'
import { queryRAG } from '../api'
import { useTheme } from '../ThemeContext'
import { useToast } from '../components/ToastContext'
import { PageWrap, Panel, SectionLabel } from '../components/ui'

function getErrorMessage(err) {
  if (!err.response) return 'Cannot reach backend. Check the FastAPI server is running on port 8080.'
  if (err.response?.status === 404) return err.response?.data?.detail || 'No relevant documents found. Ingest documents first.'
  if (err.response?.status >= 500) return 'Backend error. Check that the FastAPI server is running.'
  return err.response?.data?.detail || 'Request failed.'
}

const STEPS = ['Embedding query', 'Searching vector store', 'Synthesizing response']
const HISTORY_KEY = 'im-rag-history'

export default function RAGQuery() {
  const { theme: S } = useTheme()
  const { showToast } = useToast()
  const [question, setQuestion] = useState('')
  const [topK, setTopK] = useState(5)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeStep, setActiveStep] = useState(0)
  const [selectedCitation, setSelectedCitation] = useState(0)
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'))

  useEffect(() => {
    if (!loading) return
    setActiveStep(0)
    const t = window.setInterval(() => setActiveStep(s => Math.min(STEPS.length - 1, s + 1)), 850)
    return () => window.clearInterval(t)
  }, [loading])

  const selected = result?.sources?.[selectedCitation] || null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await queryRAG(q, topK)
      setResult(data)
      setSelectedCitation(0)
      const nextHistory = [q, ...history.filter(item => item !== q)].slice(0, 8)
      setHistory(nextHistory)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
      showToast('Query completed successfully.', 'success')
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const copyAnswer = async () => {
    if (!result?.answer) return
    await navigator.clipboard.writeText(result.answer)
    showToast('Answer copied to clipboard.', 'success')
  }

  const shareQuery = async () => {
    const url = `${window.location.origin}/query?q=${encodeURIComponent(question.trim())}`
    await navigator.clipboard.writeText(url)
    showToast('Share link copied.', 'info')
  }

  const progress = useMemo(() => STEPS.map((label, i) => ({
    label,
    state: i < activeStep ? 'done' : i === activeStep ? 'active' : 'todo',
  })), [activeStep])

  return (
    <PageWrap maxWidth={980}>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: RAG-QUERY</p>
      <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(23px, 3vw, 28px)', fontWeight: 620, color: S.text }}>RAG Query</h1>
      <p style={{ margin: '0 0 22px', fontSize: 15, color: S.muted }}>Natural-language search over ingested industrial documents</p>

      <Panel style={{ marginBottom: 14 }}>
        <SectionLabel>QUERY INPUT</SectionLabel>
        <form onSubmit={handleSubmit}>
          <textarea
            value={question}
            onChange={e => { setQuestion(e.target.value); setError(null) }}
            rows={4}
            placeholder='e.g. What is the maintenance history of P-101A and what patterns do you see?'
            style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px 14px', fontSize: 15, color: S.text, resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: S.muted, fontFamily: S.mono }}>TOP-K</span>
              <select value={topK} onChange={e => setTopK(Number(e.target.value))} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: S.text, fontFamily: S.mono }}>
                {[3, 5, 8, 10].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <button type='submit' disabled={loading || !question.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: loading || !question.trim() ? S.border : S.cyan, color: loading || !question.trim() ? S.muted : '#0a0e14', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: S.mono, letterSpacing: '0.06em', cursor: loading || !question.trim() ? 'not-allowed' : 'pointer' }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              {loading ? 'PROCESSING…' : 'SUBMIT QUERY'}
            </button>
          </div>
        </form>
      </Panel>

      {history.length > 0 && (
        <Panel style={{ marginBottom: 14, padding: 14 }}>
          <SectionLabel><History size={12} style={{ display: 'inline', marginRight: 6 }} />RECENT QUERIES</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {history.map((item, i) => (
              <button key={`${item}-${i}`} onClick={() => setQuestion(item)} style={{ fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 999, padding: '5px 10px', color: S.muted }}>
                {item.length > 80 ? `${item.slice(0, 80)}…` : item}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {loading && (
        <Panel style={{ marginBottom: 14 }}>
          <SectionLabel>PROGRESS</SectionLabel>
          <div style={{ display: 'grid', gap: 7 }}>
            {progress.map(step => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: step.state === 'todo' ? S.muted : S.text }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: step.state === 'done' ? S.green : step.state === 'active' ? S.cyan : S.border }} />
                {step.label}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 14 }}>
          <AlertCircle size={15} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
          <MessageSquare size={36} style={{ color: S.border, marginBottom: 12 }} />
          <p style={{ margin: '0 0 4px', fontSize: 15, color: S.muted }}>Ask a question to see results here</p>
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, opacity: 0.6 }}>AWAITING INPUT</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 14 }}>
          <Panel style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>LLM RESPONSE</p>
              <span style={{ fontFamily: S.mono, fontSize: 10, color: S.cyan }}>{result.model}</span>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: S.text, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{result.answer}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={copyAnswer} style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: S.muted }}>
                <Clipboard size={13} /> Copy answer
              </button>
              <button onClick={shareQuery} style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: S.muted }}>
                <Share2 size={13} /> Share query
              </button>
            </div>
          </Panel>

          <Panel style={{ minWidth: 0 }}>
            <SectionLabel>SOURCE CITATIONS ({result.sources.length})</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {result.sources.map((s, i) => (
                <button
                  key={`${s.source}-${i}`}
                  onClick={() => setSelectedCitation(i)}
                  style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8, padding: '8px 10px', background: selectedCitation === i ? `${S.cyan}12` : S.bg, border: `1px solid ${selectedCitation === i ? S.cyan : S.border}`, borderRadius: 8 }}
                >
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.cyan }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 12, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.source}</span>
                </button>
              ))}
            </div>
            {selected && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: 10 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontFamily: S.mono, color: S.muted }}>CITATION PREVIEW</p>
                <div style={{ display: 'grid', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 12, color: S.text }}><FileSearch size={12} style={{ display: 'inline', marginRight: 5 }} />{selected.source}</p>
                  <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>CHUNK #{selected.chunk_index}</p>
                  <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>distance={selected.distance?.toFixed?.(3) ?? 'N/A'}</p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </PageWrap>
  )
}
