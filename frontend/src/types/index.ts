export interface User {
  id: string
  username: string
  email: string
  role?: string
  roles?: string[]
  must_change_password: boolean
  status: string
  created_at?: string
  failed_attempts?: number
  locked_until?: string | null
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
}

export interface PendingUser {
  id: string
  username: string
  email: string
  created_at: string
}

export interface RuleTreeNode {
  id: string
  category_id: string
  parent_id: string | null
  label: string
  code_segment: string
  description: string | null
  field_type: 'option' | 'options' | 'input' | 'fixed'
  fixed_value: string | null
  sort_order: number
  children: RuleTreeNode[]
}

export interface RuleTreeCategory {
  id: string
  name: string
  description: string | null
  prefix: string | null
  sort_order: number
  nodes: RuleTreeNode[]
}

export interface PartNumber {
  id: string
  part_no: string
  design_no: string | null
  qpa: number | null
  part_type: string | null
  description: string | null
  mfg_part: string | null
  vendor_pn: string | null
  item_text: string | null
  created_by: string | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  target_user_id: string | null
  action: string
  ip_address: string | null
  details: Record<string, unknown> | null
  created_at: string
}
