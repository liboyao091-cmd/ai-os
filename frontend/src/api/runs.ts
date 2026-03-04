import { apiClient } from './client'
import { ExecutionRun } from '../types/run'

export const runsApi = {
  get: (id: string) =>
    apiClient.get<ExecutionRun>(`/runs/${id}`).then(r => r.data),

  replay: (id: string) =>
    apiClient.get<{ run_id: string; steps: unknown[]; total_tokens: number; duration_ms?: number; status: string }>(
      `/runs/${id}/replay`
    ).then(r => r.data),

  score: (id: string, scores: Record<string, unknown>) =>
    apiClient.post<ExecutionRun>(`/runs/${id}/score`, { scores }).then(r => r.data),
}
