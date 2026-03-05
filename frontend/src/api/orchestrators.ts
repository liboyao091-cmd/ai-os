import { apiClient } from './client'
import { ExecutorRunResponse } from '../types/executor'

export interface Orchestrator {
  id: string
  owner_id: string
  name: string
  description?: string
  tags: string[]
  visibility: string
  fork_policy: string
  forked_from?: string
  routing_type: 'rule_based' | 'intent_based' | 'canvas' | 'auto'
  definition: Record<string, unknown>
  executor_refs: string[]
  model_policy_id?: string
  created_at: string
  updated_at: string
}

export interface OrchestratorCreate {
  name: string
  description?: string
  tags?: string[]
  visibility?: string
  routing_type: string
  definition: Record<string, unknown>
  executor_refs?: string[]
  model_policy_id?: string
}

export const orchestratorsApi = {
  list: () =>
    apiClient.get<Orchestrator[]>('/orchestrators').then(r => r.data),

  get: (id: string) =>
    apiClient.get<Orchestrator>(`/orchestrators/${id}`).then(r => r.data),

  create: (data: OrchestratorCreate) =>
    apiClient.post<Orchestrator>('/orchestrators', data).then(r => r.data),

  update: (id: string, data: Partial<OrchestratorCreate>) =>
    apiClient.put<Orchestrator>(`/orchestrators/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/orchestrators/${id}`),

  fork: (id: string) =>
    apiClient.post<Orchestrator>(`/orchestrators/${id}/fork`).then(r => r.data),

  run: (id: string, input: Record<string, unknown>, message?: string) =>
    apiClient.post<ExecutorRunResponse>(`/orchestrators/${id}/run`, { input, message }).then(r => r.data),

  runs: (id: string, params?: { page?: number; size?: number }) =>
    apiClient.get<ExecutorRunResponse[]>(`/orchestrators/${id}/runs`, { params }).then(r => r.data),
}
