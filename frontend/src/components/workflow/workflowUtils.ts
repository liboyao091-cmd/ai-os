import { Node, Edge, MarkerType } from 'reactflow'

export interface WorkflowStep {
  step_id: string
  name?: string
  type: string
  // tool_call
  tool_id?: string
  input_mapping?: Record<string, string>
  output_key?: string
  // llm_generate
  prompt_template?: string
  use_knowledge?: boolean
  knowledge_ids?: string[]
  // condition
  condition?: string
  true_next?: string[]
  false_next?: string[]
  // human_confirm
  message_template?: string
  // sub_executor
  executor_id?: string
  // generic next
  next?: string[]
}

export interface WorkflowDefinition {
  steps: WorkflowStep[]
  output_key?: string
  system_prompt?: string
}

const LAYOUT_X_GAP = 220
const LAYOUT_Y = 100

export function definitionToFlow(def: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  const steps = def.steps || []
  const nodes: Node[] = steps.map((step, i) => ({
    id: step.step_id,
    type: step.type,
    position: { x: i * LAYOUT_X_GAP + 50, y: LAYOUT_Y },
    data: { ...step },
  }))

  const edges: Edge[] = []
  steps.forEach(step => {
    const targets: string[] = []
    if (step.next) targets.push(...step.next)
    if (step.true_next) targets.push(...step.true_next)
    if (step.false_next) targets.push(...step.false_next)

    targets.forEach(t => {
      const isFalse = step.false_next?.includes(t)
      edges.push({
        id: `${step.step_id}->${t}`,
        source: step.step_id,
        target: t,
        label: step.type === 'condition' ? (isFalse ? 'false' : 'true') : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1.5, stroke: isFalse ? '#ef4444' : undefined },
      })
    })
  })

  return { nodes, edges }
}

export function flowToDefinition(nodes: Node[], edges: Edge[], outputKey = 'result'): WorkflowDefinition {
  const steps: WorkflowStep[] = nodes.map(n => {
    const data = n.data as WorkflowStep
    const outEdges = edges.filter(e => e.source === n.id)

    const step: WorkflowStep = { ...data, step_id: n.id }

    if (data.type === 'condition') {
      step.true_next = outEdges.filter(e => e.label === 'true' || !e.label).map(e => e.target)
      step.false_next = outEdges.filter(e => e.label === 'false').map(e => e.target)
      delete step.next
    } else {
      step.next = outEdges.map(e => e.target)
      delete step.true_next
      delete step.false_next
    }

    return step
  })

  return { steps, output_key: outputKey }
}
