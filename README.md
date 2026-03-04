# DS AI OS

**让数据科学家能自主配置、生成、管理属于自己业务域 AI 工作流的平台**

> 当前进度：Phase 1 完整实现

---

## 架构概览

```
Layer C: 编排层 Orchestrator   ← 组合多个 Executor
Layer B: 执行层 Engine         ← Workflow / Agent / Copilot
Layer A: 底座层 Foundation     ← Tools / Knowledge / Models / Guardrails
```

## 快速开始

### 1. 启动依赖服务

```bash
docker-compose up -d
```

### 2. 安装并启动后端

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # 填写 LLM_GATEWAY_TOKEN 等
# 初始化数据库（开发模式自动创建表）
uvicorn backend.main:app --reload --port 8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 http://localhost:5173

### 4. 启动 Celery Worker（异步索引文档用）

```bash
cd backend
celery -A backend.tasks.celery_app worker -Q indexing,execution --loglevel=info
```

---

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 地址 |
| `LLM_GATEWAY_BASE_URL` | LLM API base URL（OpenAI 兼容） |
| `LLM_GATEWAY_TOKEN` | API Token |
| `LLM_DEFAULT_MODEL` | 默认模型 ID |
| `LLM_EMBEDDING_MODEL` | Embedding 模型 ID |

---

## API 文档

启动后访问 http://localhost:8000/docs

主要端点：

```
POST /api/tools                    创建工具
POST /api/tools/{id}/test          测试工具
POST /api/executors                创建执行器
POST /api/executors/{id}/sandbox   沙箱运行
POST /api/executors/{id}/run       同步运行
GET  /api/runs/{id}/replay         查看执行回放
```

---

## Phase 1 验收标准

- [x] 注册 `python_func` 工具并调用测试
- [x] 创建 `ai_workflow` 执行器（JSON definition）
- [x] 沙箱运行并查看 steps_log
- [x] `human_confirm` 步骤暂停 → 前端确认 → 继续执行
- [x] 执行回放页面

## Phase 2（待实现）

- [ ] 知识库文档上传 + 向量化（Celery 异步）
- [ ] WorkflowRunner 接入 RAG 注入
- [ ] React Flow 拖拽画布
- [ ] Agent ReAct 循环完整验证

## Phase 3（待实现）

- [ ] 编排器画布（多 Executor 串联）
- [ ] Fork 机制 UI
- [ ] 执行器/工具市场
