import { apiClient } from './client'
import { ExecutionRun } from '../types/run'

export interface ReplayData {
  run_id: string
  steps: unknown[]
  total_tokens: number
  duration_ms?: number
  status: string
}

export const runsApi = {
  list: (params?: {
    executor_id?: string
    orchestrator_id?: string
    status?: string
    is_sandbox?: boolean
    page?: number
    size?: number
  }) =>
    apiClient.get<ExecutionRun[]>('/runs', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<ExecutionRun>(`/runs/${id}`).then(r => r.data),

  replay: (id: string) =>
    apiClient.get<ReplayData>(`/runs/${id}/replay`).then(r => r.data),

  score: (id: string, scores: Record<string, unknown>) =>
    apiClient.post<ExecutionRun>(`/runs/${id}/score`, { scores }).then(r => r.data),
}
