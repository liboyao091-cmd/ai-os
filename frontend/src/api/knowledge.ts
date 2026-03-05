import { apiClient } from './client'

export interface KnowledgeSpace {
  id: string
  owner_id: string
  name: string
  description?: string
  visibility: string
  retrieval_config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface KnowledgeDocument {
  id: string
  space_id: string
  title?: string
  source_type?: string
  chunk_count: number
  status: 'pending' | 'indexing' | 'ready' | 'failed'
  error_message?: string
  created_at: string
}

export interface KnowledgeQueryResult {
  results: Array<{ content: string }>
}

export const knowledgeApi = {
  listSpaces: () =>
    apiClient.get<KnowledgeSpace[]>('/knowledge/spaces').then(r => r.data),

  createSpace: (data: { name: string; description?: string; visibility?: string }) =>
    apiClient.post<KnowledgeSpace>('/knowledge/spaces', data).then(r => r.data),

  updateSpace: (id: string, data: Partial<{ name: string; description: string; visibility: string }>) =>
    apiClient.put<KnowledgeSpace>(`/knowledge/spaces/${id}`, data).then(r => r.data),

  deleteSpace: (id: string) =>
    apiClient.delete(`/knowledge/spaces/${id}`),

  listDocuments: (spaceId: string) =>
    apiClient.get<KnowledgeDocument[]>(`/knowledge/spaces/${spaceId}/documents`).then(r => r.data),

  uploadDocument: (spaceId: string, formData: FormData) =>
    apiClient.post<KnowledgeDocument>(`/knowledge/spaces/${spaceId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  uploadText: (spaceId: string, title: string, content: string) => {
    const fd = new FormData()
    fd.append('title', title)
    fd.append('source_type', 'manual')
    fd.append('content', content)
    return apiClient.post<KnowledgeDocument>(`/knowledge/spaces/${spaceId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  deleteDocument: (docId: string) =>
    apiClient.delete(`/knowledge/documents/${docId}`),

  querySpace: (spaceId: string, query: string, topK = 5) =>
    apiClient.post<KnowledgeQueryResult>(`/knowledge/spaces/${spaceId}/query`, { query, top_k: topK }).then(r => r.data),
}
