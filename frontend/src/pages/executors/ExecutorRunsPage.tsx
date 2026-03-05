import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Activity, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { executorsApi } from '../../api/executors'
import { Executor, ExecutorRunResponse } from '../../types/executor'

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  running:         { label: '运行中',   icon: <Activity size={13} />,    color: 'text-blue-500 bg-blue-50' },
  waiting_confirm: { label: '等待确认', icon: <AlertCircle size={13} />, color: 'text-yellow-600 bg-yellow-50' },
  success:         { label: '成功',     icon: <CheckCircle size={13} />, color: 'text-green-600 bg-green-50' },
  failed:          { label: '失败',     icon: <XCircle size={13} />,     color: 'text-red-500 bg-red-50' },
  cancelled:       { label: '已取消',   icon: <XCircle size={13} />,     color: 'text-gray-400 bg-gray-50' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, icon: null, color: 'text-gray-500 bg-gray-50' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  )
}

function dur(ms?: number): string {
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
  return new Date(iso).toLocaleString('zh-CN')
}

export function ExecutorRunsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [executor, setExecutor] = useState<Executor | null>(null)
  const [runs, setRuns] = useState<ExecutorRunResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedRun, setSelectedRun] = useState<ExecutorRunResponse | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [ex, rs] = await Promise.all([
        executorsApi.get(id),
        executorsApi.runs(id, { status: statusFilter || undefined, page, size: 20 }),
      ])
      setExecutor(ex)
      setRuns(rs)
    } finally {
      setLoading(false)
    }
  }, [id, statusFilter, page])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (run: ExecutorRunResponse, confirmed: boolean) => {
    if (!id) return
    try {
      await executorsApi.confirm(id, run.run_id, confirmed)
      load()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left: run list */}
      <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col">
        <div className="px-4 py-3 border-b">
          <button
            onClick={() => navigate(`/executors/${id}`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft size={14} /> 返回编辑器
          </button>
          <h2 className="font-semibold text-gray-900 text-sm truncate" title={executor?.name}>
            {executor?.name ?? '…'} — 运行历史
          </h2>
        </div>

        {/* Filter + refresh */}
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <select
            className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="p-1 text-gray-400 hover:text-gray-700 rounded"
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Run list */}
        <div className="flex-1 overflow-y-auto">
          {loading && runs.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-xs">加载中…</div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-300">
              <Clock size={32} className="mb-2" />
              <span className="text-xs">暂无运行记录</span>
            </div>
          ) : (
            runs.map(run => (
              <button
                key={run.run_id}
                className={`w-full text-left px-4 py-3 border-b hover:bg-blue-50 transition-colors ${selectedRun?.run_id === run.run_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                onClick={() => setSelectedRun(run)}
              >
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge status={run.status} />
                  <span className={`text-xs px-1.5 py-0.5 rounded ${run.is_sandbox ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                    {run.is_sandbox ? '沙盒' : '正式'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                  <span className="font-mono">{run.run_id.slice(0, 8)}…</span>
                  <span>{timeAgo(run.started_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <span>{dur(run.duration_ms)}</span>
                  <span>{run.total_tokens > 0 ? `${run.total_tokens.toLocaleString()} tokens` : ''}</span>
                  <span>{run.steps_log?.length ?? 0} 步</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="px-3 py-2 border-t flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-900"
          >
            上一页
          </button>
          <span className="text-xs text-gray-400">第 {page} 页</span>
          <button
            disabled={runs.length < 20}
            onClick={() => setPage(p => p + 1)}
            className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-900"
          >
            下一页
          </button>
        </div>
      </div>

      {/* Right: run detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedRun ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <Activity size={48} className="mb-3" />
            <p className="text-sm">选择左侧记录查看详情</p>
          </div>
        ) : (
          <div className="p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <StatusBadge status={selectedRun.status} />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selectedRun.is_sandbox ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedRun.is_sandbox ? '沙盒测试' : '正式运行'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono">{selectedRun.run_id}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>开始：{new Date(selectedRun.started_at).toLocaleString('zh-CN')}</p>
                {selectedRun.finished_at && (
                  <p>结束：{new Date(selectedRun.finished_at).toLocaleString('zh-CN')}</p>
                )}
                <p>耗时：{dur(selectedRun.duration_ms)} · {selectedRun.total_tokens} tokens</p>
              </div>
            </div>

            {/* Human confirm actions */}
            {selectedRun.status === 'waiting_confirm' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">等待人工确认</p>
                  <p className="text-xs text-yellow-600 mt-0.5">步骤 {selectedRun.paused_step_id} 需要确认后继续执行</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(selectedRun, false)}
                    className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    拒绝
                  </button>
                  <button
                    onClick={() => handleConfirm(selectedRun, true)}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    批准
                  </button>
                </div>
              </div>
            )}

            {/* Error message */}
            {selectedRun.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-medium text-red-700 mb-1">错误信息</p>
                <p className="text-xs text-red-600 font-mono whitespace-pre-wrap">{selectedRun.error_message}</p>
              </div>
            )}

            {/* Input / Output */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white border rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">输入</p>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify(selectedRun.input, null, 2)}
                </pre>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">输出</p>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap">
                  {selectedRun.output ? JSON.stringify(selectedRun.output, null, 2) : <span className="text-gray-300">暂无</span>}
                </pre>
              </div>
            </div>

            {/* Steps log */}
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-medium text-gray-700">执行步骤（{selectedRun.steps_log?.length ?? 0} 步）</p>
              </div>
              {!selectedRun.steps_log || selectedRun.steps_log.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-300 text-xs">暂无步骤记录</div>
              ) : (
                <div className="divide-y">
                  {selectedRun.steps_log.map((step, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">#{i + 1}</span>
                          <span className="text-xs font-medium text-gray-800">{step.step_id}</span>
                          <span className="text-xs text-gray-400">{step.step_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {step.tokens_used > 0 && (
                            <span className="text-xs text-gray-400">{step.tokens_used} tokens</span>
                          )}
                          {step.duration_ms && (
                            <span className="text-xs text-gray-400">{dur(step.duration_ms)}</span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${step.status === 'success' ? 'bg-green-50 text-green-600' : step.status === 'failed' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'}`}>
                            {step.status}
                          </span>
                        </div>
                      </div>
                      {step.error && (
                        <p className="text-xs text-red-500 font-mono mt-1">{step.error}</p>
                      )}
                      {step.output !== undefined && step.output !== null && (
                        <pre className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1 overflow-x-auto max-h-24 whitespace-pre-wrap">
                          {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Link to full replay */}
            <div className="mt-4 text-center">
              <Link
                to={`/runs/${selectedRun.run_id}/replay`}
                className="text-sm text-blue-600 hover:underline"
              >
                查看完整回放 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
