import { Network } from 'lucide-react'

export function OrchestratorListPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">编排器</h1>
      <p className="text-sm text-gray-500">Phase 3 实现：画布式多执行器编排、意图路由、规则路由</p>
      <div className="mt-8 flex flex-col items-center text-gray-300">
        <Network size={48} className="mb-3" />
        <span className="text-sm">编排画布 — 即将推出</span>
      </div>
    </div>
  )
}
