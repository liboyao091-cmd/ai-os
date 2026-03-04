export type InvokeType = 'python_func' | 'http_api' | 'mcp' | 'lark_api'
export type Visibility = 'private' | 'team' | 'public'
export type ForkPolicy = 'forkable' | 'readonly'

export interface Tool {
  id: string
  owner_id: string
  name: string
  description?: string
  tags: string[]
  visibility: Visibility
  fork_policy: ForkPolicy
  forked_from?: string
  invoke_type: InvokeType
  invoke_config: Record<string, unknown>
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ToolCreate {
  name: string
  description?: string
  tags?: string[]
  visibility?: Visibility
  fork_policy?: ForkPolicy
  invoke_type: InvokeType
  invoke_config: Record<string, unknown>
  input_schema?: Record<string, unknown>
  output_schema?: Record<string, unknown>
}

export interface ToolTestResult {
  output: unknown
  duration_ms: number
  error?: string
}
