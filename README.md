# PromptBox

[![Release](https://img.shields.io/github/v/release/sooua/promptbox?label=release)](https://github.com/sooua/promptbox/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/sooua/promptbox/total)](https://github.com/sooua/promptbox/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**本地优先的 AI Prompt / Skill / Agent / MCP 资产管理桌面工具。**

像管理代码片段一样管理你的 Prompt、角色设定、上下文模板，以及 Claude Skill、Agent、MCP 配置。所有数据默认以 JSON 保存在本机，不上传任何服务器；云同步可选并端到端加密。

基于 **Electron + React 18 + TypeScript + Tailwind CSS v4**，采用 Claude/Anthropic 暖色设计语言。

## 下载安装

前往 [**Releases**](https://github.com/sooua/promptbox/releases/latest) 下载对应平台：

| 平台 | 文件 |
| --- | --- |
| **Windows** | `PromptBox-Setup-x.y.z.exe` |
| **macOS (Apple Silicon)** | `PromptBox-x.y.z-arm64.dmg` |
| **macOS (Intel)** | `PromptBox-x.y.z.dmg` |
| **Linux** | `PromptBox-x.y.z.AppImage` |

> **Windows**：未做代码签名，首次运行可能弹 SmartScreen 提示，点「更多信息 → 仍要运行」。
> **macOS**：未签名 / 公证，首次打开需「右键 → 打开」绕过 Gatekeeper；mac 自动更新需签名后生效。
> 安装后内置在线更新：Windows / Linux 会自动检测、后台下载、一键重启安装。

## 功能

### 统一资产库

在一个应用里管理四类资产，各自有专属工作区，并共享分类、标签、收藏、置顶：

- **Prompt** — Markdown 正文，实时预览
- **Skill** — `SKILL.md` 正文 + 附带文件，可导出 / 导入 / 一键安装
- **Agent** — 系统提示 + 工具 / 模型元数据
- **MCP** — `stdio` / `sse` / `http` 配置，可一键合并到本地 MCP 配置

### 变量模板

- `{{变量名}}` 自动识别，填充后一键复制结果
- 内联默认值：`{{name | 默认值}}`
- 必填校验（未填写禁止复制并高亮）
- 输入类型：文本 / 多行 / 下拉 / 数字 / 日期
- 记住上次填写的值

### 命令面板（Ctrl/⌘ + K）

跨全部资产快速搜索调用，支持拼音全拼与首字母匹配。增量索引（预计算检索键 + 按对象身份记忆化），大库依然流畅。`Enter` 复制，`⌘/Ctrl+Enter` 打开。

### 版本历史与批量操作

- 修改内容自动留存历史版本，可并排查看 **diff** 改动并一键恢复
- 列表多选（`Ctrl`/`Shift` + 点击）后批量收藏 / 移动分类 / 加标签 / 导出 / 删除
- 编辑器词级撤销重做（`Ctrl+Z` / `Ctrl+Shift+Z`）

### 云同步（可选）

- 支持 **GitHub Gist / WebDAV / S3 兼容存储**
- 多设备项目级合并，删除通过墓碑（tombstone）传播
- **端到端加密**（AES-256-GCM），口令经本机 `safeStorage` 加密保存，云端只存密文
- 自动同步带防抖与失败指数退避，状态实时可见

### 数据安全

- **自动备份**：定时快照（每 5 分钟）+ 退出前快照，最多保留 20 份
- **损坏自愈**：数据文件损坏时自动隔离为 `promptbox.corrupt-*.json` 并从最近备份恢复，绝不静默清空
- **原子写入 + 写盘失败弹窗提示**
- 本地 JSON 存储，数据目录可在设置中更改；支持导入 / 导出（合并 / 替换）

### 界面

- Claude/Anthropic 暖色设计语言（羊皮纸底 + 陶土橙 + 衬线标题）
- 浅色 / 深色 / 跟随系统，一套语义化 token 切换
- 自定义无边框标题栏，更整洁的窗口外观
- 全局热键唤起 + 托盘常驻

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + K` | 命令面板（搜索全部资产） |
| `Ctrl/⌘ + N` | 在当前工作区新建 |
| `Ctrl/⌘ + D` | 复制当前条目 |
| `Ctrl/⌘ + S` | 立即保存 |
| `Ctrl/⌘ + F` | 聚焦列表搜索 |
| `Ctrl/⌘ + 1~4` | 切换 Prompts / Skill / Agent / MCP |
| `Ctrl/⌘ + ,` | 打开设置 |
| `Ctrl/⌘ + Z` | 编辑器撤销 / 重做 |
| `↑ ↓ / Enter` | 列表选择 / 复制 |
| `Esc` | 关闭弹窗 / 返回 |

## 开发

```bash
npm install
npm run dev          # 启动开发模式（热重载）
npm run typecheck    # 类型检查（主进程 + 渲染进程）
npm run build        # 构建
npm run package      # 打包为安装包（不发布）
```

## 发布

### 三端发布（推荐，GitHub Actions）

`.github/workflows/release.yml` 会在推送 `v*.*.*` tag 时，于 `windows / macos / ubuntu` 三个 runner 上各自构建原生包并发布到同一个 Release：

```bash
# 1. 递增版本（在线更新靠版本号比较判断新版）
npm version patch        # 或手动改 package.json 的 version
# 2. 打 tag 并推送，触发 CI
git push && git push --tags
```

CI 用仓库自带的 `GITHUB_TOKEN` 发布，无需额外配置。三端各自生成更新清单（`latest.yml` / `latest-mac.yml` / `latest-linux.yml`）。Release 默认为草稿，三个任务都完成后发布即可。

### 仅本地单平台（快速验证）

```bash
GH_TOKEN="$(gh auth token)" npm run publish   # 只产出当前主机平台
```

> macOS 的 dmg/zip 必须在 macOS 上构建，Linux 的 AppImage 最好在 Linux 上构建，无法在 Windows 交叉编译，因此完整三端依赖 CI。
> 应用图标取自 `build/icon.ico`（Windows）与 `build/icon.png`（mac/Linux），electron-builder 自动采用。

## 架构

```
src/
  shared/          # 主进程与渲染进程共享：类型、IPC 通道、变量解析、资产格式
  main/            # Electron 主进程
    store/
      repository.ts # 持久化：Repository 接口 + JSON 实现
      config.ts     # 应用级配置（数据目录、主题、热键）
    sync/          # 云同步：可插拔 SyncProvider（Gist/WebDAV/S3）+ 合并引擎 + 加密
    backup.ts      # 时间戳快照备份
    update.ts      # electron-updater 在线更新
    ipc.ts         # IPC 处理器
    system.ts      # 全局热键 + 托盘
  preload/         # 安全的 contextBridge API 暴露
  renderer/        # React 界面
    store.ts       # zustand 全局状态
    searchIndex.ts # 增量搜索索引（字面 + 拼音）
    selectors.ts   # 过滤 / 排序 / 命令面板排序
    components/    # Sidebar / PromptList / EditorPanel / CommandPalette / SettingsView 等
```

### 存储层可扩展性

所有持久化都依赖 `Repository` 接口（`src/main/store/repository.ts`），IPC、备份、同步均面向接口而非具体类。默认实现是 JSON 文件仓储；要换 SQLite，只需 `implements Repository` 并在 `index.ts` 替换构造，上层零改动。`DESIGN.md` 与 `PRODUCT.md` 记录了视觉系统与产品策略。

## 技术栈

Electron · electron-vite · React 18 · TypeScript · Tailwind CSS v4 · zustand · electron-updater · pinyin-pro · lucide-react

## 后续方向

多模型测试与 Prompt 评分对比 · 团队 Workspace 与协作 · 一键分发到 Claude Code / Cursor / Codex / Windsurf · Prompt Marketplace。

## License

[MIT](./LICENSE)
