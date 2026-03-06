import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { ToolsPage } from './pages/foundation/ToolsPage'
import { KnowledgePage } from './pages/foundation/KnowledgePage'
import { ModelsPage } from './pages/foundation/ModelsPage'
import { GuardrailsPage } from './pages/foundation/GuardrailsPage'
import { ExecutorListPage } from './pages/executors/ExecutorListPage'
import { ExecutorEditorPage } from './pages/executors/ExecutorEditorPage'
import { OrchestratorListPage } from './pages/orchestrators/OrchestratorListPage'
import { OrchestratorEditorPage } from './pages/orchestrators/OrchestratorEditorPage'
import { ReplayPage } from './pages/runs/ReplayPage'
import { RunsPage } from './pages/runs/RunsPage'
import { ExecutorRunsPage } from './pages/executors/ExecutorRunsPage'
import { MarketplacePage } from './pages/MarketplacePage'

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Full-screen pages (no sidebar) */}
        <Route path="/executors/new" element={<ExecutorEditorPage />} />
        <Route path="/executors/:id/runs" element={<ExecutorRunsPage />} />
        <Route path="/executors/:id" element={<ExecutorEditorPage />} />
        <Route path="/orchestrators/:id" element={<OrchestratorEditorPage />} />
        <Route path="/runs/:runId/replay" element={<ReplayPage />} />

        {/* All other pages use MainLayout */}
        <Route path="*" element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/executors" replace />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/guardrails" element={<GuardrailsPage />} />
              <Route path="/executors" element={<ExecutorListPage />} />
              <Route path="/orchestrators" element={<OrchestratorListPage />} />
              <Route path="/runs" element={<RunsPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
            </Routes>
          </MainLayout>
        } />
      </Routes>
    </BrowserRouter>
  )
}
