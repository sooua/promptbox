import type { Language } from '@shared/types'

/**
 * Tiny main-process i18n for the few native strings (tray menu, dialogs).
 * Chinese is the key; English is looked up, falling back to the key.
 * The renderer has its own, larger dictionary.
 */
const en: Record<string, string> = {
  '显示 PromptBox': 'Show PromptBox',
  '快速调用…': 'Quick launch…',
  退出: 'Quit',
  'PromptBox — 快速调用提示词': 'PromptBox — quick prompt launcher',
  'PromptBox 无法保存数据': 'PromptBox cannot save data',
  '写入数据文件失败，最近的修改可能仅保存在内存中。\n请检查磁盘空间或文件权限。\n\n{msg}':
    'Failed to write the data file; recent changes may exist only in memory.\nCheck disk space or file permissions.\n\n{msg}',
  'PromptBox 数据文件已损坏': 'PromptBox data file is corrupt',
  '原文件已保留为「{file}」。\n{detail}': 'The original was kept as "{file}".\n{detail}',
  '已从备份「{file}」恢复数据。': 'Recovered data from backup "{file}".',
  '未找到可用备份，已以空数据启动。': 'No usable backup found; started with empty data.'
}

let lang: Language = 'zh'
let onChange: (() => void) | null = null

export function setMainLanguage(l: Language): void {
  if (l === lang) return
  lang = l
  onChange?.()
}

/** Register a callback fired whenever the language changes (e.g. to rebuild the tray). */
export function onMainLanguageChange(cb: () => void): void {
  onChange = cb
}

export function mt(zh: string, params?: Record<string, string | number>): string {
  let s = lang === 'en' ? (en[zh] ?? zh) : zh
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]))
  }
  return s
}
