import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useToolStore } from '../../store/useToolStore'
import { AssetCard } from '../../components/shared/AssetCard'
import { toolsApi } from '../../api/tools'
import { ToolCreate, InvokeType } from '../../types/tool'

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

function CreateToolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<ToolCreate>({
    name: '',
    description: '',
    invoke_type: 'python_func',
    invoke_config: DEFAULT_CONFIGS.python_func,
    input_schema: { type: 'object', properties: {} },
    output_schema: { type: 'object', properties: {} },
    visibility: 'private',
    tags: [],
  })
  const [configJson, setConfigJson] = useState(JSON.stringify(DEFAULT_CONFIGS.python_func, null, 2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleTypeChange = (t: InvokeType) => {
    const cfg = DEFAULT_CONFIGS[t]
    setForm(f => ({ ...f, invoke_type: t, invoke_config: cfg }))
    setConfigJson(JSON.stringify(cfg, null, 2))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const cfg = JSON.parse(configJson)
      await toolsApi.create({ ...form, invoke_config: cfg })
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">新建工具</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">工具名称 *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. 拉取AB实验数据"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">调用类型</label>
            <select
              value={form.invoke_type}
              onChange={e => handleTypeChange(e.target.value as InvokeType)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none"
            >
              {INVOKE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">可见性</label>
            <select
              value={form.visibility}
              onChange={e => setForm(f => ({ ...f, visibility: e.target.value as 'private' | 'team' | 'public' }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="private">私有</option>
              <option value="team">团队</option>
              <option value="public">公开</option>
            </select>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">取消</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name}
            className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50"
          >
            {saving ? '创建中...' : '创建工具'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ToolsPage() {
  const { tools, loading, fetchTools, deleteTool, forkTool } = useToolStore()
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
              onEdit={() => {/* TODO: edit modal */}}
            />
          ))}
        </div>
      )}

      {tools.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">还没有工具，点击「新建工具」开始</div>
        </div>
      )}

      {showCreate && (
        <CreateToolModal
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchTools()}
        />
      )}
    </div>
  )
}

function Wrench({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}
