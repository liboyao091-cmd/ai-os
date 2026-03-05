import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, CheckCircle, XCircle, Clock, ChevronRight, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { executorsApi } from '../../api/executors'
import { ExecutorRunResponse, StepLog } from '../../types/executor'
import { runsApi } from '../../api/runs'
import clsx from 'clsx'

interface SandboxPanelProps {
  executorId: string
}

const TERMINAL = new Set(['success', 'failed', 'cancelled'])

export function SandboxPanel({ executorId }: SandboxPanelProps) {
  const navigate = useNavigate()
  const [inputJson, setInputJson] = useState('{}')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ExecutorRunResponse | null>(null)
  const [selectedStep, setSelectedStep] = useState<StepLog | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [jsonError, setJsonError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = useCallback((runId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const updated = await runsApi.get(runId)
        const mapped: ExecutorRunResponse = {
          run_id: updated.id, status: updated.status, output: updated.output,
          steps_log: updated.steps_log, total_tokens: updated.total_tokens,
          duration_ms: updated.duration_ms, error_message: updated.error_message,
        }
        setResult(mapped)
        if (TERMINAL.has(updated.status)) { stopPolling(); setRunning(false) }
        else if (updated.status === 'waiting_confirm') { stopPolling() }
      } catch { stopPolling(); setRunning(false) }
    }, 1200)
  }, [stopPolling])

  const handleRun = async () => {
    setJsonError('')
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(inputJson) } catch {
      setJsonError('JSON 格式错误，请检查输入'); return
    }
    setRunning(true); setResult(null); setSelectedStep(null); stopPolling()
    try {
      const res = await executorsApi.sandbox(executorId, input)
      setResult(res)
      if (!res.run_id || TERMINAL.has(res.status) || res.status === 'waiting_confirm') {
        setRunning(false)
      } else {
        startPolling(res.run_id)
      }
    } catch (e: unknown) {
      setResult({ run_id: '', status: 'failed', steps_log: [], total_tokens: 0,
        error_message: e instanceof Error ? e.message : String(e) })
      setRunning(false)
    }
  }

  const handleConfirm = async (confirmed: boolean) => {
    if (!result?.run_id) return
    setConfirming(true)
    try {
      const res = await executorsApi.confirm(executorId, result.run_id, confirmed)
      setResult(res)
      if (res.run_id && !TERMINAL.has(res.status)) { setRunning(true); startPolling(res.run_id) }
    } catch (e: unknown) {
      setResult(r => r ? { ...r, status: 'failed', error_message: e instanceof Error ? e.message : String(e) } : r)
    } finally { setConfirming(false) }
  }

  const statusColor = (s: string) =>
    ({ success: 'text-green-600', failed: 'text-red-600', cancelled: 'text-gray-500',
       running: 'text-blue-600', waiting_confirm: 'text-yellow-600' }[s] || '')

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="p-4 border-b bg-white shrink-0">
        <div className="text-sm font-medium text-gray-700 mb-1">输入参数 (JSON)</div>
        <textarea
          value={inputJson}
          onChange={e => { setInputJson(e.target.value); setJsonError('') }}
          rows={4}
          className={clsx('w-full font-mono text-xs border rounded-md p-2 outline-none focus:ring-2 focus:ring-brand-500 resize-none',
            jsonError ? 'border-red-400' : 'border-gray-300')}
          placeholder="{}"
        />
        {jsonError && <div className="text-xs text-red-500 mt-1">{jsonError}</div>}
        <button onClick={handleRun} disabled={running}
          className={clsx('mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium',
            running ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white')}>
          <Play size={14} />{running ? '运行中...' : '▶ 运行测试'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {!result && !running && <div className="text-xs text-gray-400 text-center pt-8">点击「运行测试」查看结果</div>}

        {result && <>
          <div className="flex items-center gap-2">
            {result.status === 'success' && <CheckCircle size={15} className="text-green-500" />}
            {result.status === 'failed' && <XCircle size={15} className="text-red-500" />}
            {result.status === 'running' && <Clock size={15} className="text-blue-500 animate-spin" />}
            {result.status === 'waiting_confirm' && <Clock size={15} className="text-yellow-500" />}
            {result.status === 'cancelled' && <XCircle size={15} className="text-gray-400" />}
            <span className={clsx('text-sm font-medium', statusColor(result.status))}>{result.status}</span>
            {result.total_tokens > 0 && <span className="ml-auto text-xs text-gray-400">{result.total_tokens} tokens</span>}
            {result.duration_ms && <span className="text-xs text-gray-400">{result.duration_ms}ms</span>}
          </div>

          {result.status === 'waiting_confirm' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm font-semibold text-yellow-800 mb-1">需要人工确认</div>
              <div className="text-xs text-yellow-700 mb-3 whitespace-pre-wrap">
                {(result.output as Record<string, unknown>)?.confirm_message as string}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleConfirm(true)} disabled={confirming}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md disabled:opacity-50 font-medium">
                  {confirming ? '处理中...' : '✓ 确认'}
                </button>
                <button onClick={() => handleConfirm(false)} disabled={confirming}
                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-md disabled:opacity-50 font-medium">
                  ✕ 拒绝
                </button>
              </div>
            </div>
          )}

          {result.steps_log.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                执行步骤 ({result.steps_log.length})
              </div>
              <div className="flex flex-col gap-1">
                {result.steps_log.map((step, i) => (
                  <button key={i} onClick={() => setSelectedStep(step === selectedStep ? null : step)}
                    className={clsx('flex items-center gap-2 p-2 rounded-md text-left text-xs border transition-colors',
                      selectedStep === step ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                    <CheckCircle size={11} className="text-green-500 shrink-0" />
                    <span className="font-medium truncate">{step.name || step.step_id || `步骤 ${i+1}`}</span>
                    <span className="text-gray-400 shrink-0">({step.type})</span>
                    {step.duration_ms != null && <span className="ml-auto text-gray-400 shrink-0">{step.duration_ms}ms</span>}
                    <ChevronRight size={11} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedStep && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">{selectedStep.name || selectedStep.step_id} — {selectedStep.type}</div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-28">{JSON.stringify(selectedStep.output, null, 2)}</pre>
            </div>
          )}

          {result.status === 'success' && result.output != null && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">最终输出</div>
              <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-40">
                {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}

          {result.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-red-700 mb-1">错误</div>
              <div className="text-xs text-red-600 break-words">{result.error_message}</div>
            </div>
          )}

          {result.run_id && TERMINAL.has(result.status) && (
            <button onClick={() => navigate(`/runs/${result.run_id}/replay`)}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-1">
              <ExternalLink size={11} /> 查看完整回放
            </button>
          )}
        </>}
      </div>
    </div>
  )
}
