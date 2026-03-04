import { create } from 'zustand'
import { Tool } from '../types/tool'
import { toolsApi } from '../api/tools'

interface ToolStore {
  tools: Tool[]
  loading: boolean
  error: string | null
  fetchTools: (params?: Record<string, string>) => Promise<void>
  deleteTool: (id: string) => Promise<void>
  forkTool: (id: string) => Promise<Tool>
}

export const useToolStore = create<ToolStore>((set, get) => ({
  tools: [],
  loading: false,
  error: null,

  fetchTools: async (params) => {
    set({ loading: true, error: null })
    try {
      const tools = await toolsApi.list(params)
      set({ tools, loading: false })
    } catch (e: unknown) {
      set({ error: String(e), loading: false })
    }
  },

  deleteTool: async (id) => {
    await toolsApi.delete(id)
    set(s => ({ tools: s.tools.filter(t => t.id !== id) }))
  },

  forkTool: async (id) => {
    const forked = await toolsApi.fork(id)
    set(s => ({ tools: [forked, ...s.tools] }))
    return forked
  },
}))
