import { useEffect, useState } from 'react'
import { Plus, X, Play, Trash2, WrenchIcon } from 'lucide-react'
import { useToolStore } from '../../store/useToolStore'
import { AssetCard } from '../../components/shared/AssetCard'
import { toolsApi } from '../../api/tools'
import { Tool, ToolCreate, InvokeType } from '../../types/tool'

const INVOKE_TYPE_OPTIONS: { value: InvokeType; label: string }[] = [
  { value: 'python_func', label: 'Python 函数' },
  { value: 'http_api', label: 'HTTP API' },
  { value: 'mcp', label: 'MCP' },
  { value: 'lark_api', label: '飞书 API' },
]

const DEFAULT_CONFIGS: Record<InvokeType, object> = {
  python_func: { source_code: 'def run(input: dict) -> dict:\n    return {"result": input}', requirements: [] },
  http_api: { url: 'https://example.com/api', method: 'POST', headers: {}, timeout: 30 },
  mcp: { server_url: 'http://localhost:3000', tool_name: 'my_tool' },
  lark_api: { api_path: '/open-apis/im/v1/messages', method: 'POST' },
}

function ToolFormModal({
  tool,
  onClose,
  onSaved,
}: {
  tool?: Tool
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!tool
  const [name, setName] = useState(tool?.name || '')
  const [description, setDescription] = useState(tool?.description || '')
  const [invokeType, setInvokeType] = useState<InvokeType>(tool?.invoke_type || 'python_func')
  const [configJson, setConfigJson] = useState(
    tool ? JSON.stringify(tool.invoke_config, null, 2) : JSON.stringify(DEFAULT_CONFIGS.python_func, null, 2)
  )
  const [inputSchemaJson, setInputSchemaJson] = useState(
    tool ? JSON.stringify(tool.input_schema, null, 2) : '{"type": "object", "properties": {}}'
  )
  const [visibility, setVisibility] = useState(tool?.visibility || 'private')
  const [forkPolicy, setForkPolicy] = useState(tool?.fork_policy || 'forkable')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testInput, setTestInput] = useState('{}')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'test'>('config')

  const handleTypeChange = (t: InvokeType) => {
    setInvokeType(t)
    if (!isEdit) setConfigJson(JSON.stringify(DEFAULT_CONFIGS[t], null, 2))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const cfg = JSON.parse(configJson)
      const schema = JSON.parse(inputSchemaJson)
      const payload: ToolCreate = {
        name,
        description,
        invoke_type: invokeType,
        invoke_config: cfg,
        input_schema: schema,
        output_schema: { type: 'object', properties: {} },
        visibility: visibility as ToolCreate['visibility'],
        fork_policy: forkPolicy as ToolCreate['fork_policy'],
        tags: [],
      }
      if (isEdit && tool) {
        await toolsApi.update(tool.id, payload)
      } else {
        await toolsApi.create(payload)
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!tool) return
    setTesting(true)
    setTestResult(null)
    try {
      const input = JSON.parse(testInput)
      const res = await toolsApi.test(tool.id, input)
      setTestResult(JSON.stringify(res, null, 2))
    } catch (e: unknown) {
      setTestResult(`错误: ${String(e)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[720px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">{isEdit ? '编辑工具' : '新建工具'}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b">
          {(['config', 'test'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-t-md -mb-px border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-brand-500 text-brand-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'config' ? '配置' : `测试${!isEdit ? ' (保存后可用)' : ''}`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'config' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">工具名称 *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. 拉取AB实验数据"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">调用类型</label>
                  <select
                    value={invokeType}
                    onChange={e => handleTypeChange(e.target.value as InvokeType)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none"
                  >
                    {INVOKE_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">调用配置 (JSON)</label>
                <textarea
                  value={configJson}
                  onChange={e => setConfigJson(e.target.value)}
                  rows={8}
                  className="w-full font-mono text-xs border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">输入 Schema (JSON)</label>
                <textarea
                  value={inputSchemaJson}
                  onChange={e => setInputSchemaJson(e.target.value)}
                  rows={3}
                  className="w-full font-mono text-xs border border-gray-300 rounded-md px-3 py-2 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">可见性</label>
                  <select
                    value={visibility}
                    onChange={e => setVisibility(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="private">私有</option>
                    <option value="team">团队</option>
                    <option value="public">公开</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fork 权限</label>
                  <select
                    value={forkPolicy}
                    onChange={e => setForkPolicy(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="forkable">允许 Fork</option>
                    <option value="readonly">禁止 Fork</option>
                  </select>
                </div>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {!isEdit ? (
                <div className="text-sm text-gray-400 text-center py-8">请先保存工具后再进行测试</div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">测试输入 (JSON)</label>
                    <textarea
                      value={testInput}
                      onChange={e => setTestInput(e.target.value)}
                      rows={5}
                      className="w-full font-mono text-xs border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="{}"
                    />
                  </div>
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md disabled:opacity-50 w-fit"
                  >
                    <Play size={14} /> {testing ? '运行中...' : '运行测试'}
                  </button>
                  {testResult && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">测试结果</div>
                      <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-48">
                        {testResult}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          {isEdit && tool && (
            <button
              onClick={async () => {
                if (!confirm(`确认删除工具「${tool.name}」？`)) return
                await toolsApi.delete(tool.id)
                onSaved()
                onClose()
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
            >
              <Trash2 size={13} /> 删除
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">取消</button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name}
              className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50"
            >
              {saving ? '保存中...' : (isEdit ? '更新' : '创建工具')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToolsPage() {
  const { tools, loading, fetchTools, forkTool } = useToolStore()
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { fetchTools() }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">工具库</h1>
          <p className="text-sm text-gray-500 mt-0.5">注册和管理可被执行器调用的工具</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-md"
        >
          <Plus size={16} /> 新建工具
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(tool => (
            <AssetCard
              key={tool.id}
              name={tool.name}
              description={tool.description}
              tags={tool.tags}
              type={tool.invoke_type}
              visibility={tool.visibility}
              isOwner={true}
              badge={tool.invoke_type}
              badgeColor="bg-orange-100 text-orange-700"
              onFork={() => forkTool(tool.id)}
              onEdit={() => setEditingTool(tool)}
            />
          ))}
        </div>
      )}

      {tools.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <WrenchIcon size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">还没有工具，点击「新建工具」开始</div>
        </div>
      )}

      {(showCreate || editingTool) && (
        <ToolFormModal
          tool={editingTool || undefined}
          onClose={() => { setShowCreate(false); setEditingTool(null) }}
          onSaved={() => fetchTools()}
        />
      )}
    </div>
  )
}
