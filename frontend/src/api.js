import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const queryRAG      = (question, top_k = 5)  => api.post('/query',  { question, top_k })
export const analyzeRCA    = (equipment_tag)          => api.post('/rca/analyze', { equipment_tag })
export const generateCAR   = (equipment_tag)          => api.post('/compliance/generate-car', { equipment_tag })
export const checkOverdue  = (body = {})              => api.post('/compliance/overdue', body)
export const getGraph      = (tag)                    => api.get('/graph/subgraph', { params: { tag } })
export const uploadDoc     = (formData)               => api.post('/ingest/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
