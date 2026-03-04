import { Cpu } from 'lucide-react'

export function ModelsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">模型策略</h1>
      <p className="text-sm text-gray-500">配置模型路由、fallback 链、token 预算</p>
      <div className="mt-8 flex flex-col items-center text-gray-300">
        <Cpu size={48} className="mb-3" />
        <span className="text-sm">模型策略管理 — 即将推出</span>
      </div>
    </div>
  )
}
