# CS Agent — Revision Plan

## 定位变更

| 项目 | 旧 | 新 |
|------|-----|-----|
| 定位 | 学习项目，面试准备 | 生产级 B2B 智能客服产品 |
| 前端 | 单文件 HTML + 原生 JS | React + Vite + TypeScript |
| 后端 | Express 5 + tsc | 保持不变（已生产级） |
| 文档 | CLAUDE.md 过时 | 需重写 |

## 一、前端：React + Vite 重写

### 1.1 初始化前端项目

```bash
pnpm create vite frontend --template react-ts
cd frontend
pnpm add react-router-dom @tanstack/react-query marked dompurify
pnpm add -D @types/dompurify vitest @testing-library/react
```

### 1.2 项目结构

```
cs-agent/
├── src/                    # 后端（不变）
├── frontend/               # 新增 React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx          # 侧边栏 + 顶栏 + 主区域
│   │   │   ├── Sidebar.tsx         # 导航 + 状态指示
│   │   │   ├── ChatView.tsx        # 对话面板
│   │   │   ├── MessageBubble.tsx   # 消息气泡（markdown 渲染）
│   │   │   ├── ToolCallInline.tsx  # 工具调用内联展示
│   │   │   ├── StreamingCursor.tsx # 流式光标
│   │   │   ├── KbView.tsx          # 知识库面板
│   │   │   ├── DocCard.tsx         # 文档卡片
│   │   │   ├── DropZone.tsx        # 拖拽上传
│   │   │   ├── SettingsView.tsx    # 设置面板
│   │   │   └── Toast.tsx           # 通知提示
│   │   ├── hooks/
│   │   │   ├── useSSE.ts           # SSE 流式对话
│   │   │   ├── useSettings.ts      # localStorage 设置
│   │   │   └── useKB.ts           # 知识库 CRUD
│   │   ├── lib/
│   │   │   ├── markdown.ts         # marked + DOMPurify 封装
│   │   │   └── api.ts              # fetch 封装
│   │   ├── styles/
│   │   │   └── tokens.css          # DESIGN.md → CSS 变量
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── public/                 # 删除（前端不再由此 serving）
├── data/                   # 保留（知识库 JSON）
└── package.json            # 根 package.json（monorepo scripts）
```

### 1.3 根 package.json 更新

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:frontend": "cd frontend && pnpm dev",
    "build": "tsc && cd frontend && pnpm build",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:frontend": "cd frontend && pnpm test"
  }
}
```

### 1.4 开发代理

Vite 开发服务器 proxy 到 Express：

```ts
// frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
    }
  }
})
```

### 1.5 生产部署

Vite build 产物 → `frontend/dist/` → Express 静态 serving:

```ts
// src/server/app.ts
app.use(express.static('frontend/dist'));
```

### 1.6 移除项

- [ ] 删除 `public/` 目录（含 `vendor/`）
- [ ] 根 `package.json` 移除 `marked`、`dompurify`（移至 frontend）
- [ ] 移除 CSP `script-src-attr 'unsafe-inline'`（React 无 inline handler）
- [ ] 移除 `helmet` 不必要的 CSP 宽松配置

## 二、文档过时内容

### 2.1 CLAUDE.md 需要修改

| 行 | 旧内容 | 新内容 |
|----|-------|--------|
| L5-6 | "用于学习和展示 AI Agent 开发的关键技术。不为炫技，为吃透 Agent 的每一个设计决策，面试时能对答如流。" | "生产级多租户智能客服 AI Agent，支持 6 个 LLM Provider、RAG 知识库管理、文件上传解析。" |
| L11 | "DeepSeek API，通过 OpenAI SDK 接入" | "多 LLM Provider（DeepSeek/OpenAI/Claude/Gemini/Qwen/Kimi）" |
| L14 | "自建 TF-IDF 关键词向量存储（MVP），可升级为 Embedding API" | "TF-IDF 关键词向量存储 + 文件解析 pipeline（PDF/DOCX/TXT/MD）" |
| L25-61 | 目录结构 | 完全过时，需重写 — 缺少 llm/、middleware/、rag/parser/、rag/storage/、agent/circuit-breaker.ts、agent/tool-timeout.ts、observability/metrics.ts、server/kb-routes.ts、frontend/ |
| L83-91 | 开发命令 | 需新增 `pnpm dev:frontend` |
| L111-116 | 迭代路线 V2/V3/V4 | 全过时，改为新路线图 |

### 2.2 CLAUDE.md 需要删除

| 行 | 内容 | 原因 |
|----|------|------|
| L20-23 | "为什么用 SDK 而不用 fetch" | 不需要解释，生产项目默认用 SDK |
| L109 | "tool_choice: 'auto'" | 已内置在 loop.ts |

### 2.3 CLAUDE.md 需要新增

- [ ] Phase 1-4 完成历史
- [ ] 前端 React + Vite 架构说明
- [ ] Monorepo 结构说明
- [ ] 安全模块说明（helmet/CSP/guardrails/rate-limit）
- [ ] Metrics + Prometheus 端点
- [ ] 生产部署指南（环境变量、构建、启动）
- [ ] 新路线图（V3: Embedding API, V4: DB 替换 JSON, V5: 多租户隔离）

### 2.4 README.md

- [ ] 前端开发启动命令更新
- [ ] 截图更新（Apple HIG 新 UI）
- [ ] API 端点列表更新
- [ ] 开发命令增加 `pnpm dev:frontend`

## 三、代码质量问题

### 3.1 缺少测试

| 模块 | 测试文件 | 状态 |
|------|---------|------|
| `src/rag/embedder.ts` | `src/rag/embedder.test.ts` | ❌ |
| `src/rag/vector-store.ts` | `src/rag/vector-store.test.ts` | ❌ |
| `src/rag/chunker.ts` | `src/rag/chunker.test.ts` | ❌ |
| `src/agent/circuit-breaker.ts` | `src/agent/circuit-breaker.test.ts` | ❌ |
| `src/middleware/rate-limit.ts` | `src/middleware/rate-limit.test.ts` | ❌ |
| `src/middleware/guardrails/input.ts` | `src/middleware/guardrails/input.test.ts` | ❌ |
| `src/middleware/guardrails/output.ts` | `src/middleware/guardrails/output.test.ts` | ❌ |
| `src/llm/providers/openai-compat.ts` | `src/llm/providers/openai-compat.test.ts` | ❌ |

共 0 个测试文件。

### 3.2 TF-IDF 替代

当前 `src/rag/embedder.ts` 仍是 TF-IDF 字符级嵌入，精度低。V3 应替换为 Embedding API（如 `text-embedding-3-small`）。

### 3.3 JSON 文件数据库

`data/knowledge-base.json` 作为唯一持久化层，多进程并发写会丢数据。生产环境需替换为 SQLite（MVP）或 PostgreSQL。

### 3.4 前端代码质量

- [ ] 内联 `onclick`/`onchange` event handler → React 事件系统
- [ ] `escHtml`/`escAttr` 函数 → React 默认 XSS 安全
- [ ] `textContent`/`innerHTML` 手动操作 → React 声明式渲染
- [ ] localStorage 直接读写 → React state + useEffect 持久化
- [ ] 全局变量（`let history = []`）→ React state

### 3.5 后端代码质量

- [ ] `circuit-breaker.ts` HalfOpen → Open 修复后，追加单元测试
- [ ] `rate-limit.ts` bucket Map 需定期清理（当前内存泄漏）
- [ ] `guardrails/output.ts` CN ID regex 可能误伤 17 位订单号

## 四、新路线图

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| **Revise** | 前端 React 重写 + 文档更新 | P0 |
| **V3** | Embedding API 替代 TF-IDF + 嵌入缓存 | P1 |
| **V4** | SQLite/PostgreSQL 替代 JSON 文件 + 数据库迁移 | P1 |
| **V5** | 多租户数据隔离 + RBAC 权限 | P2 |
| **V6** | WebSocket 替代 SSE + 完整 i18n | P3 |
| **V7** | K8s 部署 + Terraform IaC | P3 |

## 五、执行顺序

1. `pnpm create vite frontend --template react-ts`
2. 组件编写（Layout → ChatView → KbView → SettingsView）
3. 样式系统（DESIGN.md tokens → CSS variables）
4. Vite proxy 配置 + 前后端联调
5. 生产构建 + Express serving `frontend/dist/`
6. CSP 收紧（移除 `unsafe-inline`）
7. 删除 `public/` 目录
8. 更新 CLAUDE.md + README.md
9. 删除 `index.html.bak` + 清理 vendor/
10. Git commit + push

---

最后更新: 2026-05-10
状态: 待执行
