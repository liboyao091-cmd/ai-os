import { Search, User } from 'lucide-react'

export function TopBar() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1 flex items-center gap-2 max-w-md">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          placeholder="搜索工具、执行器、编排器..."
          className="w-full text-sm outline-none text-gray-600 placeholder-gray-400"
        />
      </div>
      <div className="flex items-center gap-2 text-gray-600">
        <User size={20} />
        <span className="text-sm">dev-user</span>
      </div>
    </header>
  )
}
