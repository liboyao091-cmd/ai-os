import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Filter } from 'lucide-react'
import { apiClient } from '../../api/client'
import { ExecutionRun } from '../../types/run'

interface RunsFilter {
  status: string
  is_sandbox: string
  page: number
}

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  running: { label: '运行中', icon: <Activity size={14} />, color: 'text-blue-500 bg-blue-50' },
  waiting_confirm: { label: '等待确认', icon: <AlertCircle size={14} />, color: 'text-yellow-600 bg-yellow-50' },
  success: { label: '成功', icon: <CheckCircle size={14} />, color: 'text-green-600 bg-green-50' },
  failed: { label: '失败', icon: <XCircle size={14} />, color: 'text-red-500 bg-red-50' },
  cancelled: { label: '已取消', icon: <XCircle size={14} />, color: 'text-gray-400 bg-gray-50' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, icon: null, color: 'text-gray-500 bg-gray-50' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  )
}

function duration(ms?: number): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

export function RunsPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<ExecutionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<RunsFilter>({ status: '', is_sandbox: '', page: 1 })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (f: RunsFilter) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: f.page, size: 20 }
      if (f.status) params.status = f.status
      if (f.is_sandbox === 'true') params.is_sandbox = 'true'
      if (f.is_sandbox === 'false') params.is_sandbox = 'false'
      const res = await apiClient.get<{ items: ExecutionRun[]; total: number }>('/runs', { params })
      // Handle both array response and paginated response
      if (Array.isArray(res.data)) {
        setRuns(res.data as ExecutionRun[])
        setTotal((res.data as ExecutionRun[]).length)
      } else {
        setRuns(res.data.items || [])
        setTotal(res.data.total || 0)
      }
    } catch {
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filter)
    // Auto-refresh every 10s for active runs
    timerRef.current = setInterval(() => load(filter), 10000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [filter, load])

  const hasMore = runs.length + (filter.page - 1) * 20 < total

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">历史运行</h1>
          <p className="text-sm text-gray-500 mt-0.5">查看所有执行记录，支持回放与分析</p>
        </div>
        <button
          onClick={() => load(filter)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <Filter size={14} className="text-gray-400" />
        <select
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value, page: 1 }))}
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filter.is_sandbox}
          onChange={e => setFilter(f => ({ ...f, is_sandbox: e.target.value, page: 1 }))}
        >
          <option value="">全部类型</option>
          <option value="false">正式运行</option>
          <option value="true">沙盒测试</option>
        </select>
        {(filter.status || filter.is_sandbox) && (
          <button
            onClick={() => setFilter({ status: '', is_sandbox: '', page: 1 })}
            className="text-xs text-blue-600 hover:underline"
          >
            清除筛选
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">共 {total} 条记录</span>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
              <th className="px-4 py-3 text-left">来源</th>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-right">Tokens</th>
              <th className="px-4 py-3 text-right">耗时</th>
              <th className="px-4 py-3 text-right">步骤</th>
              <th className="px-4 py-3 text-left">时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">加载中…</td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center text-gray-300">
                    <Clock size={40} className="mb-2" />
                    <span className="text-sm">暂无运行记录</span>
                  </div>
                </td>
              </tr>
            ) : (
              runs.map(run => (
                <tr
                  key={run.id}
                  className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (run.executor_id) navigate(`/executors/${run.executor_id}/runs/${run.id}`)
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400">
                        {run.executor_id ? '执行器' : run.orchestrator_id ? '编排器' : '未知'}
                      </span>
                      <span className="font-mono text-xs text-gray-500">
                        {(run.executor_id || run.orchestrator_id || run.id).slice(0, 8)}…
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${run.is_sandbox ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                      {run.is_sandbox ? '沙盒' : '正式'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {run.total_tokens > 0 ? run.total_tokens.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {duration(run.duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {run.steps_log?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {timeAgo(run.started_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {run.executor_id && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/executors/${run.executor_id}/runs/${run.id}`) }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        回放
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            disabled={filter.page <= 1}
            onClick={() => setFilter(f => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">第 {filter.page} 页</span>
          <button
            disabled={!hasMore}
            onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
