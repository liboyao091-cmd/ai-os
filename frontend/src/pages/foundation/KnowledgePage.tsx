import { BookOpen } from 'lucide-react'

export function KnowledgePage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">知识库</h1>
      <p className="text-sm text-gray-500">Phase 2 实现：文档上传、向量化、RAG 检索测试</p>
      <div className="mt-8 flex flex-col items-center text-gray-300">
        <BookOpen size={48} className="mb-3" />
        <span className="text-sm">知识库管理 — 即将推出</span>
      </div>
    </div>
  )
}
