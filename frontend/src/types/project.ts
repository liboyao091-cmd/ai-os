export interface Project {
  id: string
  owner_id: string
  name: string
  description?: string
  local_path?: string
  tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  name: string
  description?: string
  local_path?: string
  tags?: string[]
}

export interface ProjectUpdate {
  name?: string
  description?: string
  local_path?: string
  tags?: string[]
}
