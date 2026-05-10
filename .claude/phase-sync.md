# Phase 5: 前端重设计 — 已完成

## 设计语言: Apple HIG via DESIGN.md

使用 `npx getdesign@latest add apple` 生成的完整设计 token 系统：

- 色彩: Action Blue #0066cc 唯一强调色，canvas/parchment/ink 灰阶体系
- 字体: SF Pro Display + SF Pro Text，17px 正文字号，负 letter-spacing 标题
- 按钮: pill 胶囊形 (9999px radius)，scale(0.95) 按压反馈
- 毛玻璃: backdrop-filter saturate(180%) blur(20px) 侧边栏 + 顶栏
- 圆角: xs 5px / sm 8px / md 11px / lg 18px / pill 9999px
- 间距: 8px 基准网格 (xxs 4 → section 80)
- 阴影: 仅 product-shadow 用于图片，UI 无阴影

## 已实现 (单文件 public/index.html, ~550 行)

### Part 1: Design System ✅
- 50+ CSS 自定义属性 (颜色/圆角/间距/动画)
- 组件原语: .btn / .btn-ghost / .btn-util / .btn-pearl / .btn-icon / .btn-danger
- 表单: .input / .input-mono / textarea / .select-wrap / .switch
- 卡片: .card / .badge / .dot / .toast / .empty
- 响应式: ≤834px 侧边栏收窄，≤640px 单列布局

### Part 2: 布局 ✅
- 毛玻璃侧边栏 (220px) + 主区域
- 三个导航项: 对话 / 知识库 / 设置
- 顶栏: 状态指示灯 + provider·model badge + 页面标题
- 侧边栏底部: Token 消耗 / 轮次 / 响应延迟实时计数

### Part 3: 对话体验 ✅
- 气泡式消息 (用户蓝色右对齐，Agent 白色左对齐)
- 时间戳 + 悬停复制按钮
- 工具调用内联展示 (可折叠，Round 标签)
- 思考中状态 + 流式响应
- 快捷提问建议 (退货/订单/会员/客服)
- 空状态引导

### Part 4: 设置面板 ✅
- 6 个 LLM Provider 下拉选择
- 每个 Provider 独立 API Key 输入 (password masked, 存 localStorage)
- Model 选择器 + Tenant ID 输入
- 修改即保存，实时生效
- 侧边栏和顶栏联动更新

### Part 5: 知识库面板 ✅
- 统计卡片 (文档总数 + 分类分布)
- 拖拽上传区域 (dragover/drop, 视觉反馈)
- 点击上传按钮 + 隐藏 file input
- 文档卡片网格 (id / 分类标签 / 内容预览 / 分块信息 / 删除)
- 搜索筛选

### Part 6: 状态指示 ✅
- 顶栏绿点连接指示器 (每30s 健康检查)
- 侧边栏底部实况: Token 总数 / 本轮轮次 / 响应延迟
- 操作 Toast 反馈

## 技术细节

- 纯 HTML/CSS/JS，零框架，单文件
- 设置 localStorage 持久化 (cs-agent:provider/model/tenantId/apiKeys)
- x-tenant-id header 随请求发送
- 响应式三断点: 1440+ / 834 / 640

## 待部署

文件在 worktree 已写，需要 cp 到 main repo 的 public/index.html 并 commit。

---

最后更新: 2026-05-10
状态: ✅ 全部完成，待 commit + 测试
