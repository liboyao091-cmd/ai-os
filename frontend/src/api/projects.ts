import { apiClient } from './client'
import { Project, ProjectCreate, ProjectUpdate } from '../types/project'

export const projectsApi = {
  list: (params?: { tags?: string; page?: number; size?: number }) =>
    apiClient.get<Project[]>('/projects', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Project>(`/projects/${id}`).then(r => r.data),

  create: (data: ProjectCreate) =>
    apiClient.post<Project>('/projects', data).then(r => r.data),

  update: (id: string, data: ProjectUpdate) =>
    apiClient.put<Project>(`/projects/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/projects/${id}`),
}
