/**
 * WorkflowCanvas — React Flow based visual editor for workflow/ai_workflow definitions.
 * Supports 5 node types: tool_call, llm_generate, condition, human_confirm, sub_executor
 */
import { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  NodeTypes,
  BackgroundVariant,
  MarkerType,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, Wrench, Bot, GitBranch, UserCheck, Layers } from 'lucide-react'
import { NodeConfigPanel } from './NodeConfigPanel'
import { WorkflowStep, definitionToFlow, flowToDefinition } from './workflowUtils'

// ─── Node type components ─────────────────────────────────────────────────────

function NodeWrapper({
  label, icon, color, selected, data,
}: {
  label: string; icon: React.ReactNode; color: string; selected: boolean
  data: { step_id: string; [k: string]: unknown }
}) {
  return (
    <div className={`rounded-xl border-2 bg-white shadow-sm min-w-[160px] ${selected ? 'border-blue-500 shadow-blue-100 shadow-md' : `border-${color}-200`}`}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl bg-${color}-50 border-b border-${color}-100`}>
        <span className={`text-${color}-600`}>{icon}</span>
        <span className={`text-xs font-semibold text-${color}-800`}>{label}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-500 font-mono truncate max-w-[140px]">{data.step_id}</p>
        {data.name && <p className="text-xs text-gray-700 truncate max-w-[140px]">{data.name as string}</p>}
      </div>
    </div>
  )
}

// Using inline style for colors to avoid Tailwind purge issues
const nodeColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  tool_call:     { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', icon: '#3b82f6' },
  llm_generate:  { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '#22c55e' },
  condition:     { bg: '#fefce8', border: '#fde047', text: '#854d0e', icon: '#eab308' },
  human_confirm: { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', icon: '#f97316' },
  sub_executor:  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8', icon: '#a855f7' },
}

const nodeIcons: Record<string, React.ReactNode> = {
  tool_call:     <Wrench size={13} />,
  llm_generate:  <Bot size={13} />,
  condition:     <GitBranch size={13} />,
  human_confirm: <UserCheck size={13} />,
  sub_executor:  <Layers size={13} />,
}

const nodeLabels: Record<string, string> = {
  tool_call:     '工具调用',
  llm_generate:  'LLM 生成',
  condition:     '条件分支',
  human_confirm: '人工确认',
  sub_executor:  '子执行器',
}

function makeNodeComponent(type: string) {
  const c = nodeColors[type]
  return function CustomNode({ data, selected }: { data: WorkflowStep & { [k: string]: unknown }; selected: boolean }) {
    return (
      <div
        className="rounded-xl border-2 bg-white shadow-sm min-w-[160px] cursor-pointer"
        style={{ borderColor: selected ? '#3b82f6' : c.border, boxShadow: selected ? `0 0 0 2px #bfdbfe` : undefined }}
      >
        <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl border-b" style={{ backgroundColor: c.bg, borderColor: c.border }}>
          <span style={{ color: c.icon }}>{nodeIcons[type]}</span>
          <span className="text-xs font-semibold" style={{ color: c.text }}>{nodeLabels[type]}</span>
        </div>
        <div className="px-3 py-2">
          <p className="text-xs font-mono truncate max-w-[140px]" style={{ color: '#6b7280' }}>{data.step_id}</p>
          {data.name && <p className="text-xs truncate max-w-[140px]" style={{ color: '#374151' }}>{data.name as string}</p>}
        </div>
      </div>
    )
  }
}

const ToolCallNode = makeNodeComponent('tool_call')
const LLMGenerateNode = makeNodeComponent('llm_generate')
const ConditionNode = makeNodeComponent('condition')
const HumanConfirmNode = makeNodeComponent('human_confirm')
const SubExecutorNode = makeNodeComponent('sub_executor')

const NODE_TYPES: NodeTypes = {
  tool_call: ToolCallNode,
  llm_generate: LLMGenerateNode,
  condition: ConditionNode,
  human_confirm: HumanConfirmNode,
  sub_executor: SubExecutorNode,
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  definitionJson: string
  onChange: (json: string) => void
  executorType: 'workflow' | 'ai_workflow' | 'copilot'
  tools?: { id: string; name: string }[]
}

let _nodeCounter = 0
const newId = () => `s${++_nodeCounter}`

const STEP_TEMPLATES: Record<string, Partial<WorkflowStep>> = {
  tool_call:     { type: 'tool_call',     tool_id: '',  input_mapping: {}, output_key: 'result' },
  llm_generate:  { type: 'llm_generate',  prompt_template: '请分析：{{input.data}}', output_key: 'response', use_knowledge: false },
  condition:     { type: 'condition',      condition: '{{result}} != null', true_next: [], false_next: [] },
  human_confirm: { type: 'human_confirm',  message_template: '请确认是否继续？', next: [] },
  sub_executor:  { type: 'sub_executor',   executor_id: '', input_mapping: {}, output_key: 'sub_result' },
}

export function WorkflowCanvas({ definitionJson, onChange, executorType, tools = [] }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [outputKey, setOutputKey] = useState('result')

  // Parse definition → flow
  useEffect(() => {
    try {
      const def = JSON.parse(definitionJson)
      const { nodes: n, edges: e } = definitionToFlow(def)
      setNodes(n)
      setEdges(e)
      setOutputKey(def.output_key || 'result')
    } catch { /* ignore parse errors while typing */ }
  }, []) // Only on mount; user edits update via onNodesChange

  // Flow → definition (called when user changes canvas)
  const emitChange = useCallback((ns: Node[], es: Edge[], ok: string) => {
    const def = flowToDefinition(ns, es, ok)
    onChange(JSON.stringify(def, null, 2))
  }, [onChange])

  const onConnect = useCallback((connection: Connection) => {
    const newEdges = addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, edges)
    setEdges(newEdges)
    emitChange(nodes, newEdges, outputKey)
  }, [edges, nodes, outputKey, emitChange, setEdges])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const handlePaneClick = useCallback(() => setSelectedNode(null), [])

  const addNode = (type: string) => {
    const id = newId()
    const newNode: Node = {
      id,
      type,
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { step_id: id, name: nodeLabels[type], ...STEP_TEMPLATES[type] },
    }
    const ns = [...nodes, newNode]
    setNodes(ns)
    emitChange(ns, edges, outputKey)
    setSelectedNode(newNode)
  }

  const updateNodeData = useCallback((nodeId: string, data: Partial<WorkflowStep>) => {
    setNodes(ns => {
      const updated = ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)
      emitChange(updated, edges, outputKey)
      return updated
    })
  }, [edges, outputKey, emitChange, setNodes])

  const deleteNode = useCallback((nodeId: string) => {
    const ns = nodes.filter(n => n.id !== nodeId)
    const es = edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    setNodes(ns)
    setEdges(es)
    emitChange(ns, es, outputKey)
    setSelectedNode(null)
  }, [nodes, edges, outputKey, emitChange, setNodes, setEdges])

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={changes => {
            onNodesChange(changes)
            // Emit after position changes settle
            setTimeout(() => emitChange(nodes, edges, outputKey), 0)
          }}
          onEdgesChange={changes => {
            onEdgesChange(changes)
            setTimeout(() => emitChange(nodes, edges, outputKey), 0)
          }}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode="Delete"
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 1.5 } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
          <Controls />
          <MiniMap nodeStrokeWidth={2} zoomable pannable className="!bottom-12" />

          {/* Add node toolbar */}
          <Panel position="top-left">
            <div className="bg-white border rounded-xl shadow-sm p-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-gray-500 px-2 py-1">添加节点</p>
              {Object.entries(nodeLabels).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg hover:bg-gray-50 text-gray-700 text-left"
                  style={{ color: nodeColors[type]?.text }}
                >
                  <span style={{ color: nodeColors[type]?.icon }}>{nodeIcons[type]}</span>
                  {label}
                </button>
              ))}
            </div>
          </Panel>

          {/* Output key */}
          <Panel position="bottom-left">
            <div className="bg-white border rounded-lg shadow-sm px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">输出变量：</span>
              <input
                className="text-xs border rounded px-2 py-1 font-mono w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={outputKey}
                onChange={e => { setOutputKey(e.target.value); emitChange(nodes, edges, e.target.value) }}
              />
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right: node config panel */}
      {selectedNode && (
        <div className="w-72 border-l bg-white overflow-y-auto flex-shrink-0">
          <NodeConfigPanel
            node={selectedNode}
            tools={tools}
            onChange={data => updateNodeData(selectedNode.id, data)}
            onDelete={() => deleteNode(selectedNode.id)}
          />
        </div>
      )}
    </div>
  )
}
