import { Copy, Edit, GitFork } from 'lucide-react'
import clsx from 'clsx'

interface AssetCardProps {
  name: string
  description?: string
  tags?: string[]
  type?: string
  visibility?: string
  isOwner?: boolean
  onEdit?: () => void
  onFork?: () => void
  onUse?: () => void
  badge?: string
  badgeColor?: string
}

const visibilityColors: Record<string, string> = {
  private: 'bg-gray-100 text-gray-600',
  team: 'bg-blue-100 text-blue-700',
  public: 'bg-green-100 text-green-700',
}

export function AssetCard({
  name, description, tags, type, visibility, isOwner, onEdit, onFork, onUse, badge, badgeColor,
}: AssetCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{name}</span>
            {type && (
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', badgeColor || 'bg-purple-100 text-purple-700')}>
                {badge || type}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{description}</p>
          )}
        </div>
        {visibility && (
          <span className={clsx('text-xs px-2 py-0.5 rounded-full shrink-0', visibilityColors[visibility] || visibilityColors.private)}>
            {visibility}
          </span>
        )}
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-gray-100">
        {onUse && (
          <button onClick={onUse} className="flex-1 text-xs py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors">
            使用
          </button>
        )}
        {isOwner && onEdit && (
          <button onClick={onEdit} className="flex items-center gap-1 text-xs py-1 px-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            <Edit size={12} /> 编辑
          </button>
        )}
        {onFork && (
          <button onClick={onFork} className="flex items-center gap-1 text-xs py-1 px-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            <GitFork size={12} /> Fork
          </button>
        )}
      </div>
    </div>
  )
}
