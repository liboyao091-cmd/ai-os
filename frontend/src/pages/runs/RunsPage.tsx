import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api/client'
import { ExecutionRun } from '../../types/run'

export function RunsPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<ExecutionRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch recent runs across all executors
    // This is a workaround — in production we'd have a global /api/runs endpoint
    setLoading(false)
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">历史运行</h1>
      <p className="text-sm text-gray-500 mb-4">查看执行记录和回放</p>
      <div className="text-sm text-gray-400">
        在执行器页面运行后，点击「查看完整回放」查看详细记录。
      </div>
    </div>
  )
}
