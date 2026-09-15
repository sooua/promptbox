# PromptBox

[![Release](https://img.shields.io/github/v/release/sooua/promptbox?label=release)](https://github.com/sooua/promptbox/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/sooua/promptbox/total)](https://github.com/sooua/promptbox/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**按开发阶段取用 Prompt 的本地优先桌面工具。**

不是把所有 Prompt 堆在一起让你挑。打开只问一个问题——你要做的是网站、命令行工具、桌面应用、手机 App 还是其他——然后就是一条路：**想清楚 → 定方案 → 搭骨架 → 做功能（每个功能一轮）→ 上线**，一次只看当前这一步。内置 13 步、49 条中文 Prompt（多数步骤按项目类型各有版本），每步最多输入一句话，产物写成 `docs/` 里的文件，下一步自动读上一步。所有数据以 JSON 保存在本机；云同步可选并端到端加密。

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

### 路线

- 首屏只选项目类型 + 起点（从零开始 / 我有现成代码）；有进度时可「继续上次」或「重新开始」
- 五个固定阶段，每个阶段下是有序的**步骤**（可增删、重命名、拖拽排序）；「做功能」阶段按功能循环
- 一次只看当前一步：这步做什么 → 最多一句话输入 → 复制去 Claude Code / Cursor → 完成，下一步
- 除需求、拆任务、实现外，每一步都按项目类型有各自的版本：该类项目该问什么、该砍什么、架构上哪些坑、测什么、审什么
- 「高级 · 全部 Prompt」是原来的三栏库，改措辞、加自己的 Prompt 去那里

### Prompt 库

- Markdown 正文，实时预览，编辑自动保存并显示保存状态
- 收藏
- **导入已有的 `.md` / `.txt` 提示词**，支持 front-matter 的 `title` / `description` / `tags`，`{{变量}}` 自动识别

### 变量模板

- `{{变量名}}` 自动识别，填充后一键复制结果
- 内联默认值：`{{name | 默认值}}`
- 必填校验（未填写禁止复制并高亮）
- 输入类型：文本 / 多行 / 下拉 / 数字 / 日期
- 记住上次填写的值

### 命令面板（Ctrl/⌘ + K）

跨全部 Prompt 快速搜索调用，支持拼音全拼与首字母匹配。增量索引（预计算检索键 + 按对象身份记忆化），大库依然流畅。`Enter` 复制（含变量则先弹填充框），`⌘/Ctrl+Enter` 在编辑器中打开。

### 版本历史

- 修改内容自动留存历史版本，可并排查看 **diff** 改动并一键恢复
- 编辑器词级撤销重做（`Ctrl+Z` / `Ctrl+Shift+Z`）

### 云同步（可选）

- 支持 **GitHub Gist / WebDAV / S3 兼容存储**
- 多设备项目级合并，删除通过墓碑（tombstone）传播，保留一年
- 收藏 / 使用计数走独立时间戳，不会覆盖另一台设备上的正文修改
- 对端设备时间明显偏快时会在同步结果里提示（合并按修改时间取新）
- **端到端加密**（AES-256-GCM），口令经本机 `safeStorage` 加密保存，云端只存密文
- 自动同步带防抖与失败指数退避，状态实时可见

### 数据安全

- **回收站**：删除可恢复，保留 30 天后自动清理；彻底删除需二次确认
- **自动备份**：定时快照（每 5 分钟）+ 退出前快照，最多保留 20 份；替换导入前强制备份
- **损坏自愈**：数据文件损坏时自动隔离为 `promptbox.corrupt-*.json` 并从最近备份恢复，绝不静默清空
- **原子写入 + 写盘失败弹窗提示**
- 本地 JSON 存储，数据目录可在设置中更改；支持导入 / 导出（合并 / 替换）

### 界面

- Claude/Anthropic 暖色设计语言（羊皮纸底 + 陶土橙 + 衬线标题）
- 浅色 / 深色 / 跟随系统，一套语义化 token 切换
- 自定义无边框标题栏，更整洁的窗口外观
- 全局热键唤起 + 托盘常驻（关闭窗口的行为可选：最小化到托盘 / 直接退出）

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + K` | 命令面板（搜索全部 Prompt） |
| `Ctrl/⌘ + N` | 新建 Prompt |
| `Ctrl/⌘ + D` | 为当前条目创建副本 |
| `Ctrl/⌘ + S` | 立即保存 |
| `Ctrl/⌘ + F` | 聚焦列表搜索 |
| `Ctrl/⌘ + ,` | 打开设置 |
| `Ctrl/⌘ + Z` | 编辑器撤销 / 重做 |
| `↑ ↓ / Enter` | 列表选择 / 复制 |
| `Esc` | 关闭弹窗 / 从设置·回收站返回 |

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
  shared/          # 主进程与渲染进程共享：类型、IPC 通道、变量解析、Markdown front-matter
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
    components/    # Sidebar / PromptList / EditorPanel / CommandPalette / TrashView / Modal 等
```

### 存储层可扩展性

所有持久化都依赖 `Repository` 接口（`src/main/store/repository.ts`），IPC、备份、同步均面向接口而非具体类。默认实现是 JSON 文件仓储；要换 SQLite，只需 `implements Repository` 并在 `index.ts` 替换构造，上层零改动。`DESIGN.md` 与 `PRODUCT.md` 记录了视觉系统与产品策略。

## 技术栈

Electron · electron-vite · React 18 · TypeScript · Tailwind CSS v4 · zustand · electron-updater · pinyin-pro · lucide-react

## 后续方向

多模型测试与 Prompt 评分对比 · 团队 Workspace 与协作 · 一键分发到 Claude Code / Cursor / Codex / Windsurf · Prompt Marketplace。

## License

[MIT](./LICENSE)
