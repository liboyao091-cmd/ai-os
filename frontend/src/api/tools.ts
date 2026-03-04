import { apiClient } from './client'
import { Tool, ToolCreate, ToolTestResult } from '../types/tool'

export const toolsApi = {
  list: (params?: { visibility?: string; tags?: string; owner_id?: string; page?: number; size?: number }) =>
    apiClient.get<Tool[]>('/tools', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Tool>(`/tools/${id}`).then(r => r.data),

  create: (data: ToolCreate) =>
    apiClient.post<Tool>('/tools', data).then(r => r.data),

  update: (id: string, data: Partial<ToolCreate>) =>
    apiClient.put<Tool>(`/tools/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/tools/${id}`),

  fork: (id: string) =>
    apiClient.post<Tool>(`/tools/${id}/fork`).then(r => r.data),

  test: (id: string, input: Record<string, unknown>) =>
    apiClient.post<ToolTestResult>(`/tools/${id}/test`, { input }).then(r => r.data),
}
