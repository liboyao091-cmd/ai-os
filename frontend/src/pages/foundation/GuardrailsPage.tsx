import { Settings } from 'lucide-react'

export function GuardrailsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">约束规则</h1>
      <p className="text-sm text-gray-500">配置输入/输出/执行约束，控制 token 预算与最大步骤数</p>
      <div className="mt-8 flex flex-col items-center text-gray-300">
        <Settings size={48} className="mb-3" />
        <span className="text-sm">约束规则管理 — 即将推出</span>
      </div>
    </div>
  )
}
