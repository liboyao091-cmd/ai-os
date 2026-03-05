import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Plus, Edit2, Trash2, GitFork, Play, X } from 'lucide-react'
import { orchestratorsApi } from '../../api/orchestrators'

interface Orchestrator {
  id: string
  owner_id: string
  name: string
  description?: string
  tags: string[]
  visibility: string
  fork_policy: string
  forked_from?: string
  routing_type: string
  definition: Record<string, unknown>
  executor_refs: string[]
  model_policy_id?: string
  created_at: string
  updated_at: string
}

const ROUTING_TYPES = [
  { value: 'canvas',       label: '画布编排',    desc: '拖拽连接执行器，可视化流程' },
  { value: 'intent_based', label: '意图路由',    desc: '根据 LLM 意图自动路由执行器' },
  { value: 'rule_based',   label: '规则路由',    desc: '根据条件规则选择执行器' },
  { value: 'auto',         label: '自动编排',    desc: 'LLM 自主决定调用哪个执行器' },
]

const ROUTING_COLORS: Record<string, string> = {
  canvas:       'bg-blue-50 text-blue-700',
  intent_based: 'bg-purple-50 text-purple-700',
  rule_based:   'bg-green-50 text-green-700',
  auto:         'bg-orange-50 text-orange-700',
}

const DEFINITION_TEMPLATES: Record<string, object> = {
  canvas:       { nodes: [], edges: [] },
  intent_based: { intents: [{ name: '示例意图', executor_id: '', examples: ['用户说了什么'] }] },
  rule_based:   { rules: [{ condition: '{{input.type}} == "report"', executor_id: '' }] },
  auto:         { system_prompt: '根据用户需求，自主选择合适的执行器完成任务。', max_rounds: 5 },
}

interface CreateModalProps {
  onClose: () => void
  onCreated: (o: Orchestrator) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [routingType, setRoutingType] = useState('canvas')
  const [visibility, setVisibility] = useState('private')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const o = await orchestratorsApi.create({
        name,
        description,
        routing_type: routingType,
        visibility,
        definition: DEFINITION_TEMPLATES[routingType] || {},
        executor_refs: [],
        tags: [],
      })
      onCreated(o as Orchestrator)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">新建编排器</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">名称 *</label>
            <input
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="如：客户服务编排器"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="可选"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">路由类型</label>
            <div className="grid grid-cols-2 gap-2">
              {ROUTING_TYPES.map(rt => (
                <button
                  key={rt.value}
                  onClick={() => setRoutingType(rt.value)}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-colors ${routingType === rt.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="text-sm font-medium text-gray-800">{rt.label}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{rt.desc}</span>
                </button>
              ))}
            </div>
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
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">取消</button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OrchestratorListPage() {
  const navigate = useNavigate()
  const [orchestrators, setOrchestrators] = useState<Orchestrator[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await orchestratorsApi.list() as Orchestrator[]
      setOrchestrators(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除此编排器？')) return
    setDeleting(id)
    try {
      await orchestratorsApi.delete(id)
      setOrchestrators(prev => prev.filter(o => o.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleFork = async (id: string) => {
    try {
      const forked = await orchestratorsApi.fork(id) as Orchestrator
      setOrchestrators(prev => [forked, ...prev])
    } catch (e) { console.error(e) }
  }

  const routingLabel = (type: string) => ROUTING_TYPES.find(r => r.value === type)?.label ?? type

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">编排器</h1>
          <p className="text-sm text-gray-500 mt-0.5">画布式多执行器编排、意图路由、规则路由</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> 新建编排器
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400 text-sm">加载中…</div>
      ) : orchestrators.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-300">
          <Network size={48} className="mb-3" />
          <p className="text-sm">暂无编排器，点击「新建编排器」创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orchestrators.map(o => (
            <div key={o.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Network size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="font-semibold text-gray-900 text-sm truncate" title={o.name}>{o.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${ROUTING_COLORS[o.routing_type] || 'bg-gray-100 text-gray-600'}`}>
                  {routingLabel(o.routing_type)}
                </span>
              </div>

              {o.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{o.description}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                <span>{o.executor_refs.length} 个执行器</span>
                <span>·</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${o.visibility === 'private' ? 'bg-gray-100 text-gray-500' : o.visibility === 'team' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                  {o.visibility === 'private' ? '私有' : o.visibility === 'team' ? '团队' : '公开'}
                </span>
                {o.forked_from && <span className="text-gray-300">fork</span>}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate(`/orchestrators/${o.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit2 size={12} /> 编辑
                </button>
                <button
                  onClick={() => handleFork(o.id)}
                  title="Fork"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <GitFork size={14} />
                </button>
                <button
                  onClick={() => handleDelete(o.id)}
                  disabled={deleting === o.id}
                  title="删除"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={o => setOrchestrators(prev => [o, ...prev])}
        />
      )}
    </div>
  )
}
