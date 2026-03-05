import { Visibility, ForkPolicy } from './tool'

export type ExecutorType = 'workflow' | 'ai_workflow' | 'agent' | 'multi_agent' | 'copilot'

export interface Executor {
  id: string
  owner_id: string
  name: string
  description?: string
  tags: string[]
  visibility: Visibility
  fork_policy: ForkPolicy
  forked_from?: string
  executor_type: ExecutorType
  definition: Record<string, unknown>
  tool_ids: string[]
  knowledge_ids: string[]
  model_policy_id?: string
  guardrail_id?: string
  input_schema: Record<string, unknown>
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ExecutorCreate {
  name: string
  description?: string
  tags?: string[]
  visibility?: Visibility
  fork_policy?: ForkPolicy
  executor_type: ExecutorType
  definition: Record<string, unknown>
  tool_ids?: string[]
  knowledge_ids?: string[]
  model_policy_id?: string
  guardrail_id?: string
  input_schema?: Record<string, unknown>
}

export interface ExecutorRunResponse {
  run_id: string
  executor_id?: string
  orchestrator_id?: string
  status: string
  is_sandbox: boolean
  input: Record<string, unknown>
  output?: unknown
  steps_log: StepLog[]
  total_tokens: number
  duration_ms?: number
  error_message?: string
  paused_step_id?: string
  started_at: string
  finished_at?: string
}

export interface StepLog {
  step_id?: string
  name?: string
  type: string
  step_type?: string
  status?: string
  input?: unknown
  output?: unknown
  duration_ms?: number
  tokens?: number
  tokens_used?: number
  error?: string
  timestamp?: string
  state_after?: Record<string, unknown>
}
