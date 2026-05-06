# CS Agent 开发笔记：问题与修复

记录 MVP 开发过程中遇到的生产级问题、排查过程和修复方法。每个问题都可作为面试时展示 debug 能力的案例。

---

## 1. CJK 中文分词静默失败 ⭐

### 现象

RAG 知识库检索工具 `search_knowledge_base` 的 SSE 事件显示 `success: true`，但 LLM 最终回复却说"未找到相关信息"。看起来工具执行了，但返回的结果是空的。

### 排查过程

1. 首先怀疑是 vector store 的搜索逻辑有问题 → 添加日志后发现确实搜到了文档
2. 接着怀疑是 tool 返回内容的格式不对，LLM 没理解 → 检查 JSON 格式，没问题
3. **关键转折**：直接写脚本调用 `tokenize("退货政策")`，发现返回值是 `[]` 空数组

```typescript
// 问题代码
tokenize("退货政策")  // 期望: ["退","货","政","策"]，实际: []
```

### 根因

`src/rag/embedder.ts` 中的 tokenize 函数使用了 `/\W+/` 正则：

```typescript
// 修复前
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)       // ← \W 匹配 "非单词字符" [^a-zA-Z0-9_]
    .filter((t) => t.length > 1);  // ← 且过滤掉单字符
}
```

`\W` 匹配的"单词字符"范围是 `[a-zA-Z0-9_]`。中文、日文、韩文的所有字符都不在此范围内，会被当作分隔符全部丢弃。这导致**所有纯中文查询的 TF-IDF 得分都是 0**。

这个 bug 之所以"静默"（silent），是因为：
- `split` 没有报错，只是返回了空数组
- `filter(t => t.length > 1)` 又把可能的单字符过滤掉了
- vector store 的 `search` 方法正常执行，但 `filter(r => r.score > 0)` 过滤掉了得分为 0 的文档

### 修复

使用 Unicode 属性转义（Unicode Property Escapes）进行语言感知的分词：

```typescript
// 修复后
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const regex = /[\p{Script=Han}]|[a-zA-Z0-9]+/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const token = match[0].toLowerCase();
    if (token.length === 1 && /[\p{Script=Han}]/u.test(token)) {
      tokens.push(token);   // 中文逐字切分
    } else if (token.length > 1) {
      tokens.push(token);   // 英文按词切分
    }
  }
  return tokens;
}
```

修复后相似度对比：

| 查询 | 修复前 | 修复后 |
|------|--------|--------|
| `"退货政策"` vs kb-001 | 0 | 0.52 |
| `"退货"` vs kb-001 | 0 | 0.60 |

### 涉浬文件

`src/rag/embedder.ts:6-24`

### 面试叙事

> "我们 MVP 用自研的 TF-IDF 做 RAG 检索。上线后发现中文查询总是返回空结果——工具显示执行成功，但 LLM 拿不到有效内容。排查时直接写脚本调 tokenize 函数，发现中文文本进正则后出来的都是空数组。
>
> 根因是 `\W+` 正则只认 ASCII 字母数字为'单词字符'，所有 CJK 字符被当成分隔符丢弃了。这是一个静默 bug——不会抛错，只会让你检索静悄悄地失效。
>
> 修起来不复杂，换成 Unicode 属性转义 `\p{Script=Han}` 做字符级分词。但这个 bug 让我意识到：自研基础设施组件时，必须覆盖非英文输入场景的测试。后来的教训就是：RAG pipeline 的每一步都要单独验证，不能只看最终输出。"

---

## 2. OpenAI SDK 联合类型窄化

### 现象

TypeScript 编译时报错：

```
src/agent/loop.ts:78:22 - error TS2339:
Property 'function' does not exist on type 'ChatCompletionMessageToolCall'.
```

### 根因

OpenAI SDK v6 中 `ChatCompletionMessageToolCall` 是一个联合类型：

```typescript
type ChatCompletionMessageToolCall =
  | ChatCompletionMessageFunctionToolCall   // type: 'function', 有 .function 属性
  | ChatCompletionMessageCustomToolCall;    // type: 'custom', 有 .custom 属性
```

我们直接用 `tc.function` 访问属性时，TypeScript 无法确定当前是哪种变体，因此禁止访问。这是 TypeScript 在做它该做的事情——防止运行时 `undefined` 错误。

### 修复

使用 type guard 缩小类型范围：

```typescript
// 修复前
message.tool_calls.map((tc) => ({
  id: tc.id,
  function: { name: tc.function.name, arguments: tc.function.arguments }, // ❌
}));

// 修复后
const functionCalls = message.tool_calls.filter(
  (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === 'function'
);
// 现在 TypeScript 知道 tc 一定是 ChatCompletionMessageFunctionToolCall
functionCalls.map((tc) => ({
  id: tc.id,
  function: { name: tc.function.name, arguments: tc.function.arguments }, // ✅
}));
```

关键词：**Discriminated Union**（可辨识联合类型）+ **Type Guard**（类型守卫）。

### 涉浬文件

`src/agent/loop.ts:77-81`, `src/agent/loop.ts:1-2`（import 类型）

### 面试叙事

> "OpenAI SDK 的 `ChatCompletionMessageToolCall` 是个联合类型，包含了 function 和 custom 两种变体。直接访问 `.function` 会报 TS 错误。
>
> 这其实不是 bug，是 TypeScript 在做类型安全保护。解决方式是用 discriminated union 的 type guard——通过 `tc.type === 'function'` 这个字面量字段先过滤、再映射，TypeScript 就会在 filter 后面自动推断出窄化后的类型。
>
> 这是一个很好的例子说明了 strict mode 的价值——如果没有这个编译错误，万一哪天 SDK 返回了 custom 类型的 tool call，运行时就会拿到 undefined。"

---

## 3. TypeScript Declaration Emit 错误

### 现象

`tsc --noEmit` 报错：

```
TS2883: The inferred type of 'router' cannot be named without a reference to
'@types/express-serve-static-core'. This is likely not portable.
A type annotation is necessary.
```

### 根因

`tsconfig.json` 启用了 `"declaration": true`，要求 TypeScript 生成 `.d.ts` 类型声明文件。当导出的变量（`router`）的类型来自一个**传递依赖**（不是直接 dependency，而是 `express` 依赖的 `@types/express-serve-static-core`）时，TypeScript 无法在声明文件中可靠地引用该类型。

### 修复

两步修复：

```typescript
// 1. 显式导入 Router 类型（之前只导入了 Router 值）
import { Router, type Request, type Response } from 'express';

// 2. 给导出的变量加显式类型注解
export const router: Router = Router();

// 3. 给路由处理器加参数类型
router.post('/chat/stream', async (req: Request, res: Response) => {
```

### 涉浬文件

`src/server/routes.ts:25`, `src/server/routes.ts:36`

### 面试叙事

> "TS2883 是一个 declaration emit 错误。tsconfig 开了 `declaration: true` 要生成 `.d.ts` 文件，但 router 的推断类型引用了一个传递依赖，声明的类型路径不可移植。修法很简单——给变量加显式类型注解，让编译器有确定的类型引用路径。这种问题严格来说不影响运行，但生产级项目必须过类型检查，否则 CI 就挂了。"

---

## 4. GitHub SSH 密钥认证失败

### 现象

```bash
$ git push -u origin main
git@github.com: Permission denied (publickey).
```

`ssh -T git@github.com` 显示 `Permission denied`。`ssh -vT` 日志显示本地密钥已发送但被 GitHub 拒绝。

### 排查过程

1. 检查本地密钥存在 → `ls ~/.ssh/id_ed25519*` → 存在
2. 检查 ssh-agent → `ssh-add -l` → 密钥未加载
3. 加载密钥 → `ssh-add ~/.ssh/id_ed25519` → 成功
4. 测试连接 → `ssh -T git@github.com` → 仍然被拒
5. **关键发现**：将本地公钥指纹与 GitHub 上注册的密钥指纹对比 → **不一致**

### 根因

手动复制粘贴 SSH 公钥时，可能漏了开头或结尾的字符，或混入了换行符。GitHub 上注册的密钥内容与本地实际文件不匹配。

### 修复

放弃手动复制粘贴，使用 `gh` CLI 直接上传：

```bash
brew install gh
gh auth login -h github.com -p ssh -w
gh auth refresh -h github.com -s admin:public_key  # 补全权限
gh ssh-key add ~/.ssh/id_ed25519.pub -t "MacBook"
```

同时确保 SSH 配置持久化：

```bash
# ~/.ssh/config
Host github.com
  AddKeysToAgent yes
  IdentityFile ~/.ssh/id_ed25519
```

### 面试叙事

> "SSH key 配置是个经典问题。第一次配的时候手动复制粘贴公钥，结果 GitHub 上的指纹和本地不一致。这种问题排查起来很费时间，因为本地一切看起来正常。后来我用 `gh` CLI 的 `ssh-key add` 命令直接上传，彻底避免了复制粘贴出错。教训是：凡是需要手动复制粘贴的操作，如果有 CLI 工具能做，优先用工具。"

---

## 5. LLM Tool Call 参数解析防御

### 问题

LLM 返回的 `tool_calls` 中 `arguments` 是 JSON 字符串，但 LLM 不能保证 100% 输出合法 JSON。如果 `JSON.parse` 失败而不处理，Agent Loop 会直接崩溃。

### 修复

在 `JSON.parse` 外面包一层 `try-catch`，解析失败时传空对象让 Tool 自行处理（防御性编程）：

```typescript
// src/agent/loop.ts
let args: Record<string, unknown> = {};
try {
  args = JSON.parse(tc.function.arguments);
} catch {
  logger.warn({ toolName, raw: tc.function.arguments },
    'Failed to parse tool arguments');
  // 不中断循环，传空对象给 Tool
}

const result = executeTool(tc.id, toolName, args);
// Tool 内部会检查必填参数是否存在，缺失时返回友好错误
```

对应的，Tool 实现也需要处理参数缺失：

```typescript
// src/tools/search-orders.ts
export function searchOrders(query: string): string {
  if (!query.trim()) {
    return JSON.stringify({ error: true, message: '请提供查询参数' });
  }
  // ...
}
```

### 涉浬文件

`src/agent/loop.ts:95-100`, `src/tools/search-orders.ts`

### 面试叙事

> "LLM 本质是概率模型，不能假设它的输出 100% 合法。特别是 tool call 的 arguments 是 LLM 生成的 JSON 字符串，偶尔会出现格式错误。我在 Agent Loop 里对 `JSON.parse` 做了 try-catch，失败时传空对象继续执行。Tool 端也做了参数校验，缺失必填参数时返回友好错误而不是 crash。
>
> 这是 Agent 系统里很重要的一层防护——LLM 输出不可靠，你的代码必须防御性地处理。"

---

## 总结

| # | 问题 | 分类 | 教训 |
|---|------|------|------|
| 1 | CJK 分词静默失败 | 功能 Bug | 基础设施组件必须覆盖非英文场景 |
| 2 | SDK 联合类型窄化 | TypeScript | strict mode + type guard = 安全 |
| 3 | Declaration Emit | TypeScript | 生产级必须过 CI 类型检查 |
| 4 | SSH 密钥认证 | 基础设施 | 手动操作优先改用 CLI 自动化 |
| 5 | Tool 参数防御 | 防御性编程 | 永远不要信任 LLM 的输出格式 |
