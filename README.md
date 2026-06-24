# PromptBox

本地优先的 AI Prompt 资产管理工具 — 像管理代码片段一样管理你的 Prompt、角色设定、上下文模板与 AI 编程工作流。

基于 **Electron + React + TypeScript + Tailwind CSS v4**，所有数据默认以 JSON 保存在本机，不上传任何服务器。

## 功能（MVP）

- ✅ Prompt 创建 / 编辑 / 删除 / 复制 / 一键复制内容
- ✅ 分类、标签、收藏、全局搜索
- ✅ Markdown 编辑与实时预览
- ✅ 变量化模板 `{{customer_name}}` `{{report_type}}` —— 变量自动识别、填充、复制结果
- ✅ 本地 JSON 文件存储（可在设置中更改数据目录）
- ✅ 数据导入 / 导出（合并 / 替换）
- ✅ 简单版本历史（修改内容自动留存、可一键恢复）
- ✅ 深色 / 浅色 / 跟随系统
- ✅ 设置页（数据目录、主题、导入导出）

## 开发

```bash
npm install
npm run dev          # 启动开发模式
npm run typecheck    # 类型检查
npm run build        # 构建
npm run package      # 打包为安装包（electron-builder）
```

## 架构

```
src/
  shared/        # 主进程与渲染进程共享的类型、IPC 通道、变量解析
  main/          # Electron 主进程
    store/       # 存储层（JSON 仓储，封装在接口后，便于后续切换 SQLite）
    ipc.ts       # IPC 处理器
    seed.ts      # 首次启动示例数据
  preload/       # 安全的 contextBridge API 暴露
  renderer/      # React 界面
    store.ts     # zustand 全局状态
    components/   # Sidebar / PromptList / EditorPanel / SettingsView 等
```

### 存储层可扩展性

所有持久化都经过 `PromptRepository`（`src/main/store/repository.ts`）。
切换到 SQLite 时，只需实现相同的公共方法，无需改动上层。

## 后续扩展方向

多模型测试、Prompt 评分对比、Team Workspace、云同步与加密备份、
Agent / Skill (SKILL.md) / MCP Server 配置管理、一键分发到 Claude Code / Cursor /
Codex / Windsurf / Cline、企业级权限与审计、Prompt Marketplace。
