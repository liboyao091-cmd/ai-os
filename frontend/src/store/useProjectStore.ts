import { create } from 'zustand'
import { Project } from '../types/project'
import { projectsApi } from '../api/projects'

interface ProjectStore {
  projects: Project[]
  loading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await projectsApi.list()
      set({ projects, loading: false })
    } catch (e: unknown) {
      set({ error: String(e), loading: false })
    }
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id)
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }))
  },
}))
