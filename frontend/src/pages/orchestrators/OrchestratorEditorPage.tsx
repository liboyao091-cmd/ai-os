/**
 * OrchestratorEditorPage
 * - canvas type: React Flow canvas with ExecutorNodes
 * - intent_based: table UI for intents
 * - rule_based: table UI for rules
 * - auto: system prompt + max_rounds
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Node, Edge, Connection, MarkerType, BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { orchestratorsApi } from '../../api/orchestrators'
import { executorsApi } from '../../api/executors'

interface Orchestrator {
  id: string; name: string; description?: string; routing_type: string
  visibility: string; definition: Record<string, unknown>; executor_refs: string[]
  model_policy_id?: string; tags: string[]
}
interface Executor { id: string; name: string; executor_type: string }

// ─── Canvas node ──────────────────────────────────────────────────────────────
function ExecutorNode({ data, selected }: { data: { label: string; executor_type: string }; selected: boolean }) {
  return (
    <div className="rounded-xl border-2 bg-white shadow-sm min-w-[160px]"
      style={{ borderColor: selected ? '#3b82f6' : '#cbd5e1' }}>
      <div className="px-3 py-2 bg-slate-50 rounded-t-xl border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-700">{data.label}</p>
      </div>
      <div className="px-3 py-1.5">
        <span className="text-xs text-slate-400">{data.executor_type}</span>
      </div>
    </div>
  )
}
const NODE_TYPES = { executor: ExecutorNode }

// ─── Sub-editors ──────────────────────────────────────────────────────────────

function CanvasEditor({ definition, onChange, allExecutors }: {
  definition: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
  allExecutors: Executor[]
}) {
  const canvasDef = definition as { nodes?: { id: string; executor_id: string; x: number; y: number }[]; edges?: { source: string; target: string }[] }
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (canvasDef.nodes || []).map(n => ({
      id: n.id, type: 'executor',
      position: { x: n.x || 0, y: n.y || 0 },
      data: {
        label: allExecutors.find(e => e.id === n.executor_id)?.name || n.executor_id,
        executor_id: n.executor_id,
        executor_type: allExecutors.find(e => e.id === n.executor_id)?.executor_type || '',
      },
    }))
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (canvasDef.edges || []).map((e, i) => ({
      id: `e${i}`, source: e.source, target: e.target,
      markerEnd: { type: MarkerType.ArrowClosed },
    }))
  )

  const emit = useCallback((ns: Node[], es: Edge[]) => {
    onChange({
      nodes: ns.map(n => ({ id: n.id, executor_id: (n.data as { executor_id: string }).executor_id, x: n.position.x, y: n.position.y })),
      edges: es.map(e => ({ source: e.source, target: e.target })),
    })
  }, [onChange])

  const onConnect = useCallback((c: Connection) => {
    const es = addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, edges)
    setEdges(es); emit(nodes, es)
  }, [edges, nodes, emit, setEdges])

  const addExecutorNode = (executorId: string) => {
    const ex = allExecutors.find(e => e.id === executorId)
    if (!ex) return
    const ns = [...nodes, {
      id: executorId + '_' + Date.now(),
      type: 'executor',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: ex.name, executor_id: ex.id, executor_type: ex.executor_type },
    }]
    setNodes(ns); emit(ns, edges)
  }

  return (
    <div className="flex h-full">
      {/* Executor selector sidebar */}
      <div className="w-56 border-r bg-white overflow-y-auto p-3 flex flex-col gap-2 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 px-1 mb-1">执行器（点击添加到画布）</p>
        {allExecutors.map(ex => (
          <button
            key={ex.id}
            onClick={() => addExecutorNode(ex.id)}
            className="flex flex-col items-start px-3 py-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
          >
            <span className="text-xs font-medium text-gray-800 truncate w-full">{ex.name}</span>
            <span className="text-xs text-gray-400">{ex.executor_type}</span>
          </button>
        ))}
        {allExecutors.length === 0 && <p className="text-xs text-gray-300 px-1">暂无执行器</p>}
      </div>
      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={changes => { onNodesChange(changes); setTimeout(() => emit(nodes, edges), 0) }}
          onEdgesChange={changes => { onEdgesChange(changes); setTimeout(() => emit(nodes, edges), 0) }}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode="Delete"
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 1.5 } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
          <Controls /><MiniMap />
        </ReactFlow>
      </div>
    </div>
  )
}

function IntentEditor({ definition, onChange, allExecutors }: {
  definition: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
  allExecutors: Executor[]
}) {
  interface Intent { name: string; executor_id: string; examples: string[] }
  const intents: Intent[] = (definition.intents as Intent[]) || []
  const update = (items: Intent[]) => onChange({ ...definition, intents: items })

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">意图路由规则</h3>
        <button
          onClick={() => update([...intents, { name: '新意图', executor_id: '', examples: [] }])}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          <Plus size={13} /> 添加意图
        </button>
      </div>
      {intents.map((intent, i) => (
        <div key={i} className="border rounded-xl p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={intent.name}
              onChange={e => { const v = [...intents]; v[i] = { ...v[i], name: e.target.value }; update(v) }}
              placeholder="意图名称"
            />
            <select
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={intent.executor_id}
              onChange={e => { const v = [...intents]; v[i] = { ...v[i], executor_id: e.target.value }; update(v) }}
            >
              <option value="">选择执行器…</option>
              {allExecutors.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
            <button onClick={() => update(intents.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1">
              <Trash2 size={14} />
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">示例话语（每行一条）</label>
            <textarea
              className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
              value={intent.examples.join('\n')}
              onChange={e => { const v = [...intents]; v[i] = { ...v[i], examples: e.target.value.split('\n').filter(Boolean) }; update(v) }}
              placeholder="帮我写报告&#10;生成分析报告"
            />
          </div>
        </div>
      ))}
      {intents.length === 0 && <p className="text-sm text-gray-400 text-center py-8">暂无意图规则，点击「添加意图」</p>}
    </div>
  )
}

function RuleEditor({ definition, onChange, allExecutors }: {
  definition: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
  allExecutors: Executor[]
}) {
  interface Rule { condition: string; executor_id: string }
  const rules: Rule[] = (definition.rules as Rule[]) || []
  const update = (items: Rule[]) => onChange({ ...definition, rules: items })

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">条件路由规则（按顺序匹配）</h3>
        <button
          onClick={() => update([...rules, { condition: '', executor_id: '' }])}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          <Plus size={13} /> 添加规则
        </button>
      </div>
      {rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-2 border rounded-xl px-4 py-3 bg-white">
          <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">#{i + 1}</span>
          <input
            className="flex-1 border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={rule.condition}
            onChange={e => { const v = [...rules]; v[i] = { ...v[i], condition: e.target.value }; update(v) }}
            placeholder="{`{{input.type}} == 'report'`}"
          />
          <select
            className="w-40 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={rule.executor_id}
            onChange={e => { const v = [...rules]; v[i] = { ...v[i], executor_id: e.target.value }; update(v) }}
          >
            <option value="">选择执行器…</option>
            {allExecutors.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
          <button onClick={() => update(rules.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {rules.length === 0 && <p className="text-sm text-gray-400 text-center py-8">暂无规则，点击「添加规则」</p>}
    </div>
  )
}

function AutoEditor({ definition, onChange }: {
  definition: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
}) {
  return (
    <div className="p-6 space-y-4 max-w-xl">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={8}
          value={(definition.system_prompt as string) || ''}
          onChange={e => onChange({ ...definition, system_prompt: e.target.value })}
          placeholder="你是一个智能编排器，根据用户的需求，自主选择合适的执行器完成任务。"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">最大轮次</label>
        <input
          type="number"
          min={1} max={20}
          className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={(definition.max_rounds as number) || 5}
          onChange={e => onChange({ ...definition, max_rounds: parseInt(e.target.value) || 5 })}
        />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function OrchestratorEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [orch, setOrch] = useState<Orchestrator | null>(null)
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState<Record<string, unknown>>({})
  const [allExecutors, setAllExecutors] = useState<Executor[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    executorsApi.list().then(list => setAllExecutors(list as Executor[])).catch(() => {})
    if (id) {
      orchestratorsApi.get(id).then(o => {
        const oo = o as Orchestrator
        setOrch(oo)
        setName(oo.name)
        setDefinition(oo.definition)
      })
    }
  }, [id])

  const handleSave = async () => {
    if (!id || !orch) return
    setSaving(true); setError('')
    try {
      await orchestratorsApi.update(id, { name, definition })
      setOrch(prev => prev ? { ...prev, name, definition } : null)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const renderEditor = () => {
    if (!orch) return null
    const props = { definition, onChange: setDefinition, allExecutors }
    switch (orch.routing_type) {
      case 'canvas':       return <CanvasEditor {...props} />
      case 'intent_based': return <IntentEditor {...props} />
      case 'rule_based':   return <RuleEditor {...props} />
      case 'auto':         return <AutoEditor definition={definition} onChange={setDefinition} />
      default: return <div className="p-4 text-sm text-gray-400">未知路由类型：{orch.routing_type}</div>
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/orchestrators')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <input
          className="text-lg font-semibold text-gray-900 outline-none flex-1 bg-transparent"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="编排器名称"
        />
        {orch && (
          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
            {orch.routing_type}
          </span>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '保存中…' : '保存'}
        </button>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-hidden">
        {!orch ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">加载中…</div>
        ) : renderEditor()}
      </div>
    </div>
  )
}
