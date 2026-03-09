import { useEffect, useState } from 'react'
import { Plus, X, FolderOpen, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../store/useProjectStore'
import { projectsApi } from '../../api/projects'
import { ProjectCreate } from '../../types/project'

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<ProjectCreate>({
    name: '',
    description: '',
    local_path: '',
    tags: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      await projectsApi.create({
        ...form,
        local_path: form.local_path || undefined,
        description: form.description || undefined,
      })
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[520px] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">新建项目</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目名称 *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. 数据分析项目"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="项目描述（可选）"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联本地文件夹</label>
            <div className="flex gap-2">
              <input
                value={form.local_path}
                onChange={e => setForm(f => ({ ...f, local_path: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                placeholder="/Users/yourname/projects/my-project"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">填写本地文件夹的绝对路径，用于关联项目代码或数据</p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">取消</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name}
            className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50"
          >
            {saving ? '创建中...' : '创建项目'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const { projects, loading, fetchProjects, deleteProject } = useProjectStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">项目</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理项目并关联本地文件夹</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-md"
        >
          <Plus size={16} /> 新建项目
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen size={18} className="text-brand-600 shrink-0" />
                  <span className="font-medium text-gray-900 truncate">{project.name}</span>
                </div>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="text-gray-400 hover:text-red-500 shrink-0 ml-2"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {project.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{project.description}</p>
              )}
              {project.local_path && (
                <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2 py-1.5">
                  <FolderOpen size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs font-mono text-gray-600 truncate">{project.local_path}</span>
                </div>
              )}
              {!project.local_path && (
                <div className="text-xs text-gray-400 italic">未关联本地文件夹</div>
              )}
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {projects.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">还没有项目，点击「新建项目」开始</div>
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchProjects()}
        />
      )}
    </div>
  )
}
