import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import { runsApi } from '../../api/runs'
import { ExecutionRun } from '../../types/run'
import { StepLog } from '../../types/executor'

export function ReplayPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<ExecutionRun | null>(null)
  const [selectedStep, setSelectedStep] = useState<StepLog | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [scoring, setScoring] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return
    runsApi.get(runId).then(r => { setRun(r); setLoading(false) }).catch(() => setLoading(false))
  }, [runId])

  const handleScore = async () => {
    if (!runId) return
    setScoring(true)
    try {
      await runsApi.score(runId, scores)
    } finally {
      setScoring(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">加载中...</div>
  if (!run) return <div className="p-6 text-red-500">Run not found</div>

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 flex items-center gap-4">
          <span className="font-semibold text-gray-900">执行回放</span>
          <span className="text-sm text-gray-500">{run.id}</span>
          <StatusBadge status={run.status} />
          <span className="text-xs text-gray-400">{run.steps_log.length} 步骤</span>
          <span className="text-xs text-gray-400">{run.total_tokens} tokens</span>
          {run.duration_ms && <span className="text-xs text-gray-400">{run.duration_ms}ms</span>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Step timeline */}
        <div className="w-64 border-r bg-white overflow-y-auto p-4 flex flex-col gap-2 shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">步骤时间轴</div>
          {run.steps_log.map((step, i) => (
            <button
              key={i}
              onClick={() => setSelectedStep(step === selectedStep ? null : step)}
              className={`flex items-center gap-2 p-2 rounded-md text-left text-xs transition-colors border ${
                selectedStep === step
                  ? 'bg-brand-50 border-brand-200'
                  : 'bg-white border-gray-100 hover:bg-gray-50'
              }`}
            >
              <CheckCircle size={12} className="text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{step.name || step.step_id || `Step ${i + 1}`}</div>
                <div className="text-gray-400">{step.type}</div>
              </div>
              {step.duration_ms && <span className="text-gray-400 shrink-0">{step.duration_ms}ms</span>}
            </button>
          ))}
          {run.steps_log.length === 0 && (
            <div className="text-xs text-gray-400">没有步骤记录</div>
          )}
        </div>

        {/* Step detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedStep ? (
            <div className="max-w-2xl flex flex-col gap-4">
              <h2 className="font-semibold text-gray-900">
                {selectedStep.name || selectedStep.step_id || '步骤详情'}
                <span className="ml-2 text-sm text-gray-400 font-normal">({selectedStep.type})</span>
              </h2>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">输入</div>
                <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto">
                  {JSON.stringify(selectedStep.input, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">输出</div>
                <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto">
                  {JSON.stringify(selectedStep.output, null, 2)}
                </pre>
              </div>
              {selectedStep.tokens !== undefined && selectedStep.tokens > 0 && (
                <div className="text-xs text-gray-400">{selectedStep.tokens} tokens</div>
              )}
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-1">输入</div>
                <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-48">
                  {JSON.stringify(run.input, null, 2)}
                </pre>
              </div>
              {run.output && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">最终输出</div>
                  <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(run.output, null, 2)}
                  </pre>
                </div>
              )}
              {run.error_message && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  {run.error_message}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-4">← 点击左侧步骤查看详情</div>
            </div>
          )}
        </div>

        {/* Right: scoring */}
        <div className="w-64 border-l bg-white p-4 shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">全局 State</div>
          {selectedStep?.state_after ? (
            <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-48 mb-4">
              {JSON.stringify(selectedStep.state_after, null, 2)}
            </pre>
          ) : (
            <div className="text-xs text-gray-400 mb-4">选择步骤查看 state</div>
          )}

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">人工打分</div>
          {['accuracy', 'format', 'usefulness'].map(metric => (
            <div key={metric} className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 capitalize">{metric}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setScores(s => ({ ...s, [metric]: star }))}
                    className={`text-sm ${star <= (scores[metric] || 0) ? 'text-yellow-400' : 'text-gray-200'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleScore}
            disabled={scoring || Object.keys(scores).length === 0}
            className="w-full mt-2 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50"
          >
            提交评分
          </button>
          {Object.keys(run.human_scores || {}).length > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              已评: {JSON.stringify(run.human_scores)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'text-green-600 bg-green-50',
    failed: 'text-red-600 bg-red-50',
    running: 'text-blue-600 bg-blue-50',
    cancelled: 'text-gray-600 bg-gray-100',
    waiting_confirm: 'text-yellow-600 bg-yellow-50',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || ''}`}>
      {status}
    </span>
  )
}
