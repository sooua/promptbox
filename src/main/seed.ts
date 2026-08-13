import type { PromptRepository } from './store/repository'

/**
 * Populate a fresh data store with a few example prompts so the app isn't empty
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
}
