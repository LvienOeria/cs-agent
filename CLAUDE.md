# CS Agent — 生产级智能客服 AI Agent

## 项目定位

生产级多租户智能客服 AI Agent。支持 6 个 LLM Provider、RAG 知识库管理、文件上传解析、熔断 fallback、限流 guardrails、Prometheus 指标。

## 技术栈

- **Runtime**: Node.js 22 + TypeScript 6 (strict mode)
- **Backend**: Express 5 + SSE (Server-Sent Events)
- **Frontend**: React 19 + Vite 8 + TypeScript
- **LLM**: 6 Provider — DeepSeek, OpenAI, Claude, Gemini, Qwen, Kimi
- **RAG**: TF-IDF 向量存储 + 文件解析 pipeline (PDF/DOCX/TXT/MD)
- **Logging**: pino (开发 pino-pretty，生产 JSON)
- **Config**: dotenv + zod 校验 (fail fast)
- **Package Manager**: pnpm
- **Testing**: Vitest

## 目录结构

```
cs-agent/
├── src/                          # 后端源码
│   ├── agent/                    # Agent 核心
│   │   ├── loop.ts               # ReAct Loop (async generator)
│   │   ├── prompts.ts            # System Prompt 模板
│   │   ├── types.ts              # Agent 事件类型
│   │   ├── circuit-breaker.ts    # 断路器 + Provider Fallback 链
│   │   └── tool-timeout.ts       # 工具执行超时保护
│   ├── llm/                      # LLM Provider 适配层
│   │   ├── types.ts              # LLMClient / CompletionRequest / Response
│   │   ├── registry.ts           # Provider 注册中心
│   │   └── providers/            # SDK 适配器
│   │       ├── openai-compat.ts  # DeepSeek/OpenAI/Qwen/Kimi
│   │       ├── anthropic.ts      # Claude
│   │       └── google.ts         # Gemini
│   ├── rag/                      # RAG 知识库
│   │   ├── types.ts              # Chunk / SearchResult / Retriever
│   │   ├── embedder.ts           # TF-IDF 嵌入 + 余弦相似度
│   │   ├── vector-store.ts       # 内存向量存储（多租户）
│   │   ├── knowledge-base.ts     # 知识库管理 + 自动持久化
│   │   ├── chunker.ts            # 文本分块器 (400 token, 20% overlap)
│   │   ├── pipeline.ts           # parse → chunk → embed → store
│   │   ├── parser/index.ts       # 文件解析 (PDF/DOCX/TXT/MD)
│   │   └── storage/local.ts      # 上传文件本地存储
│   ├── middleware/               # 中间件
│   │   ├── rate-limit.ts         # 租户级令牌桶限流
│   │   └── guardrails/
│   │       ├── input.ts          # 提示注入检测 (7 种 pattern)
│   │       └── output.ts         # PII 扫描 + 脱敏
│   ├── server/                   # HTTP 服务
│   │   ├── app.ts                # Express 应用（helmet/CSP/中间件链）
│   │   ├── routes.ts             # POST /api/chat/stream (SSE)
│   │   ├── kb-routes.ts          # KB CRUD + 文件上传
│   │   └── sse.ts                # SSE 工具函数
│   ├── tools/                    # Tool 定义与执行
│   │   ├── types.ts              # ToolDef / ToolCall / ToolResult
│   │   ├── search-orders.ts      # 查订单
│   │   ├── search-kb.ts          # RAG 检索
│   │   ├── transfer-human.ts     # 转人工
│   │   └── registry.ts           # Tool 注册中心
│   ├── observability/            # 可观测性
│   │   ├── logger.ts             # pino 日志
│   │   ├── tracker.ts            # 请求级 token/latency 追踪
│   │   └── metrics.ts            # Prometheus 指标
│   ├── config.ts                 # 环境变量校验 + getApiKey/getBaseURL
│   └── index.ts                  # 入口
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── components/           # UI 组件
│   │   │   ├── ChatView.tsx      # 对话面板
│   │   │   ├── MessageBubble.tsx  # 消息气泡 (markdown 渲染)
│   │   │   ├── KbView.tsx        # 知识库管理
│   │   │   ├── DocCard.tsx       # 文档卡片
│   │   │   ├── DropZone.tsx      # 拖拽上传
│   │   │   ├── SettingsView.tsx   # 设置面板
│   │   │   └── Sidebar.tsx       # 导航侧边栏
│   │   ├── hooks/                # React Hooks
│   │   │   ├── useSSE.ts         # SSE 流式对话
│   │   │   ├── useSettings.ts    # 设置持久化
│   │   │   └── useKB.ts          # 知识库 CRUD
│   │   ├── lib/                  # 工具函数
│   │   │   ├── markdown.ts       # marked + DOMPurify
│   │   │   └── api.ts            # fetch 封装 + SSE 流
│   │   ├── styles/               # 样式
│   │   │   ├── tokens.css        # Apple DESIGN.md → CSS 变量
│   │   │   └── layout.css        # 布局 + 组件样式
│   │   └── App.tsx
│   └── vite.config.ts            # Proxy → Express :3000
├── data/
│   └── knowledge-base.json       # 10 条电商政策
├── REVISE.md                     # 本次 Revision 计划
├── CLAUDE.md                     # 本文档
└── README.md                     # 用户文档
```

## 架构

```
Browser (React + Vite)
  → Vite Proxy → Express :3000
    → Rate Limiter → Input Guardrail
      → Agent Loop (ReAct, max 5 rounds)
        → Circuit Breaker → LLM Provider (6 options, fallback chain)
        → Tools (search_orders, search_kb, transfer_human)
          → RAG Vector Store (TF-IDF, multi-tenant)
          → KB Pipeline (parse → chunk → embed → store)
      → PII Sanitize → SSE Stream → Browser
```

## 生产加固

| 机制 | 实现 |
|------|------|
| 断路器 | 3 次失败 → 熔断 → 30s 后半开探测 |
| Provider Fallback | 主 provider 故障自动切换下一个 |
| 工具超时 | 30s 超时，Agent Loop 不崩溃 |
| 限流 | 令牌桶，2 token/s，burst 10，每租户 |
| 注入检测 | 7 种 prompt injection pattern 拦截 |
| PII 脱敏 | 身份证/手机/邮箱/银行卡打码 |
| Helmet | CSP + 安全头 (XSS/clickjack/MIME-sniff) |
| Prometheus | /metrics 端点 (延迟/Token/错误/fallback) |

## 开发命令

```bash
pnpm dev              # 后端 tsx watch 热重载
pnpm dev:frontend     # 前端 Vite dev (proxy → :3000)
pnpm build            # tsc + vite build
pnpm start            # 生产启动
pnpm test             # 运行测试
pnpm test:watch       # 测试监听
```

## 编码约定

- TypeScript strict mode + ESM
- Fail fast — 环境变量不合法直接 process.exit(1)
- 结构化日志 — 不用 console.log
- 错误分层: LLM 错误 / Tool 错误 / 系统错误
- 工具返回值 ≤ 8KB
- 知识库检索 topK=3
- 对话历史上限 20 轮
- Agent Loop 最大 5 轮

## 路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 模块化重构 | ✅ |
| Phase 2 | 6 LLM Provider + Gemini fix | ✅ |
| Phase 3 | KB 文档管理 + 文件上传链路 | ✅ |
| Phase 4 | 生产加固 (断路器/限流/guardrails/metrics) | ✅ |
| Revise | React 重写 + 文档更新 | ✅ 当前 |
| V3 | Embedding API 替代 TF-IDF | 待定 |
| V4 | SQLite/PostgreSQL 替代 JSON | 待定 |
| V5 | 多租户数据隔离 + RBAC | 待定 |
