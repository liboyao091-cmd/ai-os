import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, GitFork, X } from 'lucide-react'
import { apiClient } from '../../api/client'
import clsx from 'clsx'

interface ModelPolicy {
  id: string; owner_id: string; name: string; visibility: string
  default_model: string; routing_rules: object[]; fallback_chain: string[]
  monthly_token_budget: number; params_override: object; created_at: string
}

const DEFAULT_FORM = {
  name: '', visibility: 'private', default_model: 'doubao-pro-32k-241215',
  routing_rules: '[]', fallback_chain: 'doubao-pro-32k-241215',
  monthly_token_budget: 1000000, params_override: '{}',
}

function PolicyModal({ policy, onClose, onSaved }: { policy?: ModelPolicy; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: policy?.name || '', visibility: policy?.visibility || 'private',
    default_model: policy?.default_model || 'doubao-pro-32k-241215',
    routing_rules: JSON.stringify(policy?.routing_rules || [], null, 2),
    fallback_chain: (policy?.fallback_chain || ['doubao-pro-32k-241215']).join(','),
    monthly_token_budget: policy?.monthly_token_budget || 1000000,
    params_override: JSON.stringify(policy?.params_override || {}, null, 2),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name, visibility: form.visibility,
        default_model: form.default_model,
        routing_rules: JSON.parse(form.routing_rules),
        fallback_chain: form.fallback_chain.split(',').map(s => s.trim()).filter(Boolean),
        monthly_token_budget: Number(form.monthly_token_budget),
        params_override: JSON.parse(form.params_override),
      }
      if (policy) { await apiClient.put(`/api/model-policies/${policy.id}`, payload) }
      else { await apiClient.post('/api/model-policies', payload) }
      onSaved(); onClose()
    } catch (e: unknown) { setError(String(e)) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[560px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{policy ? '编辑模型策略' : '新建模型策略'}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">名称 *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">可见性</label>
              <select value={form.visibility} onChange={e => setForm(f => ({...f, visibility: e.target.value}))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none">
                <option value="private">私有</option><option value="team">团队</option><option value="public">公开</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">默认模型</label>
            <input value={form.default_model} onChange={e => setForm(f => ({...f, default_model: e.target.value}))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Fallback 链（逗号分隔）</label>
            <input value={form.fallback_chain} onChange={e => setForm(f => ({...f, fallback_chain: e.target.value}))}
              placeholder="doubao-pro-32k-241215, doubao-lite-32k"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">月 Token 预算</label>
            <input type="number" value={form.monthly_token_budget}
              onChange={e => setForm(f => ({...f, monthly_token_budget: Number(e.target.value)}))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">路由规则 (JSON array)</label>
            <textarea value={form.routing_rules} onChange={e => setForm(f => ({...f, routing_rules: e.target.value}))}
              rows={4} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono outline-none resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">参数覆盖 (JSON)</label>
            <textarea value={form.params_override} onChange={e => setForm(f => ({...f, params_override: e.target.value}))}
              rows={3} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono outline-none resize-none" />
          </div>
          {error && <div className="text-xs text-red-500">{error}</div>}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">取消</button>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ModelsPage() {
  const [policies, setPolicies] = useState<ModelPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; policy?: ModelPolicy }>({ open: false })

  const load = () => apiClient.get('/api/model-policies').then(r => { setPolicies(r.data); setLoading(false) })
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除？')) return
    await apiClient.delete(`/api/model-policies/${id}`)
    setPolicies(p => p.filter(x => x.id !== id))
  }
  const handleFork = async (id: string) => {
    await apiClient.post(`/api/model-policies/${id}/fork`)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">模型策略</h1>
          <p className="text-sm text-gray-500 mt-0.5">配置模型路由规则、fallback 链、token 预算</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-md">
          <Plus size={16} /> 新建策略
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-500">加载中...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <span className="font-semibold text-gray-900">{p.name}</span>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                  p.visibility === 'public' ? 'bg-green-100 text-green-700' :
                  p.visibility === 'team' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                  {p.visibility}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono">{p.default_model}</div>
              <div className="text-xs text-gray-400">月预算: {p.monthly_token_budget.toLocaleString()} tokens</div>
              {p.fallback_chain?.length > 0 && (
                <div className="text-xs text-gray-400 truncate">Fallback: {p.fallback_chain.join(' → ')}</div>
              )}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => setModal({ open: true, policy: p })}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">
                  <Edit2 size={12} /> 编辑
                </button>
                <button onClick={() => handleFork(p.id)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">
                  <GitFork size={12} /> Fork
                </button>
                <button onClick={() => handleDelete(p.id)}
                  className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded ml-auto">
                  <Trash2 size={12} /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {policies.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">暂无模型策略，点击「新建策略」开始</div>
      )}

      {modal.open && (
        <PolicyModal policy={modal.policy} onClose={() => setModal({ open: false })} onSaved={load} />
      )}
    </div>
  )
}
