import { StepLog } from './executor'

export interface ExecutionRun {
  id: string
  executor_id?: string
  orchestrator_id?: string
  triggered_by: string
  is_sandbox: boolean
  input: Record<string, unknown>
  output?: unknown
  status: 'running' | 'waiting_confirm' | 'success' | 'failed' | 'cancelled'
  steps_log: StepLog[]
  total_tokens: number
  duration_ms?: number
  error_message?: string
  human_scores: Record<string, unknown>
  started_at: string
  finished_at?: string
}
