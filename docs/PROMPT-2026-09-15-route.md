# PromptBox 后续开发提示词（2026-09-15）

把下面整段贴进新会话。

---

我在开发 PromptBox（`D:\dev\Owner\promptbox`，Electron + React 18 + TypeScript + Tailwind v4 + zustand，本地 JSON 存储，可选云同步）。先用 Serena 激活项目并读 `README.md`、`PRODUCT.md`、`DESIGN.md`，再看 `git log -3`。

## 产品现在是什么

不再是"Prompt 管理器"。用户反馈库一大就挑不过来、小白不知道从哪入手，所以在 commit `656b34d` 里把产品改成了**按项目类型走一条路**：

1. **首屏只问一个问题**：做的是 网站 / 命令行工具 / 桌面应用 / 手机 App / 其他，起点是 从零开始 / 我有现成代码。有进度时给「继续上次 / 重新开始」。
2. **路线屏**：左侧 5 个固定阶段（想清楚 → 定方案 → 搭骨架 → 做功能 ↻ → 上线）共 13 步（按起点过滤成 12 或 6 步）。右侧只显示当前一步：一句话说明 → 最多一个输入框 → 「复制，去 Claude Code 里粘贴」→ 「完成，下一步」。做功能阶段末尾有「再做一个功能」回到拆任务那步并计数。第 1 步有 3 行准备说明，复制过一次就消失。`⌘/Ctrl+Enter` 在输入框里直接复制。
3. **高级 · 全部 Prompt**：原来的三栏库（侧栏 / 列表 / 编辑器），给想改措辞、加自己 Prompt 的人。

## 数据模型（关键）

- 阶段 = 代码常量 `STAGES` / `STAGE_COLORS`（`src/shared/types.ts`），用户不能改
- 步骤 = `Category`，新增字段 `stage / hint（这步做什么）/ output（产物）/ flow（'fresh' | 'existing' | undefined=两者）`
- Prompt 变体 = `Prompt.track`（`'web'|'cli'|'desk'|'mobile'|'other'|null`，null = 所有类型）。`routePrompt()` 取当前类型的变体，没有就取通用
- 卡片输入框 = 现有 `Prompt.variables`（内置的用一个 `{{一句话}}`，label 是问题，`multiline` + `required`）
- 路线进度 = renderer `localStorage['promptbox.route']`：`{track, flow, cur, done[], feature}`，设备本地，不同步
- 内置内容在 `src/main/seed.ts`：13 步 / 28 条 Prompt。规则：**每条最多一个 `{{一句话}}`；读上一步写的 `docs/0N-*.md`，写下一步要读的文件**。仅当没有任何带 `stage` 的分类时种入
- 关键文件：`renderer/components/ChooseView.tsx`、`RouteView.tsx`、`selectors.ts`（`routeSteps` / `routePrompt` / `stepsOf` / `nextStep`）、`store.ts`（`RouteState`、`view: 'route'|'choose'|'library'|'settings'|'trash'`）

## 这次删掉的（别再加回来）

发现页 + 外部 Prompt 源、分类配色管理、标签云与标签筛选、多选批量操作、置顶、最近使用/未分类视图、设置里的快捷键表和快照列表。保留：云同步、版本历史、回收站、⌘K、变量填充、md 导入导出、主题/语言、自动更新。

## 已定的原则

- **核心目标是降低使用难度**。只做必要功能，不为做功能而做功能。每加一个东西先问：小白走这条路会在哪里卡住？不卡就不加。
- 视觉沿用 DESIGN.md（羊皮纸 + 陶土橙 + 衬线标题），单列、留白、编号，当前步骤实色其余灰。
- 阶段名用口语；文案面向不懂技术的人。
- Prompt 假设用户在 Claude Code / Cursor 这类能读写文件的工具里用。
- 明确不做：多项目并行进度、在 App 里直接调 AI、"贴到哪个工具"的设置、自定义步骤的说明/产物编辑界面。

## 已知待办 / 可能的下一步（按需，不是必须）

- 老用户升级：旧分类留在「其他」不上路线，13 个内置步骤会加进去。目前没有"把旧分类归入某阶段"的批量入口，只有编辑器里逐条改步骤下拉。
- 英文语言包：新字符串大多没有 en 翻译（会回退中文）。`src/renderer/src/locales/en.ts`
- 内置 28 条 Prompt 是初版，需要实际用几轮再调措辞。
- `PRODUCT.md` 的 Users 段已改为"小白优先"，其余段落还是旧的 power-user 口吻。

## 本机运行注意

- `npm run dev` 端口已改为 5678（5173 在 Windows 保留段）。
- 正式版 PromptBox 常驻运行，持有单实例锁，数据在 `%APPDATA%\promptbox\data\promptbox.json`（282 条真实数据）。**要看效果别直接跑正式数据**：`npx electron-vite dev -- --user-data-dir=<临时目录>`，会用新种子。
- 验证：`npm run typecheck && npm test && npm run build`。

## 沟通方式

回复简短，先给结论和代码，不要长篇解释。改动前先看完相关代码再动手；最短能工作的 diff 优先；标记刻意简化的地方用 `// ponytail:` 注释。提交用 Conventional Commits，中文描述可以。
