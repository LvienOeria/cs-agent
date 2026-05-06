# CS Agent — 生产级智能客服 AI Agent

## 项目目标

一个聚焦 Agent 核心能力的智能客服系统，用于学习和展示 AI Agent 开发的关键技术。
不为炫技，为吃透 Agent 的每一个设计决策，面试时能对答如流。

## 技术栈

- **Runtime**: Node.js 22 + TypeScript (strict mode)
- **LLM**: DeepSeek API，通过 OpenAI SDK 接入（`openai` npm 包，改 `baseURL` 指向 DeepSeek）
- **HTTP Framework**: Express 5
- **Streaming**: SSE (Server-Sent Events)
- **RAG**: 自建 TF-IDF 关键词向量存储（MVP），可升级为 Embedding API
- **Logging**: pino（开发用 pino-pretty，生产输出 JSON）
- **Config**: dotenv + zod 校验（fail fast 原则）
- **Package Manager**: pnpm
- **Testing**: Vitest

## 为什么用 SDK 而不用 fetch

SDK 封装了：流式 SSE 解析与 chunk 拼接、Tool Call 增量累积、类型化错误（RateLimitError 等）、自动重试+退避、连接池复用。
本质就是封装的 HTTP 请求，省去 500+ 行管道代码，聚焦 Agent 逻辑。

## 目录结构

```
cs-agent/
├── src/
│   ├── agent/           # Agent 核心：ReAct Loop
│   │   ├── types.ts     # Agent 事件类型定义
│   │   ├── prompts.ts   # System Prompt 模板
│   │   └── loop.ts      # Agent Loop 主逻辑（async generator）
│   ├── tools/           # Tool 定义与执行
│   │   ├── types.ts     # ToolDef / ToolCall / ToolResult 类型
│   │   ├── search-orders.ts   # 查订单工具
│   │   ├── search-kb.ts       # RAG 知识库检索工具
│   │   ├── transfer-human.ts  # 转人工工具
│   │   └── registry.ts  # Tool 注册中心（name → def + executor）
│   ├── rag/             # 简易 RAG 实现
│   │   ├── embedder.ts  # TF 关键词嵌入 + 余弦相似度
│   │   ├── vector-store.ts  # 内存向量存储
│   │   └── knowledge-base.ts  # 知识库加载与管理
│   ├── server/          # HTTP 服务
│   │   ├── app.ts       # Express 应用创建
│   │   ├── routes.ts    # POST /api/chat/stream (SSE)
│   │   └── sse.ts       # SSE 工具函数
│   ├── observability/   # 可观测性
│   │   ├── logger.ts    # pino 日志实例
│   │   └── tracker.ts   # 请求级 token/latency 追踪
│   ├── config.ts        # 环境变量校验（zod）
│   └── index.ts         # 入口：加载知识库 → 启动 HTTP 服务
├── data/
│   └── knowledge-base.json  # 知识库数据（10 条电商政策）
├── public/
│   └── index.html       # 极简聊天 UI（原生 JS + SSE fetch）
├── tests/               # 测试文件
├── .env.example         # 环境变量模板
├── tsconfig.json        # TypeScript 配置（strict, ESNext, bundler）
└── package.json
```

## 核心架构：ReAct Agent Loop

```
User Message
  → [System Prompt + History + User Message] + Tools → LLM
  → LLM 返回 tool_calls → 执行工具 → 结果注入 messages
  → 再次调用 LLM → ... → 文本回复（或达到 MAX_ROUNDS=5）
```

### Agent 事件流（SSE 推送）

| 事件类型 | 触发时机 | 示例 |
|---------|---------|------|
| `status: thinking` | 每轮 LLM 调用前 | `{"status":"thinking","round":1}` |
| `tool_call` | 调用工具前 | `{"name":"search_orders","args":{...}}` |
| `tool_result` | 工具执行完成 | `{"name":"search_orders","success":true}` |
| `status: responding` | LLM 返回文本 | `{"status":"responding","round":2}` |
| `done` | 最终回复 | `{"content":"订单...","rounds":2}` |
| `error` | 出错 | `{"message":"..."}` |

## 开发命令

```bash
pnpm dev           # 开发模式（tsx watch，热重载）
pnpm build         # 编译 TS → JS（tsc）
pnpm start         # 生产启动
pnpm test          # 运行测试
pnpm test:watch    # 测试监听模式
```

## 编码约定

- **TypeScript strict mode** — 所有选项开启
- **ESM** — `import/export`，`"type": "module"`
- **Fail fast** — 启动时校验环境变量，不合法直接 `process.exit(1)`
- **结构化日志** — 不用 `console.log`，统一使用 `logger.info/error/warn`
- **错误分层**：LLM 错误（重试/退避）vs Tool 错误（返回给 LLM 决策）vs 系统错误（crash）
- **工具返回值 ≤ 8KB** — 避免撑爆 LLM 上下文窗口
- **知识库检索 topK=3** — 只注入最相关的 3 条，控制 token 消耗
- **对话历史上限 20 轮** — 前端硬截断，防止 SSE 载荷膨胀

## 设计约束

- Agent Loop 最大 **5 轮**，超出返回错误（防止无限循环 + token 消耗失控）
- Tool 参数由 `JSON.parse` 解析，失败时传空对象让工具自行报错（防御性编程）
- SSE 端点通过 `req.on('close')` 检测客户端断连
- `tool_choice: 'auto'` — LLM 自主决定是否用工具（而非强制）

## 迭代路线

1. **MVP（当前）**：ReAct Loop + 3 个工具 + TF-IDF RAG + SSE 流式 + 极简前端
2. **V2**：LLM 逐字流式输出（`stream: true`）、上下文窗口管理（滑动窗口/摘要压缩）
3. **V3**：Embedding API 替代 TF-IDF、工具执行超时控制、Rate Limit 退避策略
4. **V4**：多轮对话记忆优化、工具权限分级（只读/读写/敏感）
