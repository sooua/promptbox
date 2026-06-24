import { useStore } from './store'
import { toast } from './components/Toast'
import { t } from './i18n'

/**
 * Single entry point for "copy this prompt" from the fast paths (command
 * palette, list quick-copy). If the prompt has variables, open the quick-fill
 * modal so the user can fill them before copying; otherwise copy the raw
 * content straight to the clipboard.
 */
export async function requestCopy(id: string): Promise<void> {
  const s = useStore.getState()
  const prompt = s.prompts.find((p) => p.id === id)
  if (!prompt) return

  if (prompt.variables.length > 0) {
    s.openQuickFill(id)
    return
  }

  const ok = await s.copyAndUse(id)
  if (ok) toast.success(t('已复制到剪贴板'))
  else toast.error(t('复制失败'))
}
