import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Edit2, Trash2, GitFork, X, ChevronDown, ChevronRight } from 'lucide-react'
import { apiClient } from '../../api/client'

interface GuardrailRule {
  type: string
  pattern?: string
  action?: string
  max_tokens?: number
  max_steps?: number
  [key: string]: unknown
}

interface GuardrailRules {
  input?: GuardrailRule[]
  output?: GuardrailRule[]
  execution?: GuardrailRule[]
  budget?: GuardrailRule[]
}

interface Guardrail {
  id: string
  owner_id: string
  name: string
  visibility: string
  rules: GuardrailRules
  created_at: string
}

const DEFAULT_RULES: GuardrailRules = {
  input: [],
  output: [],
  execution: [],
  budget: [],
}

const SECTION_LABELS: Record<string, string> = {
  input: '输入规则',
  output: '输出规则',
  execution: '执行规则',
  budget: '预算规则',
}

const SECTION_DESCS: Record<string, string> = {
  input: '拦截/过滤输入内容，如敏感词、注入攻击检测',
  output: '过滤/变换输出内容，如脱敏、格式校验',
  execution: '限制执行行为，如最大步骤数、工具黑名单',
  budget: '控制 Token 预算，如单次限制、月度限额',
}

interface ModalProps {
  initial?: Guardrail | null
  onClose: () => void
  onSaved: () => void
}

function GuardrailModal({ initial, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [visibility, setVisibility] = useState(initial?.visibility ?? 'private')
  const [rulesJson, setRulesJson] = useState(
    JSON.stringify(initial?.rules ?? DEFAULT_RULES, null, 2)
  )
  const [jsonError, setJsonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    input: true, output: true, execution: true, budget: true,
  })

  const validateJson = (v: string) => {
    try { JSON.parse(v); setJsonError(''); return true }
    catch (e: unknown) { setJsonError(e instanceof Error ? e.message : 'JSON 格式错误'); return false }
  }

  const toggleSection = (section: string) =>
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))

  const handleSave = async () => {
    if (!name.trim()) return
    if (!validateJson(rulesJson)) return
    setSaving(true)
    try {
      const rules = JSON.parse(rulesJson)
      if (initial) {
        await apiClient.put(`/guardrails/${initial.id}`, { name, visibility, rules })
      } else {
        await apiClient.post('/guardrails', { name, visibility, rules })
      }
      onSaved()
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  let parsedRules: GuardrailRules = {}
  try { parsedRules = JSON.parse(rulesJson) } catch { /* ignore */ }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? '编辑约束规则集' : '新建约束规则集'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name + Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">名称 *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="如：内容安全基础规则"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">可见性</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={visibility}
                onChange={e => setVisibility(e.target.value)}
              >
                <option value="private">私有</option>
                <option value="team">团队</option>
                <option value="public">公开</option>
              </select>
            </div>
          </div>

          {/* Rules Sections Preview */}
          <div className="space-y-2">
            {Object.entries(SECTION_LABELS).map(([key, label]) => {
              const sectionRules: GuardrailRule[] = (parsedRules as Record<string, GuardrailRule[]>)[key] || []
              return (
                <div key={key} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                    onClick={() => toggleSection(key)}
                  >
                    <span className="flex items-center gap-2">
                      {expandedSections[key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {label}
                      <span className="ml-1 text-xs text-gray-400 font-normal">{SECTION_DESCS[key]}</span>
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {sectionRules.length} 条
                    </span>
                  </button>
                  {expandedSections[key] && (
                    <div className="px-4 py-2">
                      {sectionRules.length === 0 ? (
                        <p className="text-xs text-gray-400">暂无规则（在下方 JSON 编辑器中添加）</p>
                      ) : (
                        <ul className="space-y-1">
                          {sectionRules.map((rule, i) => (
                            <li key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 font-mono">
                              {JSON.stringify(rule)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* JSON Editor */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              规则 JSON（直接编辑 input / output / execution / budget 四个数组）
            </label>
            <textarea
              className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${jsonError ? 'border-red-400' : ''}`}
              rows={12}
              value={rulesJson}
              onChange={e => { setRulesJson(e.target.value); validateJson(e.target.value) }}
              spellCheck={false}
            />
            {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
          </div>

          {/* Example hint */}
          <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700">
            <p className="font-medium mb-1">规则格式示例：</p>
            <pre className="whitespace-pre-wrap font-mono text-xs">{`{
  "input":  [{"type":"keyword_block","patterns":["忽略上述"]}],
  "output": [{"type":"pii_mask","fields":["phone","id_card"]}],
  "execution": [{"type":"max_steps","value":20}],
  "budget": [{"type":"max_tokens_per_run","value":50000}]
}`}</pre>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !!jsonError}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ruleCount(rules: GuardrailRules): number {
  return Object.values(rules).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
}

export function GuardrailsPage() {
  const [guardrails, setGuardrails] = useState<Guardrail[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Guardrail | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<Guardrail[]>('/guardrails')
      setGuardrails(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此约束规则集？')) return
    setDeleting(id)
    try {
      await apiClient.delete(`/guardrails/${id}`)
      setGuardrails(prev => prev.filter(g => g.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleFork = async (id: string) => {
    try {
      const res = await apiClient.post<Guardrail>(`/guardrails/${id}/fork`)
      setGuardrails(prev => [res.data, ...prev])
    } catch (e) {
      console.error(e)
    }
  }

  const visibilityBadge = (v: string) => {
    const map: Record<string, string> = { private: '私有', team: '团队', public: '公开' }
    const color: Record<string, string> = {
      private: 'bg-gray-100 text-gray-600',
      team: 'bg-blue-100 text-blue-700',
      public: 'bg-green-100 text-green-700',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color[v] ?? 'bg-gray-100 text-gray-600'}`}>
        {map[v] ?? v}
      </span>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">约束规则</h1>
          <p className="text-sm text-gray-500 mt-0.5">配置输入/输出/执行约束，控制 token 预算与最大步骤数</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> 新建规则集
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400 text-sm">加载中…</div>
      ) : guardrails.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-300">
          <Shield size={48} className="mb-3" />
          <p className="text-sm">暂无约束规则集，点击「新建规则集」创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {guardrails.map(g => (
            <div key={g.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-blue-500 flex-shrink-0" />
                  <span className="font-semibold text-gray-900 text-sm truncate max-w-[160px]" title={g.name}>{g.name}</span>
                </div>
                {visibilityBadge(g.visibility)}
              </div>

              {/* Rule section summary */}
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {Object.entries(SECTION_LABELS).map(([key, label]) => {
                  const count = ((g.rules as Record<string, unknown[]>)[key] || []).length
                  return (
                    <div key={key} className="bg-gray-50 rounded-lg px-3 py-1.5 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={`text-xs font-semibold ${count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{count}</span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">共 {ruleCount(g.rules)} 条规则</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleFork(g.id)}
                    title="Fork"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <GitFork size={14} />
                  </button>
                  <button
                    onClick={() => { setEditing(g); setModalOpen(true) }}
                    title="编辑"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    disabled={deleting === g.id}
                    title="删除"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <GuardrailModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
