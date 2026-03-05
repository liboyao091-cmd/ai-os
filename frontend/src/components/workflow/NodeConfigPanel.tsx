import { Node } from 'reactflow'
import { Trash2, X } from 'lucide-react'
import { WorkflowStep } from './workflowUtils'

interface NodeConfigPanelProps {
  node: Node
  tools: { id: string; name: string }[]
  onChange: (data: Partial<WorkflowStep>) => void
  onDelete: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputClass = 'w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500'
const textareaClass = 'w-full border rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none'

export function NodeConfigPanel({ node, tools, onChange, onDelete }: NodeConfigPanelProps) {
  const d = node.data as WorkflowStep

  const set = (key: string, value: unknown) => onChange({ [key]: value } as Partial<WorkflowStep>)

  const parseJson = (v: string): Record<string, string> => {
    try { return JSON.parse(v) } catch { return {} }
  }

  const typeLabel: Record<string, string> = {
    tool_call: '工具调用', llm_generate: 'LLM 生成',
    condition: '条件分支', human_confirm: '人工确认', sub_executor: '子执行器',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
        <div>
          <p className="text-xs font-semibold text-gray-700">{typeLabel[d.type] ?? d.type}</p>
          <p className="text-xs text-gray-400 font-mono">{d.step_id}</p>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          title="删除节点"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Common: step_id + name */}
        <Field label="步骤 ID">
          <input className={inputClass} value={d.step_id} onChange={e => set('step_id', e.target.value)} />
        </Field>
        <Field label="名称">
          <input className={inputClass} value={d.name || ''} onChange={e => set('name', e.target.value)} placeholder="可选显示名称" />
        </Field>

        {/* tool_call */}
        {d.type === 'tool_call' && (
          <>
            <Field label="工具">
              <select className={inputClass} value={d.tool_id || ''} onChange={e => set('tool_id', e.target.value)}>
                <option value="">选择工具…</option>
                {tools.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="输入映射 (JSON)">
              <textarea
                className={textareaClass}
                rows={4}
                defaultValue={JSON.stringify(d.input_mapping || {}, null, 2)}
                onBlur={e => set('input_mapping', parseJson(e.target.value))}
              />
              <p className="text-xs text-gray-400 mt-1">如：{"{"}"key": "{"}"{"{"}"input.value{"}"}{"}"}{"}"}"}}</p>
            </Field>
            <Field label="输出变量名">
              <input className={inputClass} value={d.output_key || ''} onChange={e => set('output_key', e.target.value)} placeholder="result" />
            </Field>
          </>
        )}

        {/* llm_generate */}
        {d.type === 'llm_generate' && (
          <>
            <Field label="Prompt 模板">
              <textarea
                className={textareaClass}
                rows={6}
                value={d.prompt_template || ''}
                onChange={e => set('prompt_template', e.target.value)}
                placeholder="请分析：{{input.data}}"
              />
              <p className="text-xs text-gray-400 mt-1">支持 {"{{variable}}"} 模板变量</p>
            </Field>
            <Field label="输出变量名">
              <input className={inputClass} value={d.output_key || ''} onChange={e => set('output_key', e.target.value)} placeholder="response" />
            </Field>
            <Field label="使用知识库">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!d.use_knowledge}
                  onChange={e => set('use_knowledge', e.target.checked)}
                />
                启用 RAG 检索
              </label>
            </Field>
          </>
        )}

        {/* condition */}
        {d.type === 'condition' && (
          <>
            <Field label="条件表达式">
              <input
                className={`${inputClass} font-mono`}
                value={d.condition || ''}
                onChange={e => set('condition', e.target.value)}
                placeholder="{{result}} != null"
              />
              <p className="text-xs text-gray-400 mt-1">支持 {"{{var}}"} 变量和 Python 表达式</p>
            </Field>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <p className="font-medium mb-1">分支连线说明：</p>
              <p>从此节点拖出连线，连线标签为 <span className="text-green-600 font-mono">true</span> 或 <span className="text-red-500 font-mono">false</span></p>
              <p className="mt-1">在 JSON 编辑器中可直接编辑 true_next / false_next 数组</p>
            </div>
          </>
        )}

        {/* human_confirm */}
        {d.type === 'human_confirm' && (
          <>
            <Field label="确认消息模板">
              <textarea
                className={textareaClass}
                rows={4}
                value={d.message_template || ''}
                onChange={e => set('message_template', e.target.value)}
                placeholder="请确认是否继续执行？当前结果：{{result}}"
              />
            </Field>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              执行到此节点时会暂停，等待用户在运行详情页批准或拒绝后继续。
            </div>
          </>
        )}

        {/* sub_executor */}
        {d.type === 'sub_executor' && (
          <>
            <Field label="子执行器 ID">
              <input
                className={`${inputClass} font-mono`}
                value={d.executor_id || ''}
                onChange={e => set('executor_id', e.target.value)}
                placeholder="粘贴执行器 UUID"
              />
            </Field>
            <Field label="输入映射 (JSON)">
              <textarea
                className={textareaClass}
                rows={4}
                defaultValue={JSON.stringify(d.input_mapping || {}, null, 2)}
                onBlur={e => set('input_mapping', parseJson(e.target.value))}
              />
            </Field>
            <Field label="输出变量名">
              <input className={inputClass} value={d.output_key || ''} onChange={e => set('output_key', e.target.value)} placeholder="sub_result" />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}
