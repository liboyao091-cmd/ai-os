/**
 * MarketplacePage — 公开资产市场，浏览和 Fork 公开的工具/执行器
 */
import { useEffect, useState } from 'react'
import { Store, Wrench, GitBranch, GitFork, Search, RefreshCw } from 'lucide-react'
import { toolsApi } from '../api/tools'
import { executorsApi } from '../api/executors'
import { Tool } from '../types/tool'
import { Executor } from '../types/executor'
import clsx from 'clsx'

type Tab = 'tools' | 'executors'

const EXECUTOR_TYPE_COLORS: Record<string, string> = {
  workflow:    'bg-blue-100 text-blue-700',
  ai_workflow: 'bg-green-100 text-green-700',
  agent:       'bg-purple-100 text-purple-700',
  multi_agent: 'bg-pink-100 text-pink-700',
  copilot:     'bg-teal-100 text-teal-700',
}

const INVOKE_TYPE_COLORS: Record<string, string> = {
  python_func: 'bg-orange-100 text-orange-700',
  http_api:    'bg-indigo-100 text-indigo-700',
  mcp:         'bg-rose-100 text-rose-700',
  lark_api:    'bg-cyan-100 text-cyan-700',
}

function ToolCard({ tool, onFork }: { tool: Tool; onFork: () => void }) {
  const [forking, setForking] = useState(false)
  const [forked, setForked] = useState(false)

  const handleFork = async () => {
    setForking(true)
    try {
      await toolsApi.fork(tool.id)
      setForked(true)
    } catch {
      alert('Fork 失败，请重试')
    } finally {
      setForking(false)
    }
    onFork()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{tool.name}</span>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', INVOKE_TYPE_COLORS[tool.invoke_type] || 'bg-gray-100 text-gray-600')}>
              {tool.invoke_type}
            </span>
          </div>
          {tool.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{tool.description}</p>
          )}
        </div>
        <Wrench size={16} className="text-gray-400 shrink-0 mt-0.5" />
      </div>

      {tool.tags && tool.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tool.tags.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-400">v{tool.version}</span>
        <button
          onClick={handleFork}
          disabled={forking || forked || tool.fork_policy === 'readonly'}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors',
            forked
              ? 'bg-green-50 text-green-700 cursor-default'
              : tool.fork_policy === 'readonly'
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'bg-brand-50 hover:bg-brand-100 text-brand-700'
          )}
        >
          <GitFork size={11} />
          {forked ? '已 Fork' : forking ? 'Fork 中...' : tool.fork_policy === 'readonly' ? '不可 Fork' : 'Fork'}
        </button>
      </div>
    </div>
  )
}

function ExecutorCard({ executor, onFork }: { executor: Executor; onFork: () => void }) {
  const [forking, setForking] = useState(false)
  const [forked, setForked] = useState(false)

  const handleFork = async () => {
    setForking(true)
    try {
      await executorsApi.fork(executor.id)
      setForked(true)
    } catch {
      alert('Fork 失败，请重试')
    } finally {
      setForking(false)
    }
    onFork()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{executor.name}</span>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', EXECUTOR_TYPE_COLORS[executor.executor_type] || 'bg-gray-100 text-gray-600')}>
              {executor.executor_type}
            </span>
          </div>
          {executor.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{executor.description}</p>
          )}
        </div>
        <GitBranch size={16} className="text-gray-400 shrink-0 mt-0.5" />
      </div>

      {executor.tags && executor.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {executor.tags.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-400">v{executor.version}</span>
        <button
          onClick={handleFork}
          disabled={forking || forked}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors',
            forked
              ? 'bg-green-50 text-green-700 cursor-default'
              : 'bg-brand-50 hover:bg-brand-100 text-brand-700'
          )}
        >
          <GitFork size={11} />
          {forked ? '已 Fork' : forking ? 'Fork 中...' : 'Fork'}
        </button>
      </div>
    </div>
  )
}

export function MarketplacePage() {
  const [tab, setTab] = useState<Tab>('tools')
  const [tools, setTools] = useState<Tool[]>([])
  const [executors, setExecutors] = useState<Executor[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [ts, es] = await Promise.all([
        toolsApi.list({ visibility: 'public', size: 50 }),
        executorsApi.list({ visibility: 'public', size: 50 } as Parameters<typeof executorsApi.list>[0]),
      ])
      setTools(ts)
      setExecutors(es as Executor[])
    } catch {
      setTools([])
      setExecutors([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredTools = tools.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  )
  const filteredExecutors = executors.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Store size={22} className="text-brand-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">资产市场</h1>
            <p className="text-sm text-gray-500 mt-0.5">浏览公开的工具和执行器，一键 Fork 到你的工作区</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索名称或描述..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          {(['tools', 'executors'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2 text-sm font-medium transition-colors',
                tab === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {t === 'tools' ? `工具 (${tools.length})` : `执行器 (${executors.length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-16">加载公开资产中...</div>
      ) : (
        <>
          {tab === 'tools' && (
            filteredTools.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTools.map(tool => (
                  <ToolCard key={tool.id} tool={tool} onFork={load} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Store size={40} className="mx-auto mb-3 opacity-30" />
                <div className="text-sm">
                  {search ? `没有匹配「${search}」的公开工具` : '暂无公开工具'}
                </div>
                <div className="text-xs mt-1">将工具可见性设为「公开」即可出现在市场</div>
              </div>
            )
          )}

          {tab === 'executors' && (
            filteredExecutors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExecutors.map(ex => (
                  <ExecutorCard key={ex.id} executor={ex} onFork={load} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Store size={40} className="mx-auto mb-3 opacity-30" />
                <div className="text-sm">
                  {search ? `没有匹配「${search}」的公开执行器` : '暂无公开执行器'}
                </div>
                <div className="text-xs mt-1">将执行器可见性设为「公开」即可出现在市场</div>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
