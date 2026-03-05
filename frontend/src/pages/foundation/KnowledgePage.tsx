import { useState, useEffect, useRef } from 'react'
import { Plus, Upload, Trash2, FileText, Search, CheckCircle, Clock, XCircle, X } from 'lucide-react'
import { knowledgeApi, KnowledgeSpace, KnowledgeDocument } from '../../api/knowledge'
import clsx from 'clsx'

const STATUS_ICON = {
  pending:  <Clock size={13} className="text-gray-400 animate-pulse" />,
  indexing: <Clock size={13} className="text-blue-500 animate-spin" />,
  ready:    <CheckCircle size={13} className="text-green-500" />,
  failed:   <XCircle size={13} className="text-red-500" />,
}

// ─── Create Space Modal ──────────────────────────────────────────────────────
function CreateSpaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: KnowledgeSpace) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name) return
    setSaving(true)
    try {
      const space = await knowledgeApi.createSpace({ name, description: desc, visibility })
      onCreated(space)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-96">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">新建知识库</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="知识库名称 *"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-brand-500" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="描述（可选）" rows={2}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full outline-none resize-none" />
          <select value={visibility} onChange={e => setVisibility(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none">
            <option value="private">私有</option>
            <option value="team">团队</option>
            <option value="public">公开</option>
          </select>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">取消</button>
          <button onClick={handleSubmit} disabled={saving || !name}
            className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md disabled:opacity-50">
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Document list for a space ───────────────────────────────────────────────
function DocumentList({ space }: { space: KnowledgeSpace }) {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState<string[]>([])
  const [querying, setQuerying] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [showManual, setShowManual] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    const d = await knowledgeApi.listDocuments(space.id)
    setDocs(d)
    // Stop polling once all are terminal
    if (d.every(doc => doc.status === 'ready' || doc.status === 'failed')) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }

  useEffect(() => {
    load()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [space.id])

  const startPolling = () => {
    if (pollRef.current) return
    pollRef.current = setInterval(load, 2000)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name)
      fd.append('source_type', 'upload')
      await knowledgeApi.uploadDocument(space.id, fd)
      await load()
      startPolling()
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const handleManualUpload = async () => {
    if (!manualTitle || !manualContent) return
    setUploading(true)
    try {
      await knowledgeApi.uploadText(space.id, manualTitle, manualContent)
      setManualTitle(''); setManualContent(''); setShowManual(false)
      await load(); startPolling()
    } finally { setUploading(false) }
  }

  const handleDelete = async (docId: string) => {
    await knowledgeApi.deleteDocument(docId)
    setDocs(d => d.filter(x => x.id !== docId))
  }

  const handleQuery = async () => {
    if (!query.trim()) return
    setQuerying(true)
    try {
      const res = await knowledgeApi.querySpace(space.id, query)
      setQueryResult(res.results.map(r => r.content))
    } finally { setQuerying(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upload actions */}
      <div className="flex gap-2 flex-wrap">
        <label className={clsx('flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-md cursor-pointer',
          uploading && 'opacity-50 cursor-not-allowed')}>
          <Upload size={14} /> {uploading ? '上传中...' : '上传文件'}
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
        </label>
        <button onClick={() => setShowManual(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50">
          <Plus size={14} /> 手动输入
        </button>
      </div>

      {showManual && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
          <input value={manualTitle} onChange={e => setManualTitle(e.target.value)}
            placeholder="文档标题" className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full outline-none" />
          <textarea value={manualContent} onChange={e => setManualContent(e.target.value)}
            placeholder="文档内容..." rows={5}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full outline-none resize-none font-mono" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowManual(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded">取消</button>
            <button onClick={handleManualUpload} disabled={!manualTitle || !manualContent || uploading}
              className="px-3 py-1 text-xs bg-brand-600 text-white rounded disabled:opacity-50">保存</button>
          </div>
        </div>
      )}

      {/* Document list */}
      {docs.length === 0
        ? <div className="text-sm text-gray-400 py-4 text-center">还没有文档，点击上传开始</div>
        : <div className="flex flex-col gap-1">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <FileText size={15} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{doc.title || doc.id}</div>
                  <div className="text-xs text-gray-400">{doc.chunk_count} 块</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {STATUS_ICON[doc.status]}
                  {doc.status}
                </div>
                {doc.error_message && (
                  <div className="text-xs text-red-500 max-w-32 truncate" title={doc.error_message}>{doc.error_message}</div>
                )}
                <button onClick={() => handleDelete(doc.id)} className="text-gray-400 hover:text-red-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
      }

      {/* RAG query test */}
      <div className="border-t pt-4">
        <div className="text-sm font-medium text-gray-700 mb-2">RAG 检索测试</div>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
            placeholder="输入测试查询..." className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
          <button onClick={handleQuery} disabled={querying || !query.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-md disabled:opacity-50">
            <Search size={13} /> {querying ? '检索中...' : '检索'}
          </button>
        </div>
        {queryResult.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {queryResult.map((chunk, i) => (
              <div key={i} className="text-xs bg-blue-50 border border-blue-100 rounded p-2 text-gray-700">
                <span className="font-semibold text-blue-600 mr-1">[{i+1}]</span>{chunk.slice(0, 200)}{chunk.length > 200 ? '...' : ''}
              </div>
            ))}
          </div>
        )}
        {queryResult.length === 0 && query && !querying && (
          <div className="text-xs text-gray-400 mt-2">无匹配结果（知识库可能尚未完成索引）</div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export function KnowledgePage() {
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([])
  const [selected, setSelected] = useState<KnowledgeSpace | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    knowledgeApi.listSpaces().then(s => { setSpaces(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除知识库？将同时删除所有文档和向量数据')) return
    await knowledgeApi.deleteSpace(id)
    setSpaces(s => s.filter(x => x.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: space list */}
      <div className="w-64 border-r bg-white flex flex-col shrink-0">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">知识库</h2>
          <button onClick={() => setShowCreate(true)}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"><Plus size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {loading && <div className="text-xs text-gray-400 p-2">加载中...</div>}
          {spaces.map(space => (
            <div key={space.id}
              className={clsx('group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm',
                selected?.id === space.id ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100')}
              onClick={() => setSelected(space)}>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{space.name}</div>
                <div className={clsx('text-xs', selected?.id === space.id ? 'text-brand-500' : 'text-gray-400')}>{space.visibility}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(space.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {spaces.length === 0 && !loading && (
            <div className="text-xs text-gray-400 p-2 text-center">点击 + 新建知识库</div>
          )}
        </div>
      </div>

      {/* Right: document list */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <>
            <div className="mb-4">
              <h1 className="text-lg font-bold text-gray-900">{selected.name}</h1>
              {selected.description && <p className="text-sm text-gray-500 mt-0.5">{selected.description}</p>}
            </div>
            <DocumentList space={selected} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText size={40} className="mb-3 opacity-30" />
            <div className="text-sm">从左侧选择知识库</div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={s => { setSpaces(prev => [s, ...prev]); setSelected(s) }}
        />
      )}
    </div>
  )
}
