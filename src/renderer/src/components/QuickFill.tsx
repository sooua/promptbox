import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, CloseIcon, CodeIcon, CopyIcon, DocumentIcon } from '../icons'
import { useStore } from '../store'
import { fillTemplate, missingRequired } from '@shared/variables'
import { VariableInput, initialValue } from './VariableInput'
import { Modal } from './Modal'
import { toast } from './Toast'
import { useT } from '../i18n'

/**
 * Quick-fill-on-copy modal. Opened when a variable-containing prompt is copied
 * from a fast path. Fill the {{variables}}, then copy the resolved result.
 * ⌘/Ctrl+Enter copies the filled version; Esc cancels.
 */
export function QuickFill(): React.JSX.Element | null {
  const id = useStore((s) => s.quickFillPromptId)
  const prompt = useStore((s) => s.prompts.find((p) => p.id === s.quickFillPromptId) ?? null)
  const close = useStore((s) => s.closeQuickFill)
  const copyResolvedAndUse = useStore((s) => s.copyResolvedAndUse)
  const copyAndUse = useStore((s) => s.copyAndUse)
  const rememberVarValues = useStore((s) => s.rememberVarValues)
  const t = useT()

  const [values, setValues] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!prompt) return
    const init: Record<string, string> = {}
    for (const v of prompt.variables) init[v.name] = initialValue(v)
    setValues(init)
    setShowErrors(false)
  }, [prompt?.id])

  const resolved = useMemo(
    () => (prompt ? fillTemplate(prompt.content, values) : ''),
    [prompt, values]
  )
  const missing = useMemo(
    () => (prompt ? missingRequired(prompt.variables, values) : []),
    [prompt, values]
  )

  if (!id || !prompt) return null

  async function copyFilled() {
    if (missing.length > 0) {
      setShowErrors(true)
      toast.error(t('请先填写必填变量：{names}', { names: missing.join('、') }))
      return
    }
    const ok = await copyResolvedAndUse(prompt!.id, resolved)
    void rememberVarValues(prompt!.id, values)
    close()
    if (ok) toast.success(t('已复制填充后的 Prompt'))
    else toast.error(t('复制失败'))
  }

  async function copyRaw() {
    const ok = await copyAndUse(prompt!.id)
    close()
    if (ok) toast.success(t('已复制原始模板'))
    else toast.error(t('复制失败'))
  }

  // Esc is handled by <Modal> at window level.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void copyFilled()
    }
  }

  return (
    <Modal
      onClose={close}
      ariaLabel={t('填充变量后复制')}
      overlayClassName="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]"
      className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[rgba(0,0,0,0.12)_0px_12px_48px]"
    >
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <CodeIcon className="size-4 text-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold tracking-tight text-[17px] text-foreground">{prompt.title}</div>
            <div className="text-[11px] text-muted-foreground">{t('填充变量后复制')}，{t('{n} 个变量', { n: prompt.variables.length })}</div>
          </div>
          <button onClick={close} className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {prompt.variables.map((v, i) => (
              <div key={v.name}>
                <label className="mb-1 block text-xs text-muted-foreground">
                  <code className="var-chip">{v.label || v.name}</code>
                  {v.required && <span className="ml-1 text-destructive" title={t('必填')}>*</span>}
                  {v.description && <span className="ml-2 text-muted-foreground">{v.description}</span>}
                </label>
                <VariableInput
                  variable={v}
                  value={values[v.name] ?? ''}
                  invalid={showErrors && missing.includes(v.name)}
                  onChange={(val) => setValues((s) => ({ ...s, [v.name]: val }))}
                  autoFocus={i === 0}
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <DocumentIcon className="size-3.5" />
              {t('预览结果')}
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground">
              {resolved}
            </pre>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <button
            onClick={copyRaw}
            className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:border-ring hover:text-foreground"
          >
            {t('复制原始模板')}
          </button>
          <span className="ml-auto text-[11px] text-muted-foreground">⌘/Ctrl + Enter</span>
          <button
            onClick={copyFilled}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-sm text-primary-foreground transition hover:bg-primary/80"
          >
            <CopyIcon className="size-3.5" />
            {t('复制填充结果')}
            <CheckIcon className="size-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
