import { useState, useEffect, useRef } from 'react'
import { Play, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react'
import { executorsApi } from '../../api/executors'
import { ExecutorRunResponse, StepLog } from '../../types/executor'
import { runsApi } from '../../api/runs'
import clsx from 'clsx'

interface SandboxPanelProps {
  executorId: string
  inputSchema?: Record<string, unknown>
}

export function SandboxPanel({ executorId, inputSchema }: SandboxPanelProps) {
  const [inputJson, setInputJson] = useState('{}')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ExecutorRunResponse | null>(null)
  const [selectedStep, setSelectedStep] = useState<StepLog | null>(null)
  const [confirming, setConfirming] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleRun = async () => {
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(inputJson) } catch { alert('Invalid JSON input'); return }
    setRunning(true)
    setResult(null)
    setSelectedStep(null)
    try {
      const res = await executorsApi.sandbox(executorId, input)
      setResult(res)
      if (res.status === 'running' || res.status === 'waiting_confirm') {
        // Poll
        pollRef.current = setInterval(async () => {
          const updated = await runsApi.get(res.run_id)
          const mapped: ExecutorRunResponse = {
            run_id: updated.id,
            status: updated.status,
            output: updated.output,
            steps_log: updated.steps_log,
            total_tokens: updated.total_tokens,
            duration_ms: updated.duration_ms,
            error_message: updated.error_message,
          }
          setResult(mapped)
          if (['success', 'failed', 'cancelled', 'waiting_confirm'].includes(updated.status)) {
            if (pollRef.current) clearInterval(pollRef.current)
            if (updated.status !== 'waiting_confirm') setRunning(false)
          }
        }, 1000)
      } else {
        setRunning(false)
      }
    } catch (e: unknown) {
      setResult({ run_id: '', status: 'failed', steps_log: [], total_tokens: 0, error_message: String(e) })
      setRunning(false)
    }
  }

  const handleConfirm = async (confirmed: boolean) => {
    if (!result?.run_id) return
    setConfirming(true)
    try {
      const res = await executorsApi.confirm(executorId, result.run_id, confirmed)
      setResult(res)
    } finally {
      setConfirming(false)
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="text-sm font-medium text-gray-700 mb-2">输入参数 (JSON)</div>
        <textarea
          value={inputJson}
          onChange={e => setInputJson(e.target.value)}
          rows={5}
          className="w-full font-mono text-xs border border-gray-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="{}"
        />
        <button
          onClick={handleRun}
          disabled={running}
          className={clsx(
            'mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            running
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-brand-600 hover:bg-brand-700 text-white'
          )}
        >
          <Play size={14} /> {running ? '运行中...' : '▶ 运行测试'}
        </button>
      </div>

      {result && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Status */}
          <div className="flex items-center gap-2">
            {result.status === 'success' && <CheckCircle size={16} className="text-green-500" />}
            {result.status === 'failed' && <XCircle size={16} className="text-red-500" />}
            {(result.status === 'running' || result.status === 'waiting_confirm') && (
              <Clock size={16} className="text-yellow-500 animate-spin" />
            )}
            <span className={clsx('text-sm font-medium', {
              'text-green-600': result.status === 'success',
              'text-red-600': result.status === 'failed',
              'text-yellow-600': result.status === 'waiting_confirm',
            })}>
              {result.status}
            </span>
            {result.total_tokens > 0 && (
              <span className="text-xs text-gray-400 ml-auto">{result.total_tokens} tokens</span>
            )}
          </div>

          {/* Human confirm */}
          {result.status === 'waiting_confirm' && result.output && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm font-medium text-yellow-800 mb-1">需要人工确认</div>
              <div className="text-xs text-yellow-700 mb-3">
                {(result.output as Record<string, unknown>)?.confirm_message as string}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={confirming}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md"
                >
                  确认
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={confirming}
                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-md"
                >
                  拒绝
                </button>
              </div>
            </div>
          )}

          {/* Steps log */}
          {result.steps_log.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">执行步骤</div>
              <div className="flex flex-col gap-1">
                {result.steps_log.map((step, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedStep(step === selectedStep ? null : step)}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded-md text-left text-xs transition-colors',
                      selectedStep === step ? 'bg-brand-50 border border-brand-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <CheckCircle size={12} className="text-green-500 shrink-0" />
                    <span className="font-medium">{step.name || step.step_id || `步骤 ${i + 1}`}</span>
                    <span className="text-gray-400">({step.type})</span>
                    {step.duration_ms && <span className="ml-auto text-gray-400">{step.duration_ms}ms</span>}
                    <ChevronRight size={12} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step detail */}
          {selectedStep && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">步骤详情</div>
              <div className="text-xs text-gray-500 mb-1">输出:</div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(selectedStep.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Final output */}
          {result.status === 'success' && result.output && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">最终输出</div>
              <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-40">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {result.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs text-red-700">{result.error_message}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
