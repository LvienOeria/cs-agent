# CS Agent — 智能客服 AI Agent

基于 ReAct 模式的智能客服 AI Agent，支持工具调用、RAG 知识库检索、文件上传管理、多 LLM Provider。

## 快速开始

```bash
pnpm install
cp .env.example .env   # 编辑 .env 填入 API Key
pnpm dev               # 开发模式（热重载）
```

打开 http://localhost:3000 即可体验聊天界面。

## LLM Provider

支持 6 个 LLM 提供商，`.env` 中设置 `LLM_PROVIDER` 即可切换：

| Provider | 环境变量 Key | 模型 |
|----------|-------------|------|
| deepseek | `LLM_API_KEY` or `DEEPSEEK_API_KEY` | deepseek-chat |
| openai | `OPENAI_API_KEY` | gpt-4o |
| claude | `ANTHROPIC_API_KEY` | claude-sonnet-4-6 |
| gemini | `GEMINI_API_KEY` | gemini-2.0-flash |
| qwen | `QWEN_API_KEY` | qwen-plus |
| kimi | `KIMI_API_KEY` | moonshot-v1-8k |

```bash
# .env 示例
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-your-key-here
PORT=3000
```

配置多个 provider 的 key 后，系统会自动构建 fallback 链：主 provider 故障时自动切换下一个。

## 知识库管理

### Web UI

聊天界面顶栏切换到「知识库管理」标签页，支持：
- 查看文档列表 + 分类统计
- JSON 添加文档
- 删除文档

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat/stream` | 对话（SSE 流式） |
| `GET` | `/api/kb/documents` | 列出文档 |
| `POST` | `/api/kb/documents` | JSON 添加文档 |
| `POST` | `/api/kb/upload` | 上传文件（PDF/DOCX/TXT/MD） |
| `DELETE` | `/api/kb/documents/:id` | 删除文档 |
| `GET` | `/api/kb/stats` | 分类统计 |
| `GET` | `/health` | 健康检查 |
| `GET` | `/metrics` | Prometheus 指标 |

### 文件上传

```bash
curl -X POST http://localhost:3000/api/kb/upload \
  -F "file=@policy.pdf" \
  -F "tenantId=tenant-001"
```

文件自动解析 → 分块 → 嵌入 → 入库，可立即被对话检索。

## 架构

```
User Message → Rate Limiter → Input Guardrail → Agent Loop (ReAct)
                                                    ↓
    System Prompt + History + Message + Tools → LLM
    LLM returns tool_calls → Tool Timeout → Execute → PII Sanitize
    LLM returns text → SSE stream to client
```

### 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Agent Loop | `src/agent/loop.ts` | ReAct 循环：思考 → 工具调用 → 回复 |
| Tool Registry | `src/tools/registry.ts` | 工具注册 + 执行调度 |
| KB Management | `src/rag/` | 向量存储、知识库 CRUD、文件解析 |
| LLM Adapters | `src/llm/providers/` | 6 个 LLM 的 SDK 适配 |
| Circuit Breaker | `src/agent/circuit-breaker.ts` | 熔断 + Provider Fallback 链 |
| Rate Limiter | `src/middleware/rate-limit.ts` | 租户级令牌桶限流 |
| Guardrails | `src/middleware/guardrails/` | 输入注入检测 + 输出 PII 脱敏 |
| Metrics | `src/observability/metrics.ts` | Prometheus 指标（延迟/Token/错误） |

## 生产加固

- **断路器**：3 次失败熔断 → 30s 半开探测 → 自动恢复
- **Provider Fallback**：主 provider 故障自动切换下一个
- **工具超时**：30s 超时保护，Agent Loop 不崩溃
- **限流**：2 token/s/burst 10（约 120 req/min）每租户
- **注入检测**：7 种提示注入 pattern 拦截
- **PII 脱敏**：身份证/手机/邮箱/银行卡自动打码

## 开发

```bash
pnpm dev        # 热重载开发
pnpm build      # TypeScript 编译
pnpm start      # 生产启动
pnpm test       # 运行测试
```

详见 [CLAUDE.md](./CLAUDE.md) — 完整开发文档。
