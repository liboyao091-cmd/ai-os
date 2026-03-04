import { create } from 'zustand'
import { Executor } from '../types/executor'
import { executorsApi } from '../api/executors'

interface ExecutorStore {
  executors: Executor[]
  loading: boolean
  error: string | null
  fetchExecutors: (params?: Record<string, string>) => Promise<void>
  deleteExecutor: (id: string) => Promise<void>
  forkExecutor: (id: string) => Promise<Executor>
}

export const useExecutorStore = create<ExecutorStore>((set) => ({
  executors: [],
  loading: false,
  error: null,

  fetchExecutors: async (params) => {
    set({ loading: true, error: null })
    try {
      const executors = await executorsApi.list(params)
      set({ executors, loading: false })
    } catch (e: unknown) {
      set({ error: String(e), loading: false })
    }
  },

  deleteExecutor: async (id) => {
    await executorsApi.delete(id)
    set(s => ({ executors: s.executors.filter(e => e.id !== id) }))
  },

  forkExecutor: async (id) => {
    const forked = await executorsApi.fork(id)
    set(s => ({ executors: [forked, ...s.executors] }))
    return forked
  },
}))
