import { NavLink } from 'react-router-dom'
import { Wrench, BookOpen, Cpu, GitBranch, Network, History, Settings, Store } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  {
    section: '底座层',
    items: [
      { label: '工具库', to: '/tools', icon: Wrench },
      { label: '知识库', to: '/knowledge', icon: BookOpen },
      { label: '模型策略', to: '/models', icon: Cpu },
      { label: '约束规则', to: '/guardrails', icon: Settings },
    ],
  },
  {
    section: '执行层',
    items: [{ label: '执行器', to: '/executors', icon: GitBranch }],
  },
  {
    section: '编排层',
    items: [{ label: '编排器', to: '/orchestrators', icon: Network }],
  },
  {
    section: '记录',
    items: [{ label: '历史运行', to: '/runs', icon: History }],
  },
  {
    section: '市场',
    items: [{ label: '资产市场', to: '/marketplace', icon: Store }],
  },
]

export function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-gray-200 flex flex-col py-4">
      <div className="px-4 mb-6">
        <span className="text-lg font-bold text-white tracking-wide">DS AI OS</span>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {nav.map(group => (
          <div key={group.section} className="mb-4">
            <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {group.section}
            </div>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-2 text-sm rounded-md mx-2 transition-colors',
                    isActive
                      ? 'bg-brand-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  )
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
