import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Play } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { executorsApi } from '../../api/executors'
import { Executor, ExecutorCreate, ExecutorType } from '../../types/executor'
import { SandboxPanel } from '../../components/shared/SandboxPanel'
import { toolsApi } from '../../api/tools'
import { Tool } from '../../types/tool'

const EXECUTOR_TYPE_OPTIONS: { value: ExecutorType; label: string; desc: string }[] = [
  { value: 'workflow', label: 'Workflow', desc: '纯步骤流程，无 LLM' },
  { value: 'ai_workflow', label: 'AI Workflow', desc: '步骤流程 + LLM 生成' },
  { value: 'agent', label: 'Agent', desc: '自主规划 ReAct 循环' },
  { value: 'multi_agent', label: 'Multi-Agent', desc: '多 Agent 协作' },
  { value: 'copilot', label: 'Copilot', desc: '交互式问答' },
]

const DEFINITION_TEMPLATES: Record<ExecutorType, object> = {
  workflow: {
    steps: [
      {
        step_id: 's1',
        name: '步骤1',
        type: 'tool_call',
        tool_id: 'YOUR_TOOL_ID',
        input_mapping: { param: '{{input.value}}' },
        output_key: 'result',
        next: [],
      },
    ],
    output_key: 'result',
  },
  ai_workflow: {
    steps: [
      {
        step_id: 's1',
        name: '生成报告',
        type: 'llm_generate',
        prompt_template: '请分析以下内容：{{input.data}}',
        use_knowledge: false,
        output_key: 'report',
        next: [],
      },
    ],
    output_key: 'report',
  },
  agent: {
    system_prompt: '你是专业数据科学家，专注{{domain}}方向。根据目标自主规划并调用工具。',
    goal_prompt_template: '请完成：{{input.goal}}\n背景：{{input.context}}',
    domain: '数据分析',
    memory_config: { use_knowledge: false, use_project_memory: false, use_style_memory: false },
  },
  multi_agent: {
    agents: [],
    coordinator_prompt: '协调多个 Agent 完成任务',
  },
  copilot: {
    steps: [],
    system_prompt: '你是一个交互式 AI 助手',
    output_key: 'response',
  },
}

export function ExecutorEditorPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [executor, setExecutor] = useState<Executor | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [executorType, setExecutorType] = useState<ExecutorType>('ai_workflow')
  const [visibility, setVisibility] = useState<'private' | 'team' | 'public'>('private')
  const [definitionJson, setDefinitionJson] = useState(
    JSON.stringify(DEFINITION_TEMPLATES.ai_workflow, null, 2)
  )
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id || null)

  useEffect(() => {
    toolsApi.list().then(setTools).catch(() => {})
    if (!isNew && id) {
      executorsApi.get(id).then(ex => {
        setExecutor(ex)
        setName(ex.name)
        setDescription(ex.description || '')
        setExecutorType(ex.executor_type as ExecutorType)
        setVisibility(ex.visibility as 'private' | 'team' | 'public')
        setDefinitionJson(JSON.stringify(ex.definition, null, 2))
        setSelectedToolIds(ex.tool_ids)
        setSavedId(ex.id)
      })
    }
  }, [id])

  const handleTypeChange = (t: ExecutorType) => {
    setExecutorType(t)
    if (!executor) {
      setDefinitionJson(JSON.stringify(DEFINITION_TEMPLATES[t], null, 2))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const definition = JSON.parse(definitionJson)
      const payload: ExecutorCreate = {
        name,
        description,
        executor_type: executorType,
        definition,
        visibility,
        tool_ids: selectedToolIds,
        knowledge_ids: [],
        tags: [],
      }
      if (isNew || !savedId) {
        const created = await executorsApi.create(payload)
        setSavedId(created.id)
        navigate(`/executors/${created.id}`, { replace: true })
      } else {
        await executorsApi.update(savedId, payload)
      }
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate('/executors')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="执行器名称"
          className="text-lg font-semibold text-gray-900 outline-none flex-1 bg-transparent"
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving || !name}
          className="flex items-center gap-2 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-md disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: config */}
        <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto p-4 flex flex-col gap-4 shrink-0">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">基本信息</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="描述..."
              className="w-full text-sm border border-gray-200 rounded-md p-2 outline-none resize-none"
            />
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as 'private' | 'team' | 'public')}
              className="w-full mt-2 text-sm border border-gray-200 rounded-md p-2 outline-none"
            >
              <option value="private">私有</option>
              <option value="team">团队</option>
              <option value="public">公开</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">执行器类型</label>
            <div className="flex flex-col gap-1.5">
              {EXECUTOR_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                  className={`flex flex-col items-start p-2 rounded-md text-left text-sm transition-colors ${
                    executorType === opt.value
                      ? 'bg-brand-50 border border-brand-300 text-brand-700'
                      : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-gray-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              绑定工具 ({selectedToolIds.length})
            </label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {tools.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedToolIds.includes(t.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedToolIds(ids => [...ids, t.id])
                      } else {
                        setSelectedToolIds(ids => ids.filter(id => id !== t.id))
                      }
                    }}
                  />
                  <span className="truncate">{t.name}</span>
                </label>
              ))}
              {tools.length === 0 && (
                <div className="text-xs text-gray-400">暂无工具，请先在工具库创建</div>
              )}
            </div>
          </div>
        </div>

        {/* Center: definition editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Definition (JSON)</span>
            <span className="text-xs text-gray-400">
              Phase 1: JSON 编辑器 / Phase 2: 可视化画布
            </span>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={definitionJson}
              onChange={v => setDefinitionJson(v || '')}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        {/* Right: sandbox */}
        {savedId && (
          <div className="w-80 border-l border-gray-200 flex flex-col shrink-0">
            <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2">
              <Play size={14} className="text-green-600" />
              <span className="text-sm font-medium text-gray-700">沙箱测试</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <SandboxPanel executorId={savedId} />
            </div>
          </div>
        )}

        {!savedId && (
          <div className="w-80 border-l border-gray-200 flex items-center justify-center bg-gray-50 shrink-0">
            <div className="text-sm text-gray-400 text-center px-4">
              保存执行器后<br />即可在此运行沙箱测试
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
