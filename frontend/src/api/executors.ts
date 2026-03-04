import { apiClient } from './client'
import { Executor, ExecutorCreate, ExecutorRunResponse } from '../types/executor'

export const executorsApi = {
  list: (params?: { visibility?: string; executor_type?: string; tags?: string; page?: number; size?: number }) =>
    apiClient.get<Executor[]>('/executors', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Executor>(`/executors/${id}`).then(r => r.data),

  create: (data: ExecutorCreate) =>
    apiClient.post<Executor>('/executors', data).then(r => r.data),

  update: (id: string, data: Partial<ExecutorCreate>) =>
    apiClient.put<Executor>(`/executors/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/executors/${id}`),

  fork: (id: string) =>
    apiClient.post<Executor>(`/executors/${id}/fork`).then(r => r.data),

  run: (id: string, input: Record<string, unknown>) =>
    apiClient.post<ExecutorRunResponse>(`/executors/${id}/run`, { input }).then(r => r.data),

  sandbox: (id: string, input: Record<string, unknown>) =>
    apiClient.post<ExecutorRunResponse>(`/executors/${id}/sandbox`, { input }).then(r => r.data),

  runAsync: (id: string, input: Record<string, unknown>) =>
    apiClient.post<ExecutorRunResponse>(`/executors/${id}/run/async`, { input }).then(r => r.data),

  runs: (id: string, params?: { status?: string; page?: number; size?: number }) =>
    apiClient.get<ExecutorRunResponse[]>(`/executors/${id}/runs`, { params }).then(r => r.data),

  confirm: (executorId: string, runId: string, confirmed: boolean) =>
    apiClient.post<ExecutorRunResponse>(`/executors/${executorId}/runs/${runId}/confirm`, { confirmed }).then(r => r.data),
}
