import { useState } from 'react'
import { Send, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { queryRAG } from '../api'
import { useTheme } from '../ThemeContext'

function getErrorMessage(err) {
  if (!err.response) return "Cannot reach backend. Check the FastAPI server is running on port 8080."
  if (err.response?.status === 404) return err.response?.data?.detail || "No relevant documents found. Ingest documents first."
  if (err.response?.status >= 500) return "Backend error. Check that the FastAPI server is running."
  return err.response?.data?.detail || "Request failed."
}

export default function RAGQuery() {
  const { theme: S } = useTheme()
  const [question, setQuestion] = useState('')
  const [topK, setTopK] = useState(5)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true); setError(null); setResult(null)
    try { const { data } = await queryRAG(question, topK); setResult(data) }
    catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      <p style={{ margin: '0 0 6px', fontSize: 10, fontFamily: S.mono, color: S.cyan, letterSpacing: '0.15em' }}>MODULE: RAG-QUERY</p>
      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: S.text }}>RAG Query</h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: S.muted }}>Natural-language search over ingested industrial documents</p>
      <div style={{ height: 1, background: S.border, marginBottom: 24 }} />

      {/* Input panel */}
      <form onSubmit={handleSubmit} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 2, padding: 20, marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>QUERY INPUT</p>
        <textarea
          value={question}
          onChange={e => { setQuestion(e.target.value); setError(null) }}
          rows={3}
          placeholder="e.g. What is the maintenance history of P-101A and what patterns do you see?"
          style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2, padding: '10px 12px', fontSize: 13, color: S.text, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
          onFocus={e => e.target.style.borderColor = S.cyan}
          onBlur={e => e.target.style.borderColor = S.border}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: S.muted, fontFamily: S.mono }}>TOP-K</span>
            <select value={topK} onChange={e => setTopK(Number(e.target.value))}
              style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2, padding: '4px 8px', fontSize: 11, color: S.text, fontFamily: S.mono, outline: 'none' }}>
              {[3,5,8,10].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading || !question.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: loading || !question.trim() ? S.border : S.cyan, color: loading || !question.trim() ? S.muted : '#0a0e14', border: 'none', borderRadius: 2, fontSize: 11, fontWeight: 600, fontFamily: S.mono, letterSpacing: '0.08em', cursor: loading || !question.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.1s' }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
            {loading ? 'PROCESSING…' : 'SUBMIT QUERY'}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 2, marginBottom: 16 }}>
          <AlertCircle size={14} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
          <MessageSquare size={36} style={{ color: S.border, marginBottom: 12 }} />
          <p style={{ margin: '0 0 4px', fontSize: 13, color: S.muted }}>Ask a question to see results here</p>
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, opacity: 0.5 }}>AWAITING INPUT</p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: S.cyan, animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>QUERYING VECTOR STORE…</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: S.border, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {/* Answer */}
          <div style={{ background: S.surface, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>LLM RESPONSE</p>
              <span style={{ fontFamily: S.mono, fontSize: 9, color: S.cyan, letterSpacing: '0.05em' }}>{result.model}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: S.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result.answer}</p>
          </div>
          {/* Sources */}
          <div style={{ background: S.surface, padding: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 9, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>SOURCE CITATIONS ({result.sources.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.sources.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 2 }}>
                  <span style={{ fontFamily: S.mono, fontSize: 10, color: S.cyan, width: 18, flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</span>
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
