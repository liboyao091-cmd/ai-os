import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useExecutorStore } from '../../store/useExecutorStore'
import { AssetCard } from '../../components/shared/AssetCard'
import { ExecutorType } from '../../types/executor'

const TYPE_COLORS: Record<ExecutorType, string> = {
  workflow: 'bg-blue-100 text-blue-700',
  ai_workflow: 'bg-purple-100 text-purple-700',
  agent: 'bg-green-100 text-green-700',
  multi_agent: 'bg-teal-100 text-teal-700',
  copilot: 'bg-yellow-100 text-yellow-700',
}

const TYPE_LABELS: Record<ExecutorType, string> = {
  workflow: 'Workflow',
  ai_workflow: 'AI Workflow',
  agent: 'Agent',
  multi_agent: 'Multi-Agent',
  copilot: 'Copilot',
}

export function ExecutorListPage() {
  const navigate = useNavigate()
  const { executors, loading, fetchExecutors, forkExecutor } = useExecutorStore()
  const [typeFilter, setTypeFilter] = useState<string>('')

  useEffect(() => { fetchExecutors(typeFilter ? { executor_type: typeFilter } : undefined) }, [typeFilter])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">执行器</h1>
          <p className="text-sm text-gray-500 mt-0.5">配置和管理 AI 工作流执行单元</p>
        </div>
        <button
          onClick={() => navigate('/executors/new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-md"
        >
          <Plus size={16} /> 新建执行器
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'workflow', 'ai_workflow', 'agent', 'multi_agent', 'copilot'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              typeFilter === t
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t || '全部'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {executors.map(ex => (
            <AssetCard
              key={ex.id}
              name={ex.name}
              description={ex.description}
              tags={ex.tags}
              type={ex.executor_type}
              visibility={ex.visibility}
              isOwner={true}
              badge={TYPE_LABELS[ex.executor_type as ExecutorType]}
              badgeColor={TYPE_COLORS[ex.executor_type as ExecutorType]}
              onEdit={() => navigate(`/executors/${ex.id}`)}
              onFork={() => forkExecutor(ex.id)}
              onUse={() => navigate(`/executors/${ex.id}`)}
            />
          ))}
        </div>
      )}

      {executors.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          还没有执行器，点击「新建执行器」开始
        </div>
      )}
    </div>
  )
}
