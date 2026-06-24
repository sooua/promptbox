import type { PromptRepository } from './store/repository'

/**
 * Populate a fresh data store with a few example assets so the app isn't empty
 * on first launch. Runs only when there are zero prompts.
 */
export function seedIfEmpty(repo: PromptRepository): void {
  if (repo.listPrompts().length > 0) return

  const dev = repo.createCategory('编程辅助', '#3b82f6')
  const sec = repo.createCategory('安全分析', '#ef4444')
  const report = repo.createCategory('报告生成', '#10b981')

  repo.createPrompt({
    title: '代码审计助手',
    description: '对给定代码进行安全与质量审计',
    categoryId: sec.id,
    tags: ['security', 'code-review'],
    favorite: true,
    content: `你是一名资深安全工程师。请对以下 {{language}} 代码进行审计：

\`\`\`
{{code}}
\`\`\`

请按以下维度输出：
1. 安全漏洞（含严重级别）
2. 潜在 bug
3. 可维护性建议
4. 修复方案`
  })

  repo.createPrompt({
    title: '客户报告生成模板',
    description: '基于交付数据生成标准化报告',
    categoryId: report.id,
    tags: ['report', 'template'],
    content: `请为客户 {{customer_name}} 生成一份 {{report_type}} 报告。

时间范围：{{date_range}}
核心数据：{{key_metrics}}

要求：专业、简洁、结构清晰，包含摘要、详情与下一步建议。`
  })

  repo.createPrompt({
    title: 'Claude Code 工作流：实现新功能',
    description: '在代码库中实现一个新功能的标准提示词',
    categoryId: dev.id,
    tags: ['claude-code', 'workflow'],
    content: `请在当前代码库中实现以下功能：{{feature_description}}

约束：
- 遵循现有代码风格与目录结构
- 先阅读相关文件再动手
- 保持改动最小且可维护
- 完成后给出改动摘要`
  })

  // Example assets (Skill / Agent / MCP)
  repo.createAsset({
    kind: 'skill',
    name: 'code-review',
    description: '对改动进行结构化代码审查',
    tags: ['review'],
    meta: { allowedTools: 'Read, Grep, Glob' },
    content: `# 代码审查

对当前改动按以下维度审查并给出可执行建议：

1. 正确性与边界情况
2. 安全性
3. 可维护性与命名
4. 性能

每条问题给出文件:行号与修复方案。`
  })

  repo.createAsset({
    kind: 'agent',
    name: 'security-auditor',
    description: '专注安全审计的子代理',
    tags: ['security'],
    meta: { tools: 'Read, Grep, Glob, Bash', model: 'sonnet' },
    content: `你是一名资深安全工程师。系统性审查代码库中的安全风险：

- 注入、认证与鉴权缺陷
- 敏感信息泄露
- 依赖与配置风险

按严重级别输出，并提供最小可行修复。`
  })

  repo.createAsset({
    kind: 'mcp',
    name: 'filesystem',
    description: '本地文件系统 MCP Server',
    tags: ['official'],
    content: '',
    meta: {
      transport: 'stdio',
      command: 'npx',
      args: '-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir',
      env: ''
    }
  })
}
