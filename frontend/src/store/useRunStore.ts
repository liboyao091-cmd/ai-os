import { create } from 'zustand'
import { ExecutionRun } from '../types/run'
import { runsApi } from '../api/runs'

interface RunStore {
  currentRun: ExecutionRun | null
  polling: boolean
  fetchRun: (id: string) => Promise<ExecutionRun>
  startPolling: (id: string, onUpdate: (run: ExecutionRun) => void) => () => void
  scoreRun: (id: string, scores: Record<string, unknown>) => Promise<void>
}

export const useRunStore = create<RunStore>((set) => ({
  currentRun: null,
  polling: false,

  fetchRun: async (id) => {
    const run = await runsApi.get(id)
    set({ currentRun: run })
    return run
  },

  startPolling: (id, onUpdate) => {
    set({ polling: true })
    const timer = setInterval(async () => {
      try {
        const run = await runsApi.get(id)
        set({ currentRun: run })
        onUpdate(run)
        if (['success', 'failed', 'cancelled'].includes(run.status)) {
          clearInterval(timer)
          set({ polling: false })
        }
      } catch {
        clearInterval(timer)
        set({ polling: false })
      }
    }, 1000)
    return () => { clearInterval(timer); set({ polling: false }) }
  },

  scoreRun: async (id, scores) => {
    const run = await runsApi.score(id, scores)
    set({ currentRun: run })
  },
}))
