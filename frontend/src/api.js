import axios from 'axios'

// In development: Vite proxies /api → localhost:8001
// In production:  VITE_API_URL points to the Railway backend URL
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : '/api'

const api = axios.create({ baseURL })

export const queryRAG           = (question, top_k = 5)  => api.post('/query?structured=false', { question, top_k })
export const queryRAGStructured = (question, top_k = 5)  => api.post('/query?structured=true',  { question, top_k })
export const analyzeRCA         = (equipment_tag)         => api.post('/rca/analyze', { equipment_tag })
export const generateCAR        = (equipment_tag)         => api.post('/compliance/generate-car', { equipment_tag })
export const checkOverdue       = (body = {})             => api.post('/compliance/overdue', body)
export const getGraph           = (tag)                   => api.get('/graph/subgraph', { params: { tag } })
export const uploadDoc          = (formData)              => api.post('/ingest/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getServiceHealth   = ()                      => api.get('/health/services')
