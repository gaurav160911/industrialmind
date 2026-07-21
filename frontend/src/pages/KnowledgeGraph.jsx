import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { GitFork, Search, Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize2, RotateCcw, Target } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getGraph } from '../api'
import { useTheme } from '../ThemeContext'
import { useToast } from '../components/ToastContext'

const ErrorBanner = ({ msg }) => (
  <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
    <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
    <p style={{ margin: 0, fontSize: 13, color: '#fca5a5' }}>{msg}</p>
  </div>
)

function getErrorMessage(err, tag) {
  if (!err.response) return 'Cannot reach backend. Check the FastAPI server is running.'
  if (err.response?.status === 404) return `Equipment tag '${tag}' not found in the knowledge graph. Try one of the tags below.`
  if (err.response?.status >= 500) return 'Backend error. Check that the FastAPI server is running.'
  return err.response?.data?.detail || 'Request failed.'
}

const NODE_CONFIG = {
  equipment: { color: '#38bdf8', ring: '#0ea5e9', fill: 'rgba(56,189,248,0.15)', radius: 36, label: 'Equipment' },
  failure: { color: '#f87171', ring: '#ef4444', fill: 'rgba(248,113,113,0.15)', radius: 30, label: 'Failure' },
  regulation: { color: '#c084fc', ring: '#a855f7', fill: 'rgba(192,132,252,0.15)', radius: 28, label: 'Regulation' },
  incident: { color: '#fb923c', ring: '#f97316', fill: 'rgba(251,146,60,0.15)', radius: 30, label: 'Incident' },
  compliance: { color: '#34d399', ring: '#10b981', fill: 'rgba(52,211,153,0.15)', radius: 28, label: 'Compliance' },
}

const LINK_COLOR = {
  HAD_FAILURE: '#ef4444',
  GOVERNED_BY: '#c084fc',
  INVOLVES: '#fb923c',
  HAS_COMPLIANCE: '#34d399',
}

const LINK_LABEL = {
  HAD_FAILURE: 'Had Failure',
  GOVERNED_BY: 'Governed By',
  INVOLVES: 'Involves',
  HAS_COMPLIANCE: 'Has Compliance',
}

const SUGGESTIONS = ['P-101A', 'P-101B', 'E-201', 'V-301', 'T-601', 'PSV-701', 'FI-801']

export default function KnowledgeGraph() {
  const { theme: S } = useTheme()
  const { showToast } = useToast()
  const [params] = useSearchParams()
  const svgRef = useRef(null)
  const zoomRef = useRef(null)
  const [tag, setTag] = useState(params.get('tag') || '')
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [selected, setSelected] = useState(null)
  const [relationFilter, setRelationFilter] = useState(() => Object.fromEntries(Object.keys(LINK_LABEL).map(k => [k, true])))

  const enabledRelations = useMemo(() => Object.keys(relationFilter).filter(k => relationFilter[k]), [relationFilter])

  const load = async (equipTag) => {
    const t = equipTag || tag
    if (!t.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getGraph(t.trim())
      setGraph(data)
      setSelected(null)
      showToast(`Loaded graph for ${t.trim()}.`, 'success')
    } catch (err) {
      const msg = getErrorMessage(err, t.trim())
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const queryTag = params.get('tag')
    if (queryTag) {
      setTag(queryTag)
      load(queryTag)
    }
  }, [])

  useEffect(() => {
    if (!graph || !svgRef.current) return
    const el = svgRef.current
    const W = el.clientWidth || 900
    const H = el.clientHeight || 560
    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('width', W).attr('height', H)

    const defs = svg.append('defs')
    Object.entries(LINK_COLOR).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 1)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.85)
    })

    const g = svg.append('g')
    const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', e => g.attr('transform', e.transform))
    svg.call(zoom)

    const nodes = graph.nodes.map(n => ({ ...n }))
    const links = graph.links.filter(l => enabledRelations.includes(l.type)).map(l => ({ ...l }))
    const selectedSet = new Set([selected])
    links.forEach(l => {
      if (l.source === selected || l.target === selected) {
        selectedSet.add(l.source)
        selectedSet.add(l.target)
      }
    })

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(180).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(d => (NODE_CONFIG[d.type]?.radius || 30) + 50))

    const linkGroup = g.append('g').attr('class', 'links')
    const link = linkGroup.selectAll('line').data(links).join('line')
      .attr('stroke', d => LINK_COLOR[d.type] || '#475569')
      .attr('stroke-width', d => selected && (d.source === selected || d.target === selected) ? 3.8 : 2)
      .attr('stroke-opacity', d => !selected ? 0.55 : (d.source === selected || d.target === selected ? 0.95 : 0.12))
      .attr('marker-end', d => `url(#arrow-${d.type})`)

    const edgeLabelGroup = g.append('g').attr('class', 'edge-labels')
    const edgeLabelGs = edgeLabelGroup.selectAll('g').data(links).join('g').attr('opacity', d => !selected ? 1 : (d.source === selected || d.target === selected ? 1 : 0.2))
    edgeLabelGs.append('rect')
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', S.bg)
      .attr('stroke', d => LINK_COLOR[d.type] || '#475569')
      .attr('stroke-width', 1)
      .attr('opacity', 0.95)

    edgeLabelGs.append('text')
      .text(d => LINK_LABEL[d.type] || d.type.replace(/_/g, ' '))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'Inter, ui-sans-serif, system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('fill', d => LINK_COLOR[d.type] || '#94a3b8')
      .attr('letter-spacing', '0.03em')

    edgeLabelGs.each(function() {
      const textEl = d3.select(this).select('text').node()
      if (!textEl) return
      const bb = textEl.getBBox()
      const pw = bb.width + 14
      const ph = bb.height + 8
      d3.select(this).select('rect')
        .attr('width', pw)
        .attr('height', ph)
        .attr('x', -pw / 2)
        .attr('y', -ph / 2)
    })

    const nodeGroup = g.append('g').attr('class', 'nodes')
    const node = nodeGroup.selectAll('g').data(nodes).join('g')
      .attr('data-node-id', d => d.id)
      .attr('cursor', 'pointer')
      .attr('opacity', d => !selected ? 1 : (selectedSet.has(d.id) ? 1 : 0.2))
      .call(
        d3.drag()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
          .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }),
      )
      .on('mouseenter', (e, d) => setTooltip({ x: e.clientX, y: e.clientY, node: d }))
      .on('mousemove', (e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t))
      .on('mouseleave', () => setTooltip(null))
      .on('click', (e, d) => { e.stopPropagation(); setSelected(prev => prev === d.id ? null : d.id) })

    svg.on('click', () => setSelected(null))

    node.append('circle')
      .attr('r', d => (NODE_CONFIG[d.type]?.radius || 30) + 8)
      .attr('fill', 'none')
      .attr('stroke', d => NODE_CONFIG[d.type]?.ring || '#64748b')
      .attr('stroke-width', d => selected === d.id ? 2.6 : 1)
      .attr('stroke-opacity', d => selected === d.id ? 0.95 : 0.3)
      .attr('stroke-dasharray', '3 3')

    node.append('circle')
      .attr('r', d => NODE_CONFIG[d.type]?.radius || 30)
      .attr('fill', d => NODE_CONFIG[d.type]?.fill || 'rgba(100,116,139,0.15)')
      .attr('stroke', d => NODE_CONFIG[d.type]?.ring || '#64748b')
      .attr('stroke-width', d => selected === d.id ? 3.4 : 2.5)

    node.append('text')
      .text(d => d.type.slice(0, 3).toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('dy', '-0.6em')
      .attr('font-size', 8)
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-weight', '700')
      .attr('fill', d => NODE_CONFIG[d.type]?.ring || '#94a3b8')
      .attr('letter-spacing', '0.12em')
      .attr('opacity', 0.72)

    node.append('text')
      .text(d => {
        const r = NODE_CONFIG[d.type]?.radius || 30
        const maxChars = Math.floor(r / 4.2)
        return d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + '…' : d.label
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('dy', '0.7em')
      .attr('font-size', 11)
      .attr('font-family', 'Inter, ui-sans-serif, system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('fill', '#e2e8f0')

    sim.on('tick', () => {
      link.each(function(d) {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const sr = (NODE_CONFIG[d.source.type]?.radius || 30)
        const tr = (NODE_CONFIG[d.target.type]?.radius || 30) + 10
        const sx = d.source.x + (dx / dist) * sr
        const sy = d.source.y + (dy / dist) * sr
        const ex = d.target.x - (dx / dist) * tr
        const ey = d.target.y - (dy / dist) * tr
        d3.select(this).attr('x1', sx).attr('y1', sy).attr('x2', ex).attr('y2', ey)
      })

      edgeLabelGs.attr('transform', d => {
        const mx = (d.source.x + d.target.x) / 2
        const my = (d.source.y + d.target.y) / 2
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const px = -dy / dist * 18
        const py = dx / dist * 18
        return `translate(${mx + px},${my + py})`
      })

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    zoomRef.current = { zoom, svg, g, W, H, nodeSelection: node }
    return () => sim.stop()
  }, [graph, S, selected, enabledRelations])

  const zoomBy = useCallback((factor) => {
    if (!zoomRef.current) return
    const { zoom, svg } = zoomRef.current
    svg.transition().duration(300).call(zoom.scaleBy, factor)
  }, [])

  const zoomFit = useCallback(() => {
    if (!zoomRef.current) return
    const { zoom, svg, g, W, H } = zoomRef.current
    const bounds = g.node().getBBox()
    if (!bounds.width || !bounds.height) return
    const scale = Math.min(0.9, 0.9 / Math.max(bounds.width / W, bounds.height / H))
    const tx = W / 2 - scale * (bounds.x + bounds.width / 2)
    const ty = H / 2 - scale * (bounds.y + bounds.height / 2)
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }, [])

  const zoomReset = useCallback(() => {
    if (!zoomRef.current) return
    const { zoom, svg } = zoomRef.current
    svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity)
  }, [])

  const fitSelected = useCallback(() => {
    if (!zoomRef.current || !selected) return
    const { zoom, svg, nodeSelection, W, H } = zoomRef.current
    const target = nodeSelection.filter(d => d.id === selected).node()
    if (!target) return
    const box = target.getBBox()
    const pad = 140
    const scale = Math.min(2.8, Math.max(1.3, Math.min(W / (box.width + pad), H / (box.height + pad))))
    const tx = W / 2 - scale * (box.x + box.width / 2)
    const ty = H / 2 - scale * (box.y + box.height / 2)
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }, [selected])

  const selectedNode = selected && graph?.nodes.find(n => n.id === selected)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 320, flexShrink: 0, background: S.surface, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${S.border}` }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontFamily: S.mono, color: '#e879f9', letterSpacing: '0.15em' }}>SYS: KNOWLEDGE_GRAPH</p>
          <h1 style={{ margin: '0 0 12px', fontSize: 19, fontWeight: 620, color: S.text }}>Graph Explorer</h1>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input value={tag} onChange={e => { setTag(e.target.value); setError(null) }} onKeyDown={e => e.key === 'Enter' && load()} placeholder='Equipment tag…' style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.text, fontFamily: S.mono }} />
            <button onClick={() => load()} disabled={loading || !tag.trim()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: loading || !tag.trim() ? '#1f2530' : '#e879f9', color: loading || !tag.trim() ? S.muted : '#0a0e14', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: S.mono, cursor: loading || !tag.trim() ? 'not-allowed' : 'pointer' }}>
              {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={12} />}
              {loading ? 'LOAD' : 'EXECUTE'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => { setTag(s); load(s) }} disabled={loading} style={{ fontFamily: S.mono, fontSize: 10, padding: '3px 8px', border: `1px solid ${S.border}`, borderRadius: 999, background: 'transparent', color: S.muted, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 20, borderBottom: `1px solid ${S.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>NODE TYPES</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: cfg.fill, border: `2px solid ${cfg.ring}`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: S.text }}>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 20, borderBottom: `1px solid ${S.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>RELATIONSHIPS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(LINK_LABEL).map(([type, label]) => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: S.text }}>
                <input type='checkbox' checked={relationFilter[type]} onChange={e => setRelationFilter(prev => ({ ...prev, [type]: e.target.checked }))} />
                <div style={{ width: 20, height: 2, background: LINK_COLOR[type], flexShrink: 0, borderRadius: 1 }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          {selectedNode ? (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>NODE DETAILS</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_CONFIG[selectedNode.type]?.ring }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{selectedNode.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ padding: '8px 10px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: S.mono, color: S.muted, marginRight: 6 }}>TYPE:</span>
                  <span style={{ fontSize: 11, fontFamily: S.mono, color: S.cyan, textTransform: 'uppercase' }}>{selectedNode.type}</span>
                </div>
                {Object.entries(selectedNode.props || {}).map(([k, v]) => (
                  <div key={k} style={{ padding: '8px 10px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 9, fontFamily: S.mono, color: S.muted, textTransform: 'uppercase' }}>{k}</p>
                    <p style={{ margin: 0, fontSize: 12, color: S.text, wordBreak: 'break-all' }}>{String(v)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : graph ? (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 10, fontFamily: S.mono, color: S.muted, letterSpacing: '0.12em' }}>GRAPH STATS</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 600, fontFamily: S.mono, color: S.text }}>{graph.nodes.length}</p>
                  <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted }}>NODES</p>
                </div>
                <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 600, fontFamily: S.mono, color: S.text }}>{graph.links.length}</p>
                  <p style={{ margin: 0, fontSize: 10, fontFamily: S.mono, color: S.muted }}>LINKS</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', background: S.bg }}>
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { icon: ZoomIn, action: () => zoomBy(1.3), title: 'Zoom In' },
            { icon: ZoomOut, action: () => zoomBy(0.77), title: 'Zoom Out' },
            { icon: Maximize2, action: zoomFit, title: 'Fit graph' },
            { icon: Target, action: fitSelected, title: 'Fit selected node' },
            { icon: RotateCcw, action: zoomReset, title: 'Reset view' },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} title={btn.title} style={{ width: 34, height: 34, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted, cursor: 'pointer' }}>
              <btn.icon size={14} />
            </button>
          ))}
        </div>

        {error && <ErrorBanner msg={error} />}

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Loader2 size={24} style={{ color: '#e879f9', animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono, letterSpacing: '0.1em' }}>FETCHING GRAPH DATA → APPLYING LAYOUT → RENDERING</p>
          </div>
        )}

        {!graph && !loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <GitFork size={36} style={{ color: S.border, marginBottom: 12 }} />
            <p style={{ margin: '0 0 4px', fontSize: 15, color: S.muted }}>Select equipment to visualize its knowledge graph</p>
            <p style={{ margin: 0, fontSize: 11, color: S.muted, fontFamily: S.mono }}>AWAITING SELECTION</p>
          </div>
        )}

        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />

        {tooltip && (
          <div style={{ position: 'fixed', zIndex: 50, pointerEvents: 'none', background: S.surface, border: `1px solid ${NODE_CONFIG[tooltip.node.type]?.ring || S.border}`, borderRadius: 8, padding: '10px 12px', left: tooltip.x + 16, top: tooltip.y - 10, boxShadow: `0 0 20px ${NODE_CONFIG[tooltip.node.type]?.ring || '#334155'}33`, minWidth: 160 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: S.text }}>{tooltip.node.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: NODE_CONFIG[tooltip.node.type]?.ring }} />
              <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: NODE_CONFIG[tooltip.node.type]?.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tooltip.node.type}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
